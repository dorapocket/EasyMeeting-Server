function SocketController(uid,socket){
    var sockets={};
    // uid:socket
    this.getSocketByUid=function(uid){
        return sockets.uid||{};
    }
    this.setSocket=function(uid,socket){
        sockets.uid=socket;
        return true;
    }
}
module.exports=SocketController;