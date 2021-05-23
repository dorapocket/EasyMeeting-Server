function RoomController(){
var tv={};
//{id:{socket,room,status}}
var client={};
//{id:{socket,room,username}}
var rooms={};
//{code:{users:[{id,username}],tv:tvid,mid:mid}}
var mid2socket={};
//{mid:socket};
const TV_STATUS={
    CONNECT:1,
    DISCONNECT:2
};

this.generateCode=function() {
      var len = 6;
      var $chars =
        "ABCDEFGHJKMNPQRSTWXYZ012345678"; /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
      var maxPos = $chars.length;
      var code = "";
      for (var i = 0; i < len; i++) {
        code += $chars.charAt(Math.floor(Math.random() * maxPos));
      }
      return code;
}
this.validCode=function(code){
    if(!code||!code=='undefined'||code.length!=6) return false
    return true
}
this.createRoom=(id,codeExpect)=>{
    let code=codeExpect;
    while(!this.validCode(code)||rooms[code]){
        //if(rooms[code].users.length==0) break;
        code=this.generateCode();
    }
    rooms[code]={
        users:[],
        tv:id
    }
    return code;
}
this.getTV=function(sid){
    return tv[sid];
}
this.getClient=function(sid){
    return client[sid];
}
this.getRoom=function(room){
    return rooms[room];
}
this.setTV=function(sid,data){
    try{
    tv[sid]={
        socket:data.socket || tv[sid].socket,
        room:data.room || tv[sid].room,
       // status:data.status || tv[sid].status 
    }
    return true;
    }catch(e){
        return false;
    }
}
this.setClient=function(sid,data){
    try{
    client[sid]={
        socket:data.socket || client[sid].socket,
        room:data.room || client[sid].room,
        username:data.username || client[sid].username,
    }
    return true;
    }catch(e){
        return false;
    }
}
this.addClient=function(room,userdata){
    rooms[room].users.push(userdata);
    // TODO:当用户重名或已经存在处理，增加uid？
}
this.removeClient=function(room,id){
    // TODO
}
this.destroyRoom=function(room){
    let mid=rooms[room].mid;
    delete mid2socket[mid];
    delete rooms[room];
}

this.isTV=function(sid){
    return !!tv[sid];
}
this.isClient=function(sid){
    return !!client[sid];
}
this.deleteClient=function(sid){
    delete client[sid];
}
this.roomExist=function(room){
    return !!rooms[room];
}
this.bindTVandRoom=function(mid,roomid,socket){
    if(mid2socket[mid]){
        try{
            mid2socket[mid].disconnect();
            delete mid2socket[mid];
        }catch(e){}
    }
    mid2socket[mid]=socket;
    rooms[roomid].mid=mid;
}
this.sendCommand=function(mid,cmd,data){
    if(!mid2socket[mid]) break;
    let socket=mid2socket[mid];
    socket.emit("COMMAND",{
        cmd:cmd,
        data:data
    });
}
}
module.exports=RoomController;
