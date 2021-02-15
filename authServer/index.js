
function AuthServer(){
var express = require('express');
var router = express.Router();
var Db=require('../utils/db');
const Token=require('./token');
const tokenPhaser=new Token();
var db=new Db();
const TOKEN_EXPIRED_TIME=1000*60*60*24*15;

router.post('/register',async function(req,res){
    const {username,realname,telephone,email,certificate}=req.body;
    const queryUserSql="SELECT * FROM users WHERE USER_NAME=? OR TELEPHONE=? OR EMAIL=?"
    let stat;
    let exist=await db.query(queryUserSql,[username,telephone,email]);
    if(exist.length!=0) {
        if(exist[0].USER_NAME==username)
        {res.status(403).json({code:403,msg:'该用户名已存在，请重新输入或转至登录'});return;}
        if(exist[0].TELEPHONE==telephone)
        {res.status(403).json({code:403,msg:'该手机已存在，请重新输入或转至登录'});return;}
        if(exist[0].EMAIL==email)
        {res.status(403).json({code:403,msg:'该邮箱已存在，请重新输入或转至登录'});return;}
        return;
    }
    try{
        stat=await db.query("INSERT INTO users (USER_NAME,REAL_NAME,TELEPHONE,EMAIL,STATUS) VALUES (?,?,?,?,?)",[username,realname,telephone,email,true]);
        email?await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'EMAIL',email,certificate,false]):'';
        telephone?await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'TELEPHONE',telephone,certificate,false]):'';
        username?await db.query('INSERT INTO user_auths (UID,IDENTITYTYPE,IDENTIFIER,CREDENTIAL,ISVERIFIED) VALUES (?,?,?,?,?)',[stat.insertId,'USERNAME',username,certificate,true]):'';
    }catch(e){
        res.status(500);
        res.json({
            code:500,
            msg:'内部服务器错误，请稍后重试',
            e,
        });
    }
    res.json({
        code:200,
        msg:'注册成功',
        username:username,
    });
});

router.post('/login',async function(req,res){
    const {username,certificate,loginType}=req.body;
    let info;
    switch(loginType){
        case 'USERNAME':
        case 'EMAIL':
        case 'TELEPHONE':
            info=await db.query("SELECT * FROM user_auths WHERE IDENTITYTYPE=? AND IDENTIFIER=? AND CREDENTIAL=?",[loginType,username,certificate]);
            if(info.length!=0){
            userInf=await db.query("SELECT * FROM users WHERE UID=?",[info[0].UID]);
            if(info[0].ISVERIFIED){
                let userToken=tokenPhaser.create({
                    uid:info[0].UID,
                    realname:userInf[0].REAL_NAME,
                    expired_time:(Date.now()+TOKEN_EXPIRED_TIME).toString(),
                    client_type:'client'
                });
                res.cookie('token',userToken,{maxAge: TOKEN_EXPIRED_TIME, httpOnly: true});
                res.json({
                    code:200,
                    msg:'登录成功',
                    token:userToken
                });
            }else{
                res.status(400).json({
                    code:601,
                    msg:'登陆失败，邮箱/手机尚未验证',
                });
            }
        }else{
            res.status(400).json({
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

// 验证Token有效性,有效则刷新token延长有效期
router.use('/validToken',function(req,res){
    let tokenJson=tokenPhaser.parse(req.get('Authorization'));
            let userToken=tokenPhaser.create({
                uid:tokenJson.uid,
                realname:tokenJson.realname,
                expired_time:(Date.now()+TOKEN_EXPIRED_TIME).toString(),
                client_type:'client'
            });
            res.cookie('token',userToken,{maxAge: TOKEN_EXPIRED_TIME, httpOnly: true});
            res.status(200).json({
                code:200,
                msg:'操作成功',
                data:{
                    token:userToken,
                    uid:tokenJson.uid,
                    realname:tokenJson.realname,
                }
            });
})

// 获取用户信息
router.use('/userInfo',async function(req,res){
    let tokenJson=tokenPhaser.parse(req.get('Authorization'));
            let info=await db.query("SELECT * FROM users WHERE UID=?",[tokenJson.uid]);
            if(info.length!=0){
                res.status(200).json({
                    code:200,
                    msg:'操作成功',
                    data:{
                        uid:info[0].UID,
                        realname:info[0].REAL_NAME,
                        username:info[0].USER_NAME,
                        telephone:info[0].TELEPHONE,
                        email:info[0].EMAIL
                    }
                });
    }else{
            res.status(500).json({
                code:500,
                msg:'内部错误，请重试'
            });
    }
})
return router;
}
module.exports=AuthServer;