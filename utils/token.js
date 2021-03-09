function Token(){
/**
 *
 * token格式
 * client_type:'client' 或者 'tv'
 * uid:info[0].UID, (client有效)
 * realname:userInf[0].REAL_NAME,(client有效)
 * expired_time:(Date.now()+TOKEN_EXPIRED_TIME).toString(),(client有效)
 * did:(tv有效)
 * 
 * 使用token的位置：authServer内、wx内、tv鉴权在主index
*/
const crypto = require('crypto');
const config = require('../server_config.json');
/**
 * AES加密的配置 
 * 1.密钥 
 * 2.偏移向量 
 * 3.算法模式CBC 
 * 4.补全值
 */
var AES_conf = config.AES_CONFIG;

/**
 * AES_128_CBC 加密 
 * 128位 
 * return base64
 */
this.create=function(obj){
    data=JSON.stringify(obj)
    let key = AES_conf.key;
    let iv = AES_conf.iv;
    // let padding = AES_conf.padding;
    var cipherChunks = [];
    var cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(true);
    cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
    cipherChunks.push(cipher.final('base64'));
    return cipherChunks.join('');
}


/**
 * 解密
 * return utf8
 */
this.parse=function(data){
    try{
        let key = AES_conf.key;
        let iv = AES_conf.iv;
        // let padding = AES_conf.padding;
        var cipherChunks = [];
        var decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);
        cipherChunks.push(decipher.update(data, 'base64', 'utf8'));
        cipherChunks.push(decipher.final('utf8'));
        let json=JSON.parse(cipherChunks.join(''));
        return json;
    }catch(e){
        return false;
    }
}
}
module.exports=Token;