
function WxServer(io) {
    var express = require('express');
    var router = express.Router();
    var Db = require('../utils/db');
    const WXAPI = require('./wxapi.json');
    const sysConfig = require('../server_config.json');
    const Token = require('../authServer/token');
    const oriRequest = require("request");
    var fs = require('fs');
    const Request = require('../utils/request');
    const request = new Request();
    const tokenPhaser = new Token();
    const crypto = require('crypto');
    var db = new Db();
    const TOKEN_EXPIRED_TIME = 1000 * 60 * 60 * 24 * 15;

    let accessKey;
    let accessKeyExpireTime = 0;
    let wxTempLoginPool = {};
    let socketid2token = {};


    async function getAccessKey() {
        if (new Date().valueOf() > accessKeyExpireTime) {
            let response = await request.getSync(WXAPI.auth_getAccessToken, {
                grant_type: "client_credential",
                appid: sysConfig.WX_MINIPROGRAM.APPID,
                secret: sysConfig.WX_MINIPROGRAM.APPSECRET,
            });
            let data = JSON.parse(response.body)
            accessKey = data.access_token;
            accessKeyExpireTime = new Date().valueOf() + data.expires_in * 1000;
        }
        console.log("[info] Current WX AccessKey:", accessKey);
        return accessKey;
    }
    function getWXLoginTempToken(socket) {
        let code = crypto.createHash('md5').update(String(new Date() + 'ffghbvbfwe')).digest("hex").substr(3, 16);
        while (wxTempLoginPool[code]) {
            code = crypto.createHash('md5').update(String(new Date() + 'ffghbvbfwe')).digest("hex").substr(3, 16);
        }
        wxTempLoginPool[code] = socket;
        socketid2token[socket.id] = code;
        console.log("[info] WX login code generated:", code);
        return code;
    }

    io.of('/wxscanlogin').on('connection', async socket => {
        let tempToken = getWXLoginTempToken(socket);
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
                url: WXAPI.wxacode_getUnlimited + '?access_token=' + key,
                json: false,
                body: JSON.stringify({
                    scene: "loginToken=" + loginTempToken,
                    //page:"pages/clientLogin/index",
                    line_color: { "r": 0, "g": 0, "b": 0 },
                    is_hyaline: false
                })
            }).pipe(stream).on('close', () => {
                console.log('download ok!');
                res.sendFile(__dirname + '/tempLoginImage/' + loginTempToken + '.png');
                setTimeout(function(){
                    fs.unlink(__dirname + '/tempLoginImage/' + loginTempToken + '.png',err=>{
                        if(err){
                            console.error(err);
                        }else{
                            console.log('File '+__dirname + '/tempLoginImage/' + loginTempToken + '.png deleted');
                        }
                    });
                },10000);
            });
        } else {
            res.status(403).json({
                code: 403,
                msg: "登录Token有误或已过期。"
            });
        }
    });
    return router;
}
module.exports = WxServer