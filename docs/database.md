# 数据模型（v0.1）

所有读写都通过云函数，客户端不直连集合。

## runners（跑者）

```text
_openid       微信 openid（手动写入）
nickname      昵称（必填，发布/加入前置条件）
avatarUrl     头像 URL
intro         一句话介绍
paceLevel     自己平时的强度档
spotIds       常跑点 ID 列表（1–5 个）
runCount      完成约跑次数（发起人或参与者）
absenceCount  爽约次数
createdAt / updatedAt
```

## runSpots（受管跑点）

```text
name / address / district / city / lat / lng
status        active | inactive（新申请先 pending 于 spotRequests）
sort          展示排序
```

## posts（约跑帖）

```text
city               杭州
spotId / spot      跑点快照（含坐标，便于单次定位排序）
organizerOpenid    发起人 openid
organizer          发起人资料快照
startTime          开跑时间（毫秒时间戳）
participantsLimit  人数上限（2–5，含发起人）
mileageBand        里程档
intensityLevel     强度档
description        补充说明
status             recruiting | full | canceled | completed
joinClosed         发起人是否已停止加入
participants       加入者列表：[openid, nickname, avatarUrl, intro, joinedAt, status]
absentees          爽约历史：[openid, nickname, absentAt, reason]
comments           帖内动态：[openid, nickname, avatarUrl, text, createdAt]
createdAt / updatedAt / completedAt
```

`participants.status`：`joined` → `attended | absent`。自由退出会从 `participants` 移除且不留记录；开跑前 2 小时内退出会进入 `absentees`（reason: late-leave）；跑后未到场进入 `absentees`（reason: no-show）。

## spotRequests（新跑点申请）

```text
name / city / requesterOpenid / requesterNickname / status(pending) / createdAt
```

## 爽约/成行记录的隐私边界

`absenceCount` 与 `runCount` 都存在跑者自己名下。自己的页面可见全部；对其他人，成行次数可以展示，爽约次数不在公开资料页展示，只在未来的发起/加入相关动作中按业务需要暴露（v0.1 尚未做该展示界面，仅保证数据按此建模）。
