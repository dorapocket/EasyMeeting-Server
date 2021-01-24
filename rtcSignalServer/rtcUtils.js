function WebRTCConnection(socket,rc){
const crypto = require('crypto');
function getKey(username){
    let request_key = '0159efb52565fe55a54898954d0f95b9';
    let time=(Date.now()+1000*60*60*24).toString();
    let uname=time+':'+username;
    let hmac = crytpo.createHmac("sha1", request_key);
    let result = hmac.update(uname).digest("Base64");
    return {
        username:uname,
        credential:result
    }
}
  socket.on('CONFIG',(data)=>{
    let key=getKey(data.username);
    socket.emit({config:{
        iceServers: [
          {
            urls: "turn:turn.lgyserver.top:3478?transport=udp",
            username: key.username,
            credential: key.credential,
          },
          {
            urls: "turn:turn.lgyserver.top:3478?transport=tcp",
            username: key.username,
            credential: key.credential,
          },
          { urls: "stun:turn.lgyserver.top:3478" },
        ],
        iceCandidatePoolSize: 2,
      }});
  })

  console.log('[info] A new Client has connected. SID:',socket.id);

  socket.on('disconnect', function () {
    console.log('[info] A Client has disconnected. SID:',socket.id);
    try{
    // 掉线的是电视
    // TODO: 断线重连
    if(rc.isTV(socket.id)){
        let room=rc.getTV(socket.id).room;
        socket.broadcast.to(room).emit('TV_OFFLINE');
        socket.leave(room);
        rc.destroyRoom(room);
        console.warn('[warn] TV OFFLINE, room '+room+' will be destoryed.');
    }
    // 掉线的是客户端
    if(rc.isClient(socket.id)){
        // 如果已经加入房间
        let room=rc.getClient(socket.id).room;
        let user=rc.getClient(socket.id).username;
        socket.broadcast.to(room).emit('USER_OFFLINE',{
            user:user
        });
        /*
        if(rooms[room]){
            rooms[room].users.del(rooms[room].users.indexOf(user))
        }*/
        // TODO:从房间中删除用户
        socket.leave(room);
        rc.deleteClient(socket.id);
        console.warn('[warn] USER OFFLINE, user '+user+' will be removed from room '+room+'.');
    }
}catch(e){
        console.error('[erro] OFFLINE ERROR:',e);
    }
  });
  
  /*socket.on("SERVER_HELLO",(msg)=>{console.log(msg);})
  // 对客户发送过来的'message'事件进行处理
  socket.on('message', function (msg) {
    console.warn('[warn] Message Received. Socket.rooms:', socket.rooms);
    // namespace(nsp) > room > socketid (socketid装入room，room装入nsp)

    // 1、向指定的房间('abc')广播消息（包括当前连接的socket客户端）
    // io.of('/').to('abc').emit('message', '房间内所有人适用,包括自己');
    io.to('abc').emit('message', String(new Date().toLocaleTimeString()) + '房间内所有人适用,包括自己'); //在不知道nsp时默认为'/',与下面的等效
    // io.of('/').to('abc').emit('message', String(new Date().toLocaleTimeString()) + '房间内所有人适用,包括自己');

    // 2、全局广播消息（不包括当前连接的socket客户端）
    // 只有和当前socket同属于一个nsp(默认为'/')的socket客户端才可以收到消息
    socket.broadcast.emit('message', String(new Date().toLocaleTimeString()) + '全局广播消息（不包括当前连接的socket客户端）');

    //3、 向指定的房间广播信息（不包括当前连接的socket客户端）
    // 只有和当前socket同属于一个nsp(默认为'/')下'abc'房间内的socket客户端才可以收到消息
    socket.broadcast.to('abc').emit('message', String(new Date().toLocaleTimeString()) + '向指定的房间广播信息（不包括当前连接的socket客户端）');

    // 4、向当前连接的socket客户端发送消息(服务端->客户端 或者 客户端->服务端)
    socket.emit('message', '服务端->客户端')

    // 5、等效于socket.emit('message', '服务端->客户端')
    socket.send('服务端->客户端');  //Sends a 'message' event

  });
  */
  
  // 电视端注册
  socket.on('TV_REGISTER',(config)=>{
      let sroom=config.code;
      if(rc.roomExist(config.code)){
        sroom=rc.createRoom(socket.id);
      }
      socket.join(sroom);
      rc.setTV(socket.id,{
          room:sroom,
          socket:socket,
      });
      console.log('[info] TV register success code:',sroom);
      socket.emit('TV_REGISTER_SUCCESS',{
          projCode:sroom
      });
  });

  // 链接到电视端
  socket.on('CONNECT_TO_TV',data=>{
       console.log('[info] Client '+data.username+'  request to regist. Room '+data.projCode+'');
      if(rc.roomExist(data.projCode)){
          // 电视端存在
          socket.join(data.projCode);
        rc.setClient(socket.id,{
            socket:socket,
            room:data.projCode,
            username:data.username||'匿名',
        });
        rc.addClient(data.projCode,{
            username:data.username,
            id:socket.id,
            socket:socket
        });
        socket.emit('CONNECT_TO_TV_SUCCESS',{
              msg:'连接成功'
          });
        socket.broadcast.to(data.projCode).emit('NEW_CLIENT_JOIN', {
            username:data.username||'匿名'
        });
         
        console.log('[info] Client '+data.username+'  regist successfully. Room '+data.projCode+'');
      }else{
          // 电视端不存在
          socket.emit('CONNECT_TO_TV_FAILED',{
              msg:'投屏码错误：不存在对应的投影主机'
          });
          console.error('[erro] Client '+data.username+'  regist failed. Can not find Room '+data.projCode);
      }
  })
  // TODO 多人情况拿不同的socket
  // 客户端offer转发
  socket.on('RTC_Client_Offer_To_Server',data=>{
      console.log('[info] Received client offer, transmitting...');
      socket.broadcast.to(rc.getClient(socket.id).room).emit('RTC_Client_Offer_To_TV',data);
  });
  
  // TV端answer转发
  socket.on('RTC_TV_Answer_To_Server',data=>{
      console.log('[info] Received TV answer, transmitting...');
      socket.broadcast.to(rc.getTV(socket.id).room).emit('RTC_TV_Answer_To_Client',data);
  });
  
  // ICE交换
  socket.on('RTC_Candidate_Exchange',data=>{
      console.log('[info] ICE Candidate transmitting...');
      let currentroom;
      if(rc.isTV(socket.id)) currentroom=rc.getTV(socket.id).room;
      else currentroom=rc.getClient(socket.id).room;
      socket.broadcast.to(currentroom).emit('RTC_Candidate_Exchange',data);
  });

}

module.exports=WebRTCConnection;