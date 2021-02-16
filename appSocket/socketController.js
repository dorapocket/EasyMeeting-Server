function SocketController(uid,socket){
    var sockets={
        'wxs':{}, // 微信Socket
        'rtc':{}, // RTC Socket
        'client':{} // client Socket
    };
    // uid:socket
    this.getClientSocketByUid=function(uid){
        return sockets.uid||{};
    }
    this.setWXSocket=function(socket){
        try{
            sockets.wxs[socket.id]=socket;
        }catch(e){
            console.log(e);
        }
        return true;
    }
}
module.exports=SocketController;