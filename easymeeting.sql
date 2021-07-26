-- phpMyAdmin SQL Dump
-- version 5.1.0
-- https://www.phpmyadmin.net/
--
-- 主机： localhost
-- 生成日期： 2021-07-26 16:52:00
-- 服务器版本： 5.7.33-log
-- PHP 版本： 7.3.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `easymeeting`
--

-- --------------------------------------------------------

--
-- 表的结构 `activities`
--

CREATE TABLE `activities` (
  `AID` int(11) NOT NULL COMMENT '自增活动ID（i）',
  `MID` int(11) NOT NULL COMMENT '会议室ID（i）',
  `THEME` varchar(50) NOT NULL COMMENT '主题（v50）',
  `DATE` date NOT NULL COMMENT '日期（date）',
  `TIME_BEGIN` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '开始时间（ts）',
  `TIME_END` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT '结束时间（ts）',
  `MEMBER` text NOT NULL COMMENT '成员列表（t）',
  `REMARKS` text NOT NULL COMMENT '备注',
  `SPONSOR_UID` int(11) NOT NULL COMMENT '发起人UID（i）',
  `SPONSOR` varchar(50) NOT NULL COMMENT '真实姓名（v50）',
  `ARRIVED` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已经签到（bool）',
  `GRAB` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否被抢占',
  `CREATE_TIME` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='会议安排表';

-- --------------------------------------------------------

--
-- 表的结构 `devices`
--

CREATE TABLE `devices` (
  `DID` int(11) NOT NULL COMMENT '设备ID（i）',
  `MID` int(11) NOT NULL COMMENT '会议室ID 外键（i）',
  `ADMIN_UID` int(11) NOT NULL COMMENT '管理人UID 外键（i）',
  `EXTRA` varchar(500) DEFAULT NULL COMMENT '备注(v500)',
  `CREATE_TIME` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（dt）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='设备表';

-- --------------------------------------------------------

--
-- 表的结构 `login_status`
--

CREATE TABLE `login_status` (
  `TOKEN` varchar(100) NOT NULL COMMENT '分配的token（v100）',
  `UID` int(11) NOT NULL COMMENT '用户ID 外键（i）',
  `EXPIRED_TIME` timestamp NULL DEFAULT NULL COMMENT '过期时间(ts)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='登录状态';

-- --------------------------------------------------------

--
-- 表的结构 `meeting_rooms`
--

CREATE TABLE `meeting_rooms` (
  `MID` int(11) NOT NULL COMMENT '会议室ID(i)',
  `NAME` varchar(40) NOT NULL COMMENT '名称(v40)',
  `MAXPEOPLE` tinyint(4) NOT NULL COMMENT '会议室大小（max127）',
  `POSITION` varchar(100) NOT NULL COMMENT '位置（v100）',
  `DESCRIPTION` varchar(1000) NOT NULL COMMENT '描述（v1000）',
  `ADMIN_UID` int(11) NOT NULL COMMENT '管理员UID'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='会议室表';

-- --------------------------------------------------------

--
-- 表的结构 `messages`
--

CREATE TABLE `messages` (
  `ID` int(11) NOT NULL COMMENT '自增ID',
  `UID` int(11) NOT NULL COMMENT '用户ID（i）',
  `MSG_TYPE` varchar(50) NOT NULL COMMENT '模板消息类型（v50）',
  `READ_STATUS` tinyint(1) NOT NULL DEFAULT '0' COMMENT '操作状态（boo）',
  `LINK_ID` int(11) DEFAULT NULL COMMENT '可能相关的详细ID',
  `DATA` varchar(1000) DEFAULT NULL COMMENT '模板消息内容（v1000）',
  `CREATE_TIME` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='消息通知表';

-- --------------------------------------------------------

--
-- 表的结构 `users`
--

CREATE TABLE `users` (
  `UID` int(11) NOT NULL COMMENT '用户编号主键',
  `USER_NAME` varchar(50) NOT NULL COMMENT '姓名（var）',
  `REAL_NAME` varchar(50) NOT NULL COMMENT '真实姓名（v50）',
  `TELEPHONE` char(20) NOT NULL COMMENT '电话（20）',
  `EMAIL` varchar(50) NOT NULL COMMENT '邮箱（var）',
  `STATUS` tinyint(4) NOT NULL COMMENT '状态'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户信息表';

-- --------------------------------------------------------

--
-- 表的结构 `user_auths`
--

CREATE TABLE `user_auths` (
  `ID` int(11) NOT NULL COMMENT '自增id（i）',
  `UID` int(11) NOT NULL COMMENT '用户id 外键（i）',
  `IDENTITYTYPE` varchar(10) NOT NULL COMMENT '登陆类别（v10）',
  `IDENTIFIER` varchar(100) NOT NULL COMMENT '类型下的用户名（v100）',
  `CREDENTIAL` varchar(100) NOT NULL COMMENT '类型下的token（v100）',
  `ISVERIFIED` tinyint(1) NOT NULL COMMENT '是否验证'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户登录授权表';

-- --------------------------------------------------------

--
-- 表的结构 `user_meetings`
--

CREATE TABLE `user_meetings` (
  `ID` int(11) NOT NULL COMMENT '自增ID（i）',
  `UID` int(11) NOT NULL COMMENT '用户ID（i）',
  `AID` int(11) NOT NULL COMMENT '活动ID（i）',
  `CHECKED` tinyint(4) NOT NULL DEFAULT '0' COMMENT '接收状态(ti)',
  `USR_REPLY` varchar(100) DEFAULT NULL COMMENT '用户反馈(v)',
  `CHECKIN_STAT` tinyint(1) NOT NULL DEFAULT '0' COMMENT '签到标记（bool）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户会议表';

--
-- 转储表的索引
--

--
-- 表的索引 `activities`
--
ALTER TABLE `activities`
  ADD PRIMARY KEY (`AID`);

--
-- 表的索引 `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`DID`);

--
-- 表的索引 `login_status`
--
ALTER TABLE `login_status`
  ADD PRIMARY KEY (`TOKEN`);

--
-- 表的索引 `meeting_rooms`
--
ALTER TABLE `meeting_rooms`
  ADD PRIMARY KEY (`MID`);

--
-- 表的索引 `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`ID`);

--
-- 表的索引 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`UID`);

--
-- 表的索引 `user_auths`
--
ALTER TABLE `user_auths`
  ADD PRIMARY KEY (`ID`);

--
-- 表的索引 `user_meetings`
--
ALTER TABLE `user_meetings`
  ADD PRIMARY KEY (`ID`);

--
-- 在导出的表使用AUTO_INCREMENT
--

--
-- 使用表AUTO_INCREMENT `activities`
--
ALTER TABLE `activities`
  MODIFY `AID` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增活动ID（i）';

--
-- 使用表AUTO_INCREMENT `devices`
--
ALTER TABLE `devices`
  MODIFY `DID` int(11) NOT NULL AUTO_INCREMENT COMMENT '设备ID（i）';

--
-- 使用表AUTO_INCREMENT `meeting_rooms`
--
ALTER TABLE `meeting_rooms`
  MODIFY `MID` int(11) NOT NULL AUTO_INCREMENT COMMENT '会议室ID(i)';

--
-- 使用表AUTO_INCREMENT `messages`
--
ALTER TABLE `messages`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增ID';

--
-- 使用表AUTO_INCREMENT `users`
--
ALTER TABLE `users`
  MODIFY `UID` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户编号主键';

--
-- 使用表AUTO_INCREMENT `user_auths`
--
ALTER TABLE `user_auths`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增id（i）';

--
-- 使用表AUTO_INCREMENT `user_meetings`
--
ALTER TABLE `user_meetings`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增ID（i）';
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
