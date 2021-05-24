
function Mail(){
    let config=require('../server_config.json');
    const nodemailer = require('nodemailer');
    let transporter = nodemailer.createTransport({
        host: config.MAIL.HOST,
        port: config.MAIL.PORT, // SMTP 端口
        secureConnection: true, // 使用了 SSL
        auth: {
          user: config.MAIL.USER,
          // 这里密码不是qq密码，是你设置的smtp授权码，去qq邮箱后台开通、查看
          pass: config.MAIL.PASS,
        }
      });
    this.sendMeetingMail = function(to,contentObj) {
        let options={
            from:'"EasyMeeting通知" <easymeeting@dorapocket.top>',
            to:to,
            subject:'会议通知',
            html:`<div style="width:660px;overflow:hidden;border:1px solid #e2e2e4;border-width:0 1px 1px;text-align:left;word-wrap:break-word;word-break:break-all;color:#444;font:normal 13px/20px arial;background:#fff;">
            <div style="width:660px;overflow:hidden;border-bottom:1px solid #bdbdbe;">
                
                <div style="height:52px;overflow:hidden;border:1px solid #6cae2b;background:#6cae2b ;">
                    <h1 class="STYLE2">
                         EasyMeeting 会议通知</h1>
                </div>
                
                <div style="padding:24px 28px;">
                    <div style="margin:0 0 18px;">
                        亲爱的${contentObj.to}:</div>
                    <div style="margin:0 0 18px;">
                        ${contentObj.from}邀请你于北京时间${contentObj.datetime}在${contentObj.mname}(地址：${contentObj.mpos})参加主题为${contentObj.theme}的会议，请提前准备好参加会议。祝您参会顺利！</div>
                    <div style="margin:0 0 18px;">
                        请在会议前仔细检查需要准备的材料，若有时间冲突请尽快反馈！</div>
                    <div style="margin:0 0 18px;">
                        为了统计参会情况，请务必尽快登录系统确认是否接受此次会议邀请。</div>
                
                    <div style="margin:0 0 18px;">
                        你可以扫描以下二维码进行确认：</div>
                    <img src="http://turn.lgyserver.top/mp.jpg" width="200">
                    <div style="margin:15px 0">
                        <div>
                            <a href="#" style="text-decoration:none;color:#444;" target="_blank" rel="noopener">EasyMeeting 会易</a></div>
                    </div>
                </div>
            </div>
        </div>`
        };
        transporter.sendMail(options,(err,info)=>{
            if(err){
                console.error(err);
            }
            console.log(info);
        })
    }

    this.sendGrabMail = function(to,contentObj) {
        let options={
            from:'"EasyMeeting通知" <easymeeting@dorapocket.top>',
            to:to,
            subject:'会议室被抢占通知',
            html:`<div style="width:660px;overflow:hidden;border:1px solid #e2e2e4;border-width:0 1px 1px;text-align:left;word-wrap:break-word;word-break:break-all;color:#444;font:normal 13px/20px arial;background:#fff;">
            <div style="width:660px;overflow:hidden;border-bottom:1px solid #bdbdbe;">
                
                <div style="height:52px;overflow:hidden;border:1px solid #6cae2b;background:#6cae2b ;">
                    <h1 class="STYLE2">
                         EasyMeeting 抢占通知</h1>
                </div>
                
                <div style="padding:24px 28px;">
                    <div style="margin:0 0 18px;">
                        亲爱的${contentObj.to}:</div>
                    <div style="margin:0 0 18px;">
                        由于您没有及时签到，为了保证会议室资源利用最大化，${contentObj.from}已经抢占了您在${contentObj.datetime}预约的主题为${contentObj.theme}的会议，请您知晓。</div>
                    <div style="margin:0 0 18px;">
                    若多次预约会议室但未及时签到，可能会影响您的后续预约，请您注意及时签到。</div>
                    <div style="margin:0 0 18px;">
                        若有疑问，您可以联系抢占者进行交涉询问。</div>
                
                    <div style="margin:0 0 18px;">
                        你可以扫描以下二维码进入小程序继续预约会议：</div>
                    <img src="http://turn.lgyserver.top/mp.jpg" width="200">
                    <div style="margin:15px 0">
                        <div>
                            <a href="#" style="text-decoration:none;color:#444;" target="_blank" rel="noopener">EasyMeeting 会易</a></div>
                    </div>
                </div>
            </div>
        </div>`
        };
        transporter.sendMail(options,(err,info)=>{
            if(err){
                console.error(err);
            }
            console.log(info);
        })
    }


    }
module.exports=Mail;