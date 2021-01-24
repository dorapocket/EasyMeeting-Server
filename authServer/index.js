
function AuthServer(){
var express = require('express');
var router = express.Router();
var Db=require('../utils/db');
const Token=require('./token');
const token=new Token();
var db=new Db();

router.use('/register',async function(req,res){
    const {username,realname,telephone,email,certificate}=req.query;
    const queryUserSql="SELECT * FROM users WHERE USER_NAME=? OR TELEPHOME=? OR EMAIL=?"
    let stat;
    let exist=await db.query(queryUserSql,[username,telephone,email]);
    if(exist.length!=0) {res.json({code:600,msg:'用户已存在'});return;}
    try{
        stat=await db.query("INSERT INTO users (USER_NAME,REAL_NAME,TELEPHONE,EMAIL,STATUS) VALUES (?,?,?,?,?)",[username,realname,telephone,email,true]);
        await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'EMAIL',email,certificate,false]);
        await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'TELEPHONE',telephone,certificate,false]);
        await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'USERNAME',username,certificate,true]);
    }catch(e){
        res.status(500);
        res.json({
            code:500,
            msg:'内部服务器错误，请稍后重试',
            e,
        });
    }
    let userToken=token.create({
        uid:stat.insertId,
        realname,
        expired_time:(Date.now()+1000*60*60*24*15).toString()
    });
    res.cookie('token',userToken,{maxAge: 1000*60*60*24*15, httpOnly: true});
    res.json({
        code:200,
        msg:'登录成功',
        token:userToken
    });
});

router.use('/login',async function(req,res){
    const {username,certificate,loginType}=req.query;
    let info;
    switch(loginType){
        case 'USERNAME':
        case 'EMAIL':
        case 'TELEPHONE':
            info=await db.query("SELECT * FROM user_auths WHERE IDENTITYTYPE=? AND IDENTIFIER=? AND CREDENTIAL=?",[loginType,username,certificate]);
            userInf=await db.query("SELECT * FROM users WHERE UID=?",[info[0].UID]);
            if(info.length!=0){
            if(info[0].ISVERIFIED){
                let userToken=token.create({
                    uid:info[0].UID,
                    realname:userInf[0].REAL_NAME,
                    expired_time:(Date.now()+1000*60*60*24*15).toString()
                });
                res.cookie('token',userToken,{maxAge: 1000*60*60*24*15, httpOnly: true});
                res.json({
                    code:200,
                    msg:'登录成功',
                    token:userToken
                });
            }else{
                res.json({
                    code:601,
                    msg:'登陆失败，邮箱/手机尚未验证',
                });
            }
        }else{
            res.json({
                code:602,
                msg:'登陆失败，用户名或密码错误',
            });
        }
        break;
        default:
            res.status(400);
            res.json({
                code:400,
                msg:'错误的登陆类型：Bad Request（400）'
            });
    }
});
return router;
}
module.exports=AuthServer;