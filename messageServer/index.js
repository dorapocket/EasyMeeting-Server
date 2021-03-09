function MeetingServer(io) {
    var express = require('express');
    var router = express.Router();
    var Db = require('../utils/db');
    const Token = require('../utils/token');
    const DateUtils = require('../utils/date');
    const du = new DateUtils();
    const tokenManager = new Token();
    var db = new Db();
    const FEEDBACK_TYPE = {
        "NONE": 0,
        "CONFIRM": 1,
        "REJECT": 2,
    };
    async function handleMessageQuery(msg) {
        if (!msg || !msg.MSG_TYPE) return false;
        switch (msg.MSG_TYPE) {
            case "MEETING_NOTICE":
                const querySql = "SELECT * FROM activities a LEFT JOIN meeting_rooms m ON a.MID=m.MID WHERE a.AID=?";
                let exist = await db.query(querySql, [msg.LINK_ID]);
                if (exist.length > 0)
                    return {
                        msgId:msg.ID,
                        msgType:msg.MSG_TYPE,
                        aid: exist[0].AID,
                        mid: exist[0].MID,
                        mname: exist[0].NAME,
                        mpos:exist[0].POSITION,
                        theme: exist[0].THEME,
                        date: exist[0].DATE,
                        time_begin: exist[0].TIME_BEGIN.getTime(),
                        time_end: exist[0].TIME_END.getTime(),
                        member: exist[0].MEMBER,
                        remark: exist[0].REMARKS,
                        sponsor: exist[0].SPONSOR,
                        msgTime:msg.CREATE_TIME
                    }
                else return false;
        }
    }
    router.use('/unreadMessage', async function (req, res) {
        // 获取会议通知
        let d = tokenManager.parse(req.get('Authorization'));
        const querySQL = 'SELECT * FROM messages WHERE UID=? AND READ_STATUS=?';
        let result = await db.query(querySQL, [d.uid, 0]);
        let rtData = { code: 200, msg: "操作成功", data: [] };
        for (let i = 0; i < result.length; i++) {
            let temp = await handleMessageQuery(result[i]);
            if (!temp) break;
            rtData.data.push(temp);
        }
        res.status(200).json(rtData);
    });

    router.use('/historyMessage', async function (req, res) {
        let d = tokenManager.parse(req.get('Authorization'));
        const querySQL = 'SELECT * FROM messages WHERE UID=? AND READ_STATUS=? LIMIT 50';
        let result = await db.query(querySQL, [d.uid, 1]);
        let rtData = { code: 200, msg: "操作成功", data: [] };
        for (let i = 0; i < result.length; i++) {
            let temp = await handleMessageQuery(result[i]);
            if (!temp) break;
            rtData.data.push(temp);
        }
        res.status(200).json(rtData);
    });


    router.post('/messageFeedback', async function (req, res) {
        let d = tokenManager.parse(req.get('Authorization'));
        let { msgId, type, fb, reply = "" } = req.body;
        console.log(req.body);
        let updateSql = "UPDATE messages SET READ_STATUS=? WHERE ID=? AND UID=?";
        try {
            await db.query(updateSql, [1, msgId, d.uid]);
            switch (type) {
                case "MEETING_NOTICE":
                    let result = await db.query("SELECT * FROM messages WHERE ID=? AND UID=?", [msgId,d.uid]);
                    await db.query("UPDATE user_meetings SET CHECKED=?,USR_REPLY=? WHERE UID=? AND AID=?", [FEEDBACK_TYPE[fb], reply, d.uid, result[0].LINK_ID]);
                    break;
            }
            res.status(200).json({
                code: 200,
                msg: '操作成功',
            });
        } catch (e) {
            console.log(e);
            res.status(500).json({
                code: 500,
                msg: '内部服务器错误',
                data: [],
            });
        }
    });




    return router;
}
module.exports = MeetingServer