function DeviceServer(io, wx) {
    var express = require('express');
    var router = express.Router();
    var Db = require('../utils/db');
    const Token = require('../utils/token');
    const DateUtils = require('../utils/date');
    const du = new DateUtils();
    var fs = require('fs');
    const tokenManager = new Token();
    var db = new Db();
    const oriRequest = require("request");
    const crypto = require('crypto');

    let configPool = {};
    let socketid2token = {};

    async function getAccessKey() {
        let key = await wx.getAccessKey();
        return key
    }

    function getConfigTempToken(socket) {
        let code = crypto.createHash('md5').update(String(new Date() + 'device')).digest("hex").substr(3, 16);
        while (configPool[code]) {
            code = crypto.createHash('md5').update(String(new Date() + 'device')).digest("hex").substr(3, 16);
        }
        configPool[code] = {
            socket: socket,
        }
        socketid2token[socket.id] = code;
        console.log("[info] Device config code generated:", code);
        return code;
    }

    // 自动注册
    io.of('/deviceReg').on('connection', socket => {
        let tempToken = getConfigTempToken(socket);
        socket.emit("REG_IMAGE_READY", '/device/getConfigImage?configCode=' + tempToken);
        socket.on('disconnect', function () {
            delete configPool[socketid2token[socket.id]];
            delete socketid2token[socket.id];
        });
    });

    router.use('/getConfigImage', async function (req, res) {
        let { configCode } = req.query;

        if (configPool[configCode]) {
            // fs.writeFile('./tempLoginImage/'+loginTempToken+'.png');
            var stream = fs.createWriteStream(__dirname + '/tempConfigImage/' + configCode + '.png');
            let key = await getAccessKey();
            oriRequest.post({
                timeout: 5000,
                url: wx.getWXAPI().wxacode_getUnlimited + '?access_token=' + key,
                json: false,
                body: JSON.stringify({
                    scene: configCode,
                    page: "pages/admin/device/add",
                    line_color: { "r": 0, "g": 0, "b": 0 },
                    is_hyaline: false
                })
            }).pipe(stream).on('close', () => {
                console.log('download ok!');
                res.sendFile(__dirname + '/tempConfigImage/' + configCode + '.png');
                setTimeout(function () {
                    fs.unlink(__dirname + '/tempConfigImage/' + configCode + '.png', err => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('File ' + __dirname + '/tempConfigImage/' + configCode + '.png deleted');
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

    router.post('/regist', async function (req, res) {
        let { mid, extra, configCode } = req.body;
        let d = tokenManager.parse(req.get('Authorization'));
        if (d && d.uid && configPool[configCode] && configPool[configCode].socket.connected) {
            try {
                let sql = "INSERT INTO devices (MID,ADMIN_UID,EXTRA) VALUES (?,?,?)";
                let result = await db.query(sql, [mid, d.uid, extra]);
                let token = tokenManager.create({
                    client_type: 'tv',
                    did: result.insertId,
                    mid: mid,
                    expired_time:Date.now()+1000*60*24*365
                });
                configPool[configCode].socket.emit("INIT_COMPLETE",{token:token});
                res.status(200).json({
                    code: 200,
                    msg: "绑定成功",
                    data: []
                });
            } catch (e) {
                console.error(e);
                res.status(500).json({
                    code: 500,
                    msg: "内部服务器错误，请稍后重试",
                    data: []
                });
            }
        } else {
            res.json({
                code: 408,
                msg: '配置码过期，请重启设备，重新扫码',
                data: []
            });
        }
    });

    // 验证并自动续期
    router.use('/validDeviceToken', async function (req, res) {
        let d = tokenManager.parse(req.get('Authorization'));
        console.log(d);
        if (d.client_type == "tv") {
            res.status(200).json({
                code: 200,
                msg: '操作成功',
                token: tokenManager.create({
                    client_type: 'tv',
                    did: d.did,
                    mid: d.mid,
                    expired_time:Date.now()+1000*60*24*365
                })
            });
        } else {
            res.status(403).json({
                code: 403,
                msg: 'Token验证失败',
            });
        }
    });


    return router;
}
module.exports = DeviceServer