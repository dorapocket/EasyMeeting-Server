<div align= "center">
<img align="center" src="screenshots/meetingroom.png" />
<h2 align="center" style="">EasyMeeting</h2>
<h3 align="center" style="">Server</h3>
<br/><br/>
</div>

## About Easymeeting

“会易”是一款专为会议室打造的智能会议解决方案。
“会易”支持会议室创建与管理、会议室预约、会议预约、签到、迟到抢占、无线投屏等多种功能。有自己的用户体系，并支持微信小程序绑定和扫码登陆。

Easymeeting is an meeting solution specially built for conference rooms.
Easymeeting supports various functions such as conference room creation and management, conference room reservation, meeting reservation, check-in, room preemption, wireless screen casting, etc. Has its own user system, and support wechat miniprogram binding and wechat scan login.

## About This Project
本工程是服务器代码。
This project is part of the Server code.

若要使用，请：
- 新建数据库，并把根目录下easymeeting.sql进行导入
- 重命名server_config.sample.json为server_config.json，并进行配置
- 运行调试

To use, please:
- Create a new database and import easyMeeting.sql from the root directory
- Rename server_config.sample.json to server_config.json and configure it
- Run debugging

## Develop


欢迎提pr或更好的idea！

Welcome to submit PR or better idea!

``` bash
# install dependencies
yarn install

# serve
yarn run start

# forever running
yarn run forever

```

---

This project was generated with [electron-vue](https://github.com/SimulatedGREG/electron-vue) using [vue-cli](https://github.com/vuejs/vue-cli). Documentation about the original structure can be found [here](https://simulatedgreg.gitbooks.io/electron-vue/content/index.html).
