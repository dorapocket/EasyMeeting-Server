const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const sysConfig = require('./server_config.json');
const app = express();
var server;
var net;
if (sysConfig.SERVER.use_https) {
  net = require('https');
  const fs = require('fs');
  const options = {
    cert: fs.readFileSync(sysConfig.SERVER.https_cert),
    key: fs.readFileSync(sysConfig.SERVER.https_private_key),
  };
  server = net.createServer(options, app);
}else{
  net = require('http');
  server = net.createServer(app);
}
const io = socketio(server, { cors: true });
const RoomController = require('./rtcSignalServer/roomController');
const WebRTCConnection = require('./rtcSignalServer/rtcUtils');
const SocketController = require('./appSocket/socketController.js');
const AppSocketManager = require('./appSocket/appSocketManager.js');
const Token = require('./utils/token');
const token = new Token();
const socketControl = new SocketController();
const WX = require('./utils/wx');
const wxController = new WX();
var logger = require('morgan');//在控制台中，显示req请求的信息
var cookieParser = require('cookie-parser');//这就是一个解析Cookie的工具。通过req.cookies可以取到传过来的cookie，并把它们转成对象。
var cookie = require('cookie');
var bodyParser = require('body-parser');//node.js 中间件，用于处理 JSON, Raw, Text 和 URL 编码的数据。

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

var noAuthPage = ['/','/socket.io', '/user/login', '/user/register',
  '/wechat/getLoginImage', '/wechat/mplogin',
  '/deivce/validDeviceToken', '/device/getConfigImage'];
app.use(function (req, res, next) {
  var url = req.originalUrl;
  if (url.indexOf('?') != -1) {
    url = url.substr(0, url.indexOf("?"));
  }
  console.log(url);
  if (noAuthPage.indexOf(url) > -1) next();
  else {
    if (req.get('Authorization')) {
      let d = token.parse(req.get('Authorization'));
      // if(d&&typeof d == 'string') d=JSON.parse(d);
      if (d && d.expired_time > Date.now()) next();
      else {
        console.log(d);
        res.status(403).json({
          code: 403,
          msg: '禁止访问',
          data: []
        });
      }
    } else {
      res.status(401).json({
        code: 401,
        msg: '登陆过期或未登录，请先登录！',
        data: []
      });
    }
  }
})

Array.prototype.del = function (n) {　//删除第n项
  if (n < 0)
    return this;
  else
    return this.slice(0, n).concat(this.slice(n + 1, this.length));
}
const roomController = new RoomController();
// 信令服务器加载
// TODO: TV端Token设置
io.of('/rtc').on('connection', (socket) => {
  let timelimit = setTimeout(() => {
    console.warn("[warn] Time limit exceeded, cancel connection");
    socket.disconnect();
  }, 10000);

  socket.emit('VERIFY');
  socket.on('VERIFY_FEEDBACK', data => {
    clearTimeout(timelimit);
    let d = token.parse(data);
    if (d) {
      if (d.client_type == "client" && d.expired_time > Date.now()) {
        socket.emit('VERIFY_RESPONCE', {
          code: 200,
          msg: '操作成功',
        });
        console.log("RTC Client request received, verify success.");
        new WebRTCConnection(socket, roomController);
      } else if (d.client_type == "tv") {
        socket.emit('VERIFY_RESPONCE', {
          code: 200,
          msg: '操作成功',
        });
        console.log("RTC TV request received, verify success.");
        new WebRTCConnection(socket, roomController);
      } else {
        socket.emit('VERIFY_RESPONCE', {
          code: 403,
          msg: '身份核验失败,请重新登录',
          config: null
        });
        console.warn('[warn] Client RTC connection FAILED. SID:', socket.id);
        socket.disconnect();
      }


    } else {
      socket.emit('VERIFY_RESPONCE', {
        code: 403,
        msg: '身份核验失败,请重新登录',
        config: null
      });
      console.warn('[warn] Client RTC connection FAILED. SID:', socket.id);
      socket.disconnect();
    }
  });
});

// 客户端鉴权服务器加载
const userRouter = require('./authServer/index');
app.use('/user', new userRouter());


// 客户端消息socket链接加载
io.of('/message').on('connection', (socket) => {
  socket.emit('VERIFY');
  socket.on('VERIFY_FEEDBACK', data => {
    let d = token.parse(data);
    if (d && d.expired_time < Date.now()) {
      socket.emit('VERIFY_RESPONCE', {
        code: 200,
        msg: '操作成功',
      });
      socketControl.setSocket(d.uid, socket);
      new AppSocketManager(socket, socketControl);
    } else {
      socket.emit('VERIFY_RESPONCE', {
        code: 403,
        msg: '身份核验失败,请重新登录',
        config: null
      });
      console.warn('[warn] Client Message connection FAILED. SID:', socket.id);
      socket.disconnect();
    }
  });
});

const meetingRouter = require('./meetingServer/index');
app.use('/meetings', new meetingRouter(roomController));

const messageRouter = require('./messageServer/index');
app.use('/message', new messageRouter(io));

const deviceRouter = require('./deviceServer/index');
app.use('/device', new deviceRouter(io, wxController));

const wxRouter = require('./wxServer/index');
app.use('/wechat', new wxRouter(io, wxController));

server.listen(sysConfig.LISTEN_PORT);
console.log('[info] Server running, listening ' + sysConfig.LISTEN_PORT + '.');
console.log('HTTPS mode:',sysConfig.SERVER.use_https);