function MeetingServer(){
    var express = require('express');
    var router = express.Router();
    var Db=require('../utils/db');
    const Token=require('../authServer/token');
    const tokenManager=new Token();
    var db=new Db();

    // 获取用户会议列表
    router.use('/getMeetingList',async function(req,res){
        const {token}=req.query;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            const querySql="SELECT * FROM (( activities LEFT JOIN user_meetings ON activities.AID=user_meetings.AID ) LEFT JOIN meeting_rooms ON activities.MID=meeting_rooms.MID) WHERE activities.UID=?";
            let exist=await db.query(querySql,[d.uid]);
                let obj={code:200,msg:"操作成功",data:[]};
                for(let i=0;i<exist.length;i++){
                    obj.data.push({
                        aid:exist[i].AID,
                        mid:exist[i].MID,
                        mname:exist[i].NAME,
                        theme:exist[i].THEME,
                        date:exist[i].DATE,
                        time_begin:exist[i].TIME_BEGIN,
                        time_end:exist[i].TIME_END,
                        member:exist[i].MEMBER,
                        remark:exist[i].REMARKS,
                        sponsor:exist[i].SPONSOR,
                    });
                }
                res.json(obj);
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    
    });

    // 获取单个会议信息
    router.use('/getMeetingById',async function(req,res){
        const {token,aid}=req.query;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            const querySql="SELECT * FROM (( activities LEFT JOIN user_meetings ON activities.AID=user_meetings.AID ) LEFT JOIN meeting_rooms ON activities.MID=meeting_rooms.MID) WHERE activities.AID=?";
            let exist=await db.query(querySql,[aid]);
                let obj={code:200,msg:"操作成功",data:[]};
                for(let i=0;i<exist.length;i++){
                    obj.data.push({
                        aid:exist[i].AID,
                        mid:exist[i].MID,
                        mname:exist[i].NAME,
                        theme:exist[i].THEME,
                        date:exist[i].DATE,
                        time_begin:exist[i].TIME_BEGIN,
                        time_end:exist[i].TIME_END,
                        member:exist[i].MEMBER,
                        remark:exist[i].REMARKS,
                        sponsor:exist[i].SPONSOR,
                    });
                }
                res.json(obj);
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    
    });

    // 创建会议
    router.post('/createMeeting',async function(req,res){
        const {token,theme,mid,date,time_begin,time_end,member,remark}=req.body;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            // TODO: 验证是否有会议重叠
            const verifySQL='SELECT AID,THEME,SPONSER,TIME_BEGIN, TIME_END FROM activities WHERE MID=? AND DATE=?';
            let vers=await db.query(verifySQL,[mid,date]);
            for(let i=0;i<vers.length;i++){
                if((vers[i].TIME_BEGIN<time_begin&&vers[i].TIME_END>time_begin)||(vers[i].TIME_BEGIN<time_end&&vers[i].TIME_END>time_end)){
                    res.status(400).json({
                        code:400,
                        msg:"会议冲突",
                        data:{
                            aid:vers[i].AID,
                            theme:vers[i].THEME,
                            sponser:vers[i].SPONSER,
                            date:vers[i].DATE,
                            time_begin:vers[i].TIME_BEGIN,
                            time_end:vers[i].TIME_END
                        }
                    });
                    return;
                }
            }
            // TODO: 数据预处理
            const querySQL='INSERT INTO activities (MID, THEME, DATE, TIME_BEGIN, TIME_END, MEMBER, REMARKS, SPONSOR,SPONSOR_UID) VALUES (?,?,?,?,?,?,?,?,?,?)';
            const umSQL='INSERT INTO user_meetings (UID,AID,CHECKED) VALUES (?,?,?)';
            let stat=await db.query(querySQL,[mid,theme,date,time_begin,time_end,member,remark,d.realname,d.uid]);
            
            // TODO: 插入用户活动表，member是个数组，待协商
            // 单独处理发起人
            await db.query(umSQL,[d.uid,stat.insertId,true]);
            for(let i=0;i<member.length;i++){
                await db.query(umSQL,[member[i].uid,stat.insertId,false]);
            }
            res.status(200).json({
                code:200,
                msg:"创建成功",
            });
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    });

    // 编辑会议
    router.post('/editMeeting',async function(req,res){
        const {token,aid,theme,mid,date,time_begin,time_end,member,remark}=req.body;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            let activity=await db.query('SELECT SPONSOR_UID FROM activities WHERE AID=?',[aid]);
            if(activity.length!=0){
                if(activity[0].SPONSOR_UID==d.uid){
                    const querySQL='UPDATE activities SET MID=?, THEME=?, DATE=?, TIME_BEGIN=?, TIME_END=?, MEMBER=?, REMARKS=? WHERE AID=?';
                    await db.query(querySQL,[mid,theme,date,time_begin,time_end,member,remark,d.realname,aid]);
                    res.status(200).json({
                        code:200,
                        msg:'修改成功',
                        data:[{aid,}]
                    });
                }else{
                    res.status(400).json({
                        code:400,
                        msg:'您不是会议的发起人，无法修改此会议',
                        data:[]
                    });
                }
            }else{
                res.status(400).json({
                    code:400,
                    msg:'错误的会议ID：Bad Request（400）',
                    data:[]
                });
            }
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    });

    // 删除会议
    router.post('/deleteMeeting',async function(req,res){
        const {token,aid}=req.body;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            let activity=await db.query('SELECT SPONSOR_UID FROM activities WHERE AID=?',[aid]);
            if(activity.length!=0){
                if(activity[0].SPONSOR_UID==d.uid){
                    const querySQL='DELETE FROM activities WHERE AID=?';
                    const querySQL2='DELETE FROM user_meetings WHERE AID=?';
                    await db.query(querySQL,[aid]);
                    await db.query(querySQL2,[aid]);
                    res.status(200).json({
                        code:200,
                        msg:'删除成功',
                        data:[{aid,}]
                    });
                }else{
                    res.status(400).json({
                        code:400,
                        msg:'您不是会议的发起人，无法删除此会议',
                        data:[]
                    });
                }
            }else{
                res.status(400).json({
                    code:400,
                    msg:'错误的会议ID：Bad Request（400）',
                    data:[]
                });
            }
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    });

    // 获取会议室
    router.post('/getMeetingRoomList',async function(req,res){
        const {token}=req.body;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            const querySQL='SELECT * FROM meeting_rooms';
            let result=await db.query(querySQL,[]);
            let obj={code:200,msg:"操作成功",data:[]};
            for(let i=0;i<result.length;i++){
                obj.data.push({
                    mid:result[i].MID,
                    name:result[i].NAME,
                    max_people:result[i].MAXPEOPLE,
                    position:result[i].POSITION,
                    description:result[i].DESCRIPTION,
                });
            }
            res.status(200).json(obj);
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    });

    // 获取会议室时间安排表
    router.post('/getMeetingRoomActivities',async function(req,res){
        const {token,mid,date}=req.body;
        let d=tokenManager.parse(token);
        if(d&&d.expired_time<Date.now()){
            const querySQL='SELECT * FROM activities WHERE MID=? AND DATE=?';
            // TODO: date参数格式待协商
            let result=await db.query(querySQL,[mid,date]);
            let obj={code:200,msg:"操作成功",data:[]};
            for(let i=0;i<result.length;i++){
                obj.data.push({
                    aid:result[i].AID,
                    theme:result[i].THEME,
                    time_begin:result[i].TIME_BEGIN,
                    time_end:result[i].TIME_END,
                    sponser:result[i].SPONSER
                });
            }
            res.status(200).json(obj);
        }else{
            res.status(401).json({
                code:401,
                msg:'登陆过期或未登录，请先登录！',
                data:[]
            });
        }
    });

    
}
module.exports=MeetingServer