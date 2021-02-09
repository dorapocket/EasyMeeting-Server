function MeetingServer(){
    var express = require('express');
    var router = express.Router();
    var Db=require('../utils/db');
    const Token=require('../authServer/token');
    const DateUtils=require('../utils/date');
    const du=new DateUtils();
    const tokenManager=new Token();
    var db=new Db();

    // 获取用户会议列表
    router.use('/getMeetingList',async function(req,res){
        let d=tokenManager.parse(req.get('Authorization'));
            const querySql="SELECT DISTINCT a.*,m.NAME FROM (activities as a LEFT JOIN user_meetings as u ON a.AID=u.AID LEFT JOIN meeting_rooms m ON a.MID=m.MID) WHERE UID=? AND DATE >= ?";
            let exist=await db.query(querySql,[d.uid,du.dateFormat(new Date(),"yyyy-MM-dd")]);
                let obj={code:200,msg:"操作成功",today:0,data:[]};
                for(let i=0;i<exist.length;i++){
                    obj.data.push({
                        aid:exist[i].AID,
                        mid:exist[i].MID,
                        mname:exist[i].NAME,
                        theme:exist[i].THEME,
                        date:exist[i].DATE.getTime(),
                        time_begin:exist[i].TIME_BEGIN.getTime(),
                        time_end:exist[i].TIME_END.getTime(),
                        members:exist[i].MEMBER,
                        remark:exist[i].REMARKS,
                        sponsor:exist[i].SPONSOR,
                        sponsor_uid:exist[i].SPONSOR_UID
                    });
                    if(du.dateFormat(exist[i].DATE,"yyyy-MM-dd")==du.dateFormat(new Date(),"yyyy-MM-dd")) obj.today++;
                }
                res.json(obj);
    });

    // 获取单个会议信息
    router.use('/getMeetingById',async function(req,res){
        const {aid}=req.query;
        let d=tokenManager.parse(req.get('Authorization'));
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
                        time_begin:exist[i].TIME_BEGIN.getTime(),
                        time_end:exist[i].TIME_END.getTime(),
                        member:exist[i].MEMBER,
                        remark:exist[i].REMARKS,
                        sponsor:exist[i].SPONSOR,
                    });
                }
                res.json(obj);
    
    });

    // 创建会议
    router.post('/createMeeting',async function(req,res){
        try{
        const {theme,mid,date,time_begin,time_end,member,remark}=req.body;
        let d=tokenManager.parse(req.get('Authorization'));
        if(time_begin>time_end){
            res.status(403).json({
                code:403,
                msg:'非法请求，请检查提交的信息是否有错误！',
                data:[]
            });
            return;
        }
            const verifySQL="SELECT AID,THEME,SPONSOR,TIME_BEGIN, TIME_END FROM activities WHERE MID=? AND DATE=STR_TO_DATE(?,'%Y-%m-%d')";
            let vers=await db.query(verifySQL,[mid,date]);
            for(let i=0;i<vers.length;i++){
                console.log(vers[i].TIME_BEGIN.getTime(),vers[i].TIME_END.getTime());
                if(
                (vers[i].TIME_BEGIN.getTime()<=time_begin&&time_begin<=vers[i].TIME_END.getTime()&&vers[i].TIME_END.getTime()<=time_end)||
                (time_begin<=vers[i].TIME_BEGIN.getTime()&&vers[i].TIME_BEGIN.getTime()<=time_end&&time_end<=vers[i].TIME_END.getTime())||
                (vers[i].TIME_BEGIN.getTime()<=time_begin&&time_begin<=time_end&&time_end<=vers[i].TIME_END.getTime())||
                (time_begin<=vers[i].TIME_BEGIN.getTime()&&vers[i].TIME_BEGIN.getTime()<=vers[i].TIME_END.getTime()&&vers[i].TIME_END.getTime()<=time_end)){
                    res.status(400).json({
                        code:400,
                        msg:"会议冲突",
                        data:{
                            aid:vers[i].AID,
                            theme:vers[i].THEME,
                            sponsor:vers[i].SPONSOR,
                            date:vers[i].DATE,
                            time_begin:vers[i].TIME_BEGIN.getTime(),
                            time_end:vers[i].TIME_END.getTime()
                        }
                    });
                    return;
                }
            }
            // TODO: 数据预处理
            const querySQL="INSERT INTO activities (MID, THEME, DATE, TIME_BEGIN, TIME_END, MEMBER, REMARKS, SPONSOR,SPONSOR_UID) VALUES (?,?,STR_TO_DATE(?,'%Y-%m-%d'),?,?,?,?,?,?)";
            const umSQL='INSERT INTO user_meetings (UID,AID,CHECKED) VALUES (?,?,?)';
            let stat=await db.query(querySQL,[mid,theme,date,du.dateFormat(new Date(time_begin),"yyyy-MM-dd hh:mm:ss"),du.dateFormat(new Date(time_end),"yyyy-MM-dd hh:mm:ss"),member,remark,d.realname,d.uid]);
             // 单独处理发起人
            await db.query(umSQL,[d.uid,stat.insertId,true]);
            let users=JSON.parse(member);
            for(user of users){
                let obj=JSON.parse(user);
                // TODO: 发送消息提醒 obj.uid,obj.realname
                await db.query(umSQL,[obj.uid,stat.insertId,false]); //设置用户会议
            }
            res.status(200).json({
                code:200,
                msg:"创建成功",
            });
    }catch(e){
        console.log(e);
        res.status(500).json({
            code:500,
            msg:'啊哦，出现了一点问题，给您带来的麻烦我们深表歉意，请稍后重试！',
            data:[]
        });
    }
    });

    // 编辑会议
    router.post('/editMeeting',async function(req,res){
        const {aid,theme,mid,date,time_begin,time_end,member,remark}=req.body;
        let d=tokenManager.parse(req.get('Authorization'));
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
    });

    // 删除会议
    router.use('/deleteMeeting',async function(req,res){
        const {aid}=req.query;
        let d=tokenManager.parse(req.get('Authorization'));
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
    });

    // 获取会议室
    router.use('/getMeetingRoomList',async function(req,res){
        let d=tokenManager.parse(req.get('Authorization'));
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
    });

    // 获取会议室时间安排表
    router.post('/getMeetingRoomActivities',async function(req,res){
        const {mid,date}=req.body;
        let d=tokenManager.parse(req.get('Authorization'));
            const querySQL='SELECT * FROM activities WHERE MID=? AND DATE=?';
            // TODO: date参数格式待协商 2020-01-01
            let result=await db.query(querySQL,[mid,date]);
            let obj={code:200,msg:"操作成功",data:[]};
            for(let i=0;i<result.length;i++){
                obj.data.push({
                    aid:result[i].AID,
                    theme:result[i].THEME,
                    time_begin:result[i].TIME_BEGIN.getTime(),
                    time_end:result[i].TIME_END.getTime(),
                    sponsor:result[i].SPONSOR,
                    sponsor_aid:result[i].SPONSOR_UID
                });
            }
            res.status(200).json(obj);
    });

    // 获取参会人
    router.use('/getAllUsers',async function(req,res){
        let d=tokenManager.parse(req.get('Authorization'));
            const querySQL='SELECT UID,USER_NAME,REAL_NAME FROM users';
            let result=await db.query(querySQL,[]);
            let obj={code:200,msg:"操作成功",data:[]};
            for(let i=0;i<result.length;i++){
                obj.data.push({
                    uid:result[i].UID,
                    realname:result[i].REAL_NAME,
                    username:result[i].USER_NAME,
                });
            }
            res.status(200).json(obj);
    });

    return router;
}
module.exports=MeetingServer