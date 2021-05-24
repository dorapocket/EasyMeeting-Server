function WxServer(io, wx) {
    var express = require('express');
    var router = express.Router();
    var Db = require('../utils/db');
    const sysConfig = require('../server_config.json');
    const Token = require('../utils/token');
    const oriRequest = require("request");
    var fs = require('fs');
    const Request = require('../utils/request');
    const DateUtils=require('../utils/date');
    const du=new DateUtils();
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
    router.use('/getCouldCheckinList', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        const query = "SELECT * FROM user_meetings u LEFT JOIN activities a ON u.AID=a.AID WHERE u.UID=? AND a.TIME_BEGIN<'?' AND a.TIME_BEGIN>'?'";
        let meetingList = await db.query(query, [d.uid,du.dateFormat(new Date()+new Date(Date.now()+60*10),'yyyy-MM-dd hh:mm:ss'),du.dateFormat(new Date()+new Date(Date.now()-60*10),'yyyy-MM-dd hh:mm:ss')]);
        let couldCheckList=[];
        meetingList.forEach(r => {
            couldCheckList.push({
                aid:r.AID,
                mname:r.THEME,
                time_begin:r.TIME_BEGIN.valueOf(),
                time_end:r.TIME_END.valueOf()
            });
        });
        res.status(200).json({
            code:200,
            msg:'操作成功',
            data:couldCheckList
        });
    });
    router.use('/checkIn', async function (req, res) {
        let d = tokenPhaser.parse(req.get('Authorization'));
        let {aid} = req.query;
        const verifyQuery = "SELECT * FROM user_meetings u LEFT JOIN activities a ON u.AID=a.AID WHERE u.UID=? AND a.TIME_BEGIN<'?' AND a.TIME_BEGIN>'?' AND u.AID=?";
        let verifyList = await db.query(verifyQuery, [d.uid,du.dateFormat(new Date()+new Date(Date.now()+60*10),'yyyy-MM-dd hh:mm:ss'),du.dateFormat(new Date()+new Date(Date.now()-60*10),'yyyy-MM-dd hh:mm:ss')],aid);
        if(verifyList.length!==0){}
        let couldCheckList=[];
        meetingList.forEach(r => {
            couldCheckList.push({
                aid:r.AID,
                mname:r.THEME,
                time_begin:r.TIME_BEGIN.valueOf(),
                time_end:r.TIME_END.valueOf()
            });
        });
        res.status(200).json({
            code:200,
            msg:'操作成功',
            data:couldCheckList
        });
    });
    return router;
}
module.exports = WxServer