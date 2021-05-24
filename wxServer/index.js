function WxServer(io, wx) {
    var express = require('express');
    var router = express.Router();
    var Db = require('../utils/db');
    const sysConfig = require('../server_config.json');
    const Token = require('../utils/token');
    const oriRequest = require("request");
    var fs = require('fs');
    const Request = require('../utils/request');
    const DateUtils = require('../utils/date');
    const du = new DateUtils();
    const request = new Request();
    const tokenPhaser = new Token();
    const crypto = require('crypto');
    var db = new Db();
    const TOKEN_EXPIRED_TIME = 1000 * 60 * 60 * 24 * 15;

    let wxTempLoginPool = {};
    let socketid2token = {};

    async function getIPInfo(req) {
        ipStr = req.handshake.address;
        var ipReg = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
        if (ipStr.split(',').length > 0) {
            ipStr = ipStr.split(',')[0]
        }
        var ip = ipReg.exec(ipStr);

        try {
            let pos = await request.getSync("https://sp0.baidu.com/8aQDcjqpAAV3otqbppnN2DJv/api.php?query=" + ip[0] + "&co=&resource_id=6006&t=1555898284898&ie=utf8&oe=utf8&format=json&tn=baidu", {});
            let d = JSON.parse(pos.body);
            return {
                ip: ip[0] ? ip[0] : '未知',
                pos: d.data[0].location ? d.data[0].location : '未知'
            }
        } catch (e) {
            return {
                ip: ip[0] ? ip[0] : '未知',
                pos: '未知'
            }
        }
    };
    async function getAccessKey() {
        let key = await wx.getAccessKey();
        return key
    }

    async function getWXLoginTempToken(socket) {
        let code = crypto.createHash('md5').update(String(new Date() + 'ffghbvbfwe')).digest("hex").substr(3, 16);
        while (wxTempLoginPool[code]) {
            code = crypto.createHash('md5').update(String(new Date() + 'ffghbvbfwe')).digest("hex").substr(3, 16);
        }
        let ip = await getIPInfo(socket);
        console.log('Request ip info:', ip);
        wxTempLoginPool[code] = {
            socket: socket,
            ip: ip.ip,
            pos: ip.pos
        }
        socketid2token[socket.id] = code;
        console.log("[info] WX login code generated:", code);
        return code;
    }

    io.of('/wxscanlogin').on('connection', async socket => {
        let tempToken = await getWXLoginTempToken(socket);
        socket.emit("WXLOGIN_IMAGE_READY", '/wechat/getLoginImage?loginTempToken=' + tempToken);
        socket.on('disconnect', function () {
            delete wxTempLoginPool[socketid2token[socket.id]];
            delete socketid2token[socket.id];
        });
        //socket.emit('WXLOGIN_IMAGE',);
    });

    router.use('/getLoginImage', async function (req, res) {
        let { loginTempToken } = req.query;

        if (wxTempLoginPool[loginTempToken]) {
            // fs.writeFile('./tempLoginImage/'+loginTempToken+'.png');
            var stream = fs.createWriteStream(__dirname + '/tempLoginImage/' + loginTempToken + '.png');
            let key = await getAccessKey();
            oriRequest.post({
                timeout: 5000,
                url: wx.getWXAPI().wxacode_getUnlimited + '?access_token=' + key,
                json: false,
                body: JSON.stringify({
                    scene: loginTempToken,
                    page: "pages/login/scanLogin/index",
                    line_color: { "r": 0, "g": 0, "b": 0 },
                    is_hyaline: false
                })
            }).pipe(stream).on('close', () => {
                console.log('download ok!');
                res.sendFile(__dirname + '/tempLoginImage/' + loginTempToken + '.png');
                setTimeout(function () {
                    fs.unlink(__dirname + '/tempLoginImage/' + loginTempToken + '.png', err => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('File ' + __dirname + '/tempLoginImage/' + loginTempToken + '.png deleted');
                        }
                    });
                }, 10000);
            });
        } else {
            res.status(403).json({
                code: 403,
                msg: "登录Token有误或已过期。"
            });
        }
    });

    router.post('/mplogin', async function (req, res) {
        let { token, username, password } = req.body;
        let response = await request.getSync(wx.getWXAPI().auth_code2Session, {
            appid: sysConfig.WX_MINIPROGRAM.APPID,
            secret: sysConfig.WX_MINIPROGRAM.APPSECRET,
            js_code: token,
            grant_type: "authorization_code"
        });
        let data = JSON.parse(response.body)//session_key openid
        if (data.session_key && data.openid) {
            let querySql = "SELECT * FROM user_auths WHERE IDENTITYTYPE = 'WECHAT' AND IDENTIFIER=?";
            let info = await db.query(querySql, [data.openid]);
            if (info.length == 0) {
                // 未绑定方式
                if (username && password) {
                    // 有登录 开始绑定
                    let validSql = "SELECT * FROM user_auths WHERE IDENTIFIER=? AND CREDENTIAL=?";
                    let valid = await db.query(validSql, [username, password]);
                    if (valid.length == 0) {
                        // 登陆失败
                        res.status(403).json({
                            code: 403,
                            msg: '绑定失败：用户名或密码错误'
                        });
                    } else {
                        // 绑定并登录
                        await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',
                            [valid[0].UID, 'WECHAT', data.openid, data.session_key, true]);
                        let userInf = await db.query("SELECT * FROM users WHERE UID=?", [valid[0].UID]);
                        let userToken = tokenPhaser.create({
                            uid: valid[0].UID,
                            realname: userInf[0].REAL_NAME,
                            expired_time: (Date.now() + TOKEN_EXPIRED_TIME).toString(),
                            client_type: 'client'
                        });
                        res.cookie('token', userToken, { maxAge: TOKEN_EXPIRED_TIME, httpOnly: true });
                        res.json({
                            code: 200,
                            msg: '登录成功',
                            token: userToken
                        });
                    }
                } else {
                    // 未绑定 错误
                    res.status(202).json({
                        code: 202,
                        msg: '用户未绑定'
                    });
                }
            } else {
                // 已绑定 登陆成功
                if (info[0].ISVERIFIED) {
                    await db.query("UPDATE user_auths SET CREDENTIAL=? WHERE IDENTIFIER=? AND IDENTITYTYPE='WECHAT'", [data.session_key, data.openid]);
                    let userInf = await db.query("SELECT * FROM users WHERE UID=?", [info[0].UID]);
                    let userToken = tokenPhaser.create({
                        uid: info[0].UID,
                        realname: userInf[0].REAL_NAME,
                        expired_time: (Date.now() + TOKEN_EXPIRED_TIME).toString(),
                        client_type: 'client'
                    });
                    res.cookie('token', userToken, { maxAge: TOKEN_EXPIRED_TIME, httpOnly: true });
                    res.json({
                        code: 200,
                        msg: '登录成功',
                        token: userToken
                    });
                } else {
                    res.status(400).json({
                        code: 601,
                        msg: '登录失败，微信尚未验证',
                    });
                }
            }
        } else {
            res.status(403).json({
                code: 403,
                msg: "非法请求"
            });
        }
    });

    router.use('/getPCLoginInfo', function (req, res) {
        let { code } = req.query;
        if (wxTempLoginPool[code] && wxTempLoginPool[code].socket.connected) {
            wxTempLoginPool[code].socket.emit('WXLOGIN_ALREADY_SCAN');
            res.status(200).json({
                code: 200,
                msg: '操作成功',
                data: {
                    pcCode: code,
                    ip: wxTempLoginPool[code].ip,
                    from: wxTempLoginPool[code].pos,
                }
            });
        } else {
            res.status(403).json({
                code: 403,
                msg: '登录错误，请重试',
                data: {
                    pcCode: '',
                    ip: '未知',
                    from: '未知'
                }
            });
        }
    });
    router.use('/confirmPCLogin', async function (req, res) {
        let { code } = req.query;
        let d = tokenPhaser.parse(req.get('Authorization'));
        if (d.uid && wxTempLoginPool[code] && wxTempLoginPool[code].socket.connected) {
            let userInf = await db.query("SELECT * FROM users WHERE UID=?", [d.uid]);
            let userToken = tokenPhaser.create({
                uid: d.uid,
                realname: userInf[0].REAL_NAME,
                expired_time: (Date.now() + TOKEN_EXPIRED_TIME).toString(),
                client_type: 'client'
            });
            res.cookie('token', userToken, { maxAge: TOKEN_EXPIRED_TIME, httpOnly: true });
            res.json({
                code: 200,
                msg: '登录成功',
                data: {
                    username: userInf[0].USER_NAME,
                    realname: userInf[0].REAL_NAME,
                }
            });
            wxTempLoginPool[code].socket.emit('LOGIN_RESULT', { code: 200, token: userToken });
            wxTempLoginPool[code].socket.disconnect();
        } else {
            res.json({
                code: 408,
                msg: '登录超时，请重新扫码登录',
                data: {}
            });
        }
    });

    // 设备专属小程序码
    router.use('/getDeviceWxaCode', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        if (d && d.did) {
            var stream = fs.createWriteStream(__dirname + '/tempDeviceImage/Device' + d.did + '.png');
            let key = await getAccessKey();
            oriRequest.post({
                timeout: 5000,
                url: wx.getWXAPI().wxacode_getUnlimited + '?access_token=' + key,
                json: false,
                body: JSON.stringify({
                    scene: d.did,
                    page: "pages/device/index",
                    line_color: { "r": 0, "g": 0, "b": 0 },
                    is_hyaline: false
                })
            }).pipe(stream).on('close', () => {
                console.log('download ok!');
                res.sendFile(__dirname + '/tempDeviceImage/Device' + d.did + '.png');
                setTimeout(function () {
                    fs.unlink(__dirname + '/tempDeviceImage/Device' + d.did + '.png', err => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('File ' + __dirname + '/tempDeviceImage/Device' + d.did + '.png deleted');
                        }
                    });
                }, 10000);
            });
        } else {
            res.status(403).json({
                code: 403,
                msg: "登录Token有误或已过期。"
            });
        }

    });

    // 获取设备信息
    router.use('/getDeviceInfo', async function (req, res) {
        let { did } = req.query;
        let d = tokenPhaser.parse(req.get('Authorization'));
        const roomsQuery = "SELECT d.MID,d.ADMIN_UID,m.NAME,m.POSITION FROM devices d LEFT JOIN meeting_rooms m ON d.MID=m.MID WHERE d.DID=?";
        let roomInfo = await db.query(roomsQuery, [did]);
        if (roomInfo.length != 0) {
            res.json({
                code: 200,
                msg: '操作成功',
                data: {
                    mname: roomInfo[0].NAME,
                    pos: roomInfo[0].POSITION,
                    admin_uid: roomInfo[0].ADMIN_UID,
                    mid: roomInfo[0].MID
                }
            });
        } else {
            res.json({
                code: 400,
                msg: '设备不存在',
            });
        }

    });

    // 可签到的会议信息
    router.use('/getCouldCheckinList', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        let { mid } = req.query;
        const query = "SELECT * FROM user_meetings u LEFT JOIN activities a ON u.AID=a.AID WHERE u.UID=? AND a.TIME_BEGIN<STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND a.TIME_BEGIN>STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND u.CHECKIN_STAT=? AND a.MID=?";
        let meetingList = await db.query(query, [d.uid, du.dateFormat(new Date(Date.now() + 60 * 10000), 'yyyy-MM-dd hh:mm:ss'), du.dateFormat(new Date(Date.now() - 60 * 10000), 'yyyy-MM-dd hh:mm:ss'), false, mid]);
        if (meetingList.length != 0) {
            let couldCheckObj = {
                aid: meetingList[0].AID,
                sponsor: meetingList[0].SPONSOR,
                mname: meetingList[0].THEME,
                time_begin: meetingList[0].TIME_BEGIN.valueOf(),
                time_end: meetingList[0].TIME_END.valueOf()
            };
            res.status(200).json({
                code: 200,
                msg: '发现会议，请尽快签到！',
                data: couldCheckObj
            });
            return
        } else {
            res.status(200).json({
                code: 200,
                msg: '没有需要签到的会议哦～',
            });
            return
        }

    });

    // 已经有人来了，不能抢占的列表
    let arrivedFlag = {};
    // 签到
    router.use('/checkIn', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        let { aid } = req.query;
        const verifyQuery = "SELECT * FROM user_meetings u LEFT JOIN activities a ON u.AID=a.AID WHERE u.UID=? AND a.TIME_BEGIN<STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND a.TIME_BEGIN>STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND u.AID=?";
        let verifyList = await db.query(verifyQuery, [d.uid, du.dateFormat(new Date(Date.now() + 60 * 10000), 'yyyy-MM-dd hh:mm:ss'), du.dateFormat(new Date(Date.now() - 60 * 10000), 'yyyy-MM-dd hh:mm:ss'), aid]);
        if (verifyList.length !== 0) {
            // 确实有这个东西
            const checkInSQL = "UPDATE user_meetings SET CHECKIN_STAT=? WHERE UID=? AND AID=?";
            await db.query(checkInSQL, [true, d.uid, aid]);
            if (!arrivedFlag[aid]) {
                const updateArriveSQL = "UPDATE activities SET ARRIVED=? WHERE AID=?";
                await db.query(updateArriveSQL, [true, aid]);
                arrivedFlag[aid] = true;
            }
            res.status(200).json({
                code: 200,
                msg: '操作成功',
            });
            return 
        } else {
            // 没有这玩意
            res.status(200).json({
                code: 400,
                msg: '该会议未到签到时间或会议ID有误，请重试',
                data: couldCheckList
            });
            return 
        }
    });


    // 抢占
    router.use('/grabRoomInfo', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        let { mid } = req.query;
        const queryURL = "SELECT * FROM activities WHERE MID=? AND TIME_BEGIN<STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND TIME_END>STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND ARRIVED=? AND GRAB=?";
        let doingMeetings = await db.query(queryURL, [mid, du.dateFormat(new Date(Date.now()), 'yyyy-MM-dd hh:mm:ss'), du.dateFormat(new Date(Date.now()), 'yyyy-MM-dd hh:mm:ss'), false,false]);
        if (doingMeetings.length != 0) {
            // 有没人来的会议
            const isParticipationSQL = "SELECT * FROM user_meetings WHERE UID=? AND AID=?";
            let isParticipation = await db.query(isParticipationSQL, [d.uid, doingMeetings[0].AID]);
            if (isParticipation.length != 0) {
                // 用户就是参会者 抢什么抢
                res.status(200).json({
                    code: 200,
                    msg: '操作成功',
                    data: {
                        type: "GO_CHECKIN",
                        msg: "您是当前会议的参会者，请赶快签到，不然会议室就要被抢走咯！"
                    }
                })
            } else {
                // 可以抢
                res.status(200).json({
                    code: 200,
                    msg: '操作成功',
                    data: {
                        type: "COULD_GRAB",
                        msg: "人都不在？可以抢占当前会议哦！",
                        currentMeeting: {
                            aid: doingMeetings[0].AID,
                            theme: doingMeetings[0].THEME,
                            sponsor: doingMeetings[0].SPONSOR,
                            time_begin: doingMeetings[0].TIME_BEGIN.valueOf(),
                            time_end: doingMeetings[0].TIME_END.valueOf(),
                        }
                    }
                });
            }
        } else {
            res.status(200).json({
                code: 200,
                msg: '操作成功',
                data: {
                    type: "NO_MEETING",
                    msg: "没有可以抢占的会议，请直接预约会议"
                }
            })
        }
    });

    // 抢占会议室
    router.use('/grabRoom', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        let { mid } = req.query;
        const queryURL = "SELECT * FROM activities WHERE MID=? AND TIME_BEGIN<STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND TIME_END>STR_TO_DATE(?,'%Y-%m-%d %H:%i:%s') AND ARRIVED=? AND GRAB=?";
        let doingMeetings = await db.query(queryURL, [mid, du.dateFormat(new Date(Date.now()), 'yyyy-MM-dd hh:mm:ss'), du.dateFormat(new Date(Date.now()), 'yyyy-MM-dd hh:mm:ss'), false,false]);
        if (doingMeetings.length != 0) {
            // 有没人来的会议
            const isParticipationSQL = "SELECT * FROM user_meetings WHERE UID=? AND AID=?";
            let isParticipation = await db.query(isParticipationSQL, [d.uid, doingMeetings[0].AID]);
            if (isParticipation.length != 0) {
                // 用户就是参会者 抢什么抢
                res.status(200).json({
                    code: 400,
                    msg: '抢占失败',
                    data: {
                        type: "GO_CHECKIN",
                        msg: "您是当前会议的参会者，请赶快签到，不然会议室就要被抢走咯！"
                    }
                })
                return
            } else {
                // 可以抢
                const grabSQL = 'UPDATE activities SET GRAB=? WHERE AID=?';
                try {
                    await db.query(grabSQL, [true, doingMeetings[0].AID]);
                    if(sysConfig.MAIL.ENABLED){
                        let ures=await db.query("SELECT EMAIL,REAL_NAME FROM users WHERE UID=?",[doingMeetings[0].SPONSOR_UID]);
                        let mres=await db.query("SELECT NAME,POSITION FROM meeting_rooms WHERE MID=?",[mid]);
                        mailer.sendGrabMail(ures[0].EMAIL,{
                            to:ures[0].REAL_NAME,
                            from:d.realname,
                            datetime:du.dateFormat(new Date(doingMeetings[0].TIME_BEGIN.valueOf()),"yyyy-MM-dd hh:mm:ss"),
                            theme:doingMeetings[0].THEME,
                        });
                    }
                } catch (e) {
                    console.error(e);
                    res.status(500).json({
                        code: 500,
                        msg: '内部服务器错误'
                    });
                    return
                }

                res.status(200).json({
                    code: 200,
                    msg: '抢占成功',
                    data: {
                        type: "DONE",
                        msg: `抢占成功，已释放当前会议${sysConfig.MAIL.ENABLED ? '并邮件通知发起人' : ""}，您可以重新预约`,
                        time_begin: doingMeetings[0].TIME_BEGIN.valueOf(),
                        time_end: doingMeetings[0].TIME_END.valueOf(),
                    }
                });
                return
            }
        } else {
            res.status(200).json({
                code: 400,
                msg: '抢占失败',
                data: {
                    type: "NO_MEETING",
                    msg: "没有可以抢占的会议，请直接预约会议"
                }
            })
            return 
        }
    });

    return router;
}
module.exports = WxServer