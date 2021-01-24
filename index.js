const express = require('express');
const session=require("express-session");
const http = require('http');
const socketio = require('socket.io');
const app=express();
const server = http.createServer(app);
const io = socketio(server, { cors: true });
const RoomController=require('./rtcSignalServer/roomController');
const WebRTCConnection=require('./rtcSignalServer/rtcUtils');
const MessageSocketController=require('./messageController/socket');
const Token=require('./authServer/token');
const token=new Token();

var logger = require('morgan');//在控制台中，显示req请求的信息
var cookieParser = require('cookie-parser');//这就是一个解析Cookie的工具。通过req.cookies可以取到传过来的cookie，并把它们转成对象。
var cookie = require('cookie');
var bodyParser = require('body-parser');//node.js 中间件，用于处理 JSON, Raw, Text 和 URL 编码的数据。
var sessionManager=session({
  secret: "samantha",
   resave: false,
   saveUninitialized: true,
   cookie: ('name', 'value',{maxAge:  60*24*15*60*1000,secure: false})
});
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sessionManager);



console.log('[info] Server running, listening 65534.');
Array.prototype.del=function(n) {　//删除第n项
　if(n<0)
　　return this;
　else
　　return this.slice(0,n).concat(this.slice(n+1,this.length));
}
const roomController=new RoomController();
// 信令服务器加载
// TODO: TV端Token设置
io.of('/rtc').on('connection', (socket) => {
    socket.emit('VERIFY');
    socket.on('VERIFY_FEEDBACK',data=>{
      let d=token.parse(data);
      if(d&&d.expired_time<Date.now()){
        socket.emit('VERIFY_RESPONCE',{
          code:200,
          msg:'操作成功',
        });
        new WebRTCConnection(socket,roomController);
      }else{
        socket.emit('VERIFY_RESPONCE',{
          code:403,
          msg:'身份核验失败,请重新登录',
          config:null
        });
        console.warn('[warn] Client RTC connection FAILED. SID:',socket.id);
        socket.disconnect();
      }
    });
});

// 客户端鉴权服务器加载
const userRouter=require('./authServer/index');
app.use('/user',new userRouter());

// 客户端消息socket链接加载
io.of('/message').on('connection', (socket) => {
  socket.emit('VERIFY');
  socket.on('VERIFY_FEEDBACK',data=>{
    let d=token.parse(data);
    if(d&&d.expired_time<Date.now()){
      socket.emit('VERIFY_RESPONCE',{
        code:200,
        msg:'操作成功',
      });
      new MessageSocketController(socket);
    }else{
      socket.emit('VERIFY_RESPONCE',{
        code:403,
        msg:'身份核验失败,请重新登录',
        config:null
      });
      console.warn('[warn] Client Message connection FAILED. SID:',socket.id);
      socket.disconnect();
    }
  });
});

const meetingRouter=require('./meetingServer/index');
app.use('/meetings',new meetingRouter());

server.listen(65534);

/*
//解析请求参数
    var params = URL.parse(req.url, true).query;
      var addSqlParams = [params.id, params.name, params.sex];
      
      //增
    connection.query(addSql,addSqlParams,function (err, result) {
        if(err){
         console.log('[INSERT ERROR] - ',err.message);
         return;
        }             
    });
    
    //查
    connection.query(sql,function (err, result) {
        if(err){
          console.log('[SELECT ERROR] - ',err.message);
          return;
        }
        console.log(params.id);
        
        //把搜索值输出
       res.send(result);
    });
    */