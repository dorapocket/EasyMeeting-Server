const Request = require('./request');
const request = new Request();
const WXAPI = require('../wxServer/wxapi.json');
const sysConfig = require('../server_config.json');

function WX(){
    this.accessKey;
    this.accessKeyExpireTime = 0;
    this.getAccessKey=async function(){
        if (new Date().valueOf() > this.accessKeyExpireTime) {
            let response = await request.getSync(WXAPI.auth_getAccessToken, {
                grant_type: "client_credential",
                appid: sysConfig.WX_MINIPROGRAM.APPID,
                secret: sysConfig.WX_MINIPROGRAM.APPSECRET,
            });
            let data = JSON.parse(response.body)
            this.accessKey = data.access_token;
            this.accessKeyExpireTime = new Date().valueOf() + data.expires_in * 1000;
        }
        console.log("[info] Current WX AccessKey:", this.accessKey);
        return this.accessKey;
    }
    this.getWXAPI=function(){
        return WXAPI;
    }

}
module.exports=WX;