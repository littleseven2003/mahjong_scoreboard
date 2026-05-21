# API 概览

本文档记录后端 REST API 与 Socket.IO 事件。

默认后端地址：

```text
http://localhost:3100
```

Docker 部署后，前端通过 Nginx 代理访问：

```text
/api
/socket.io
```

## 通用约定

请求和响应使用 JSON。

错误响应格式：

```json
{
  "error": "错误信息"
}
```

房间号统一使用 6 位大写字符。

## 健康检查

```http
GET /api/health
```

响应示例：

```json
{
  "ok": true,
  "service": "mahjong_scoreboard",
  "time": "2026-05-18T00:00:00.000Z"
}
```

## 创建房间

```http
POST /api/rooms
```

请求：

```json
{
  "playerCount": 4,
  "name": "今晚这桌",
  "initialScore": 1000,
  "scoreRate": 10,
  "allowNegative": true,
  "ownerNickname": "东"
}
```

响应：

```json
{
  "state": {
    "room": {},
    "players": [],
    "transactions": [],
    "settlements": []
  },
  "playerId": 1
}
```

`playerId` 是当前浏览器玩家身份，前端会保存到本地存储。

## 加入房间

```http
POST /api/rooms/:code/join
```

请求：

```json
{
  "nickname": "南"
}
```

响应同创建房间。

## 获取房间状态

```http
GET /api/rooms/:code
```

响应：

```json
{
  "room": {
    "id": 1,
    "code": "ABC123",
    "name": "今晚这桌",
    "status": "waiting",
    "playerCount": 4,
    "initialScore": 1000,
    "scoreRate": 10,
    "allowNegative": true
  },
  "players": [],
  "transactions": [],
  "settlements": []
}
```

`status` 可选值：

```text
waiting
playing
finished
```

## 开始对局

```http
POST /api/rooms/:code/start
```

请求：

```json
{
  "playerId": 1
}
```

只有房主可以开始对局。开始对局要求当前玩家数达到房间人数，并且所有非房主玩家都已准备。

## 准备或取消准备

```http
POST /api/rooms/:code/ready
```

请求：

```json
{
  "playerId": 2,
  "isReady": true
}
```

只有等待阶段的非房主玩家可以准备或取消准备。

## 退出等待房间

```http
POST /api/rooms/:code/leave
```

请求：

```json
{
  "playerId": 2
}
```

只有等待阶段的非房主玩家可以退出。退出后该玩家记录会被删除，对应昵称可以被其他设备重新使用。

## 解散房间

```http
POST /api/rooms/:code/disband
```

请求：

```json
{
  "playerId": 1
}
```

只有房主可以在等待阶段解散房间。解散后，后端会通过 Socket.IO 广播 `room:disbanded`，所有在房间内的客户端收到提示并返回首页。

## 记分

```http
POST /api/rooms/:code/transfer
```

请求：

```json
{
  "fromPlayerId": 1,
  "toPlayerId": 2,
  "amount": 20,
  "remark": "点炮",
  "createdBy": 1
}
```

后端会扣减扣分玩家分数、增加加分玩家分数，并写入流水。非房主只能以自己作为扣分玩家。

## 确认撤销指定流水

```http
POST /api/rooms/:code/transactions/:transactionId/undo-confirm
```

请求：

```json
{
  "playerId": 1
}
```

只有该笔流水的扣分玩家和加分玩家可以确认撤销。第一次调用会创建撤销申请并记录当前玩家确认；另一方确认后，后端会标记该流水为已撤销并回滚双方分数。

## 取消撤销指定流水

```http
POST /api/rooms/:code/transactions/:transactionId/undo-cancel
```

请求：

```json
{
  "playerId": 2
}
```

只有该笔流水的扣分玩家和加分玩家可以取消撤销。取消后，本次撤销申请会失效，双方确认状态会被清空。

## 结束结算

```http
POST /api/rooms/:code/finish
```

请求：

```json
{
  "playerId": 1
}
```

只有房主可以结束对局。结束后会生成 `settlements`。

## 历史列表

```http
GET /api/history
```

只返回已结束房间。

## 历史详情

```http
GET /api/history/:id
```

返回指定历史房间的完整状态，包括玩家、流水和结算。

## 管理员登录

```http
POST /api/admin/login
```

请求：

```json
{
  "password": "管理员密码"
}
```

响应：

```json
{
  "token": "管理员Token",
  "expiresAt": "2026-05-21T12:00:00.000Z"
}
```

管理员密码通过服务端 `ADMIN_PASSWORD` 环境变量配置。未配置时，管理员登录不可用。

后续管理员接口需要携带：

```http
Authorization: Bearer 管理员Token
```

## 管理概览

```http
GET /api/admin/summary
```

返回对局、玩家、流水、结算数量和维护任务配置。

## 管理对局列表

```http
GET /api/admin/rooms
```

返回当前数据库中的对局列表，包括房间号、状态、玩家数量、流水数量和最后活跃时间。

## 管理对局详情

```http
GET /api/admin/rooms/:id
```

返回指定对局的完整状态，包括玩家、流水和结算。

## 删除对局

```http
DELETE /api/admin/rooms/:id
```

删除指定对局，并通过数据库外键级联删除该对局的玩家、流水和结算数据。该操作不可恢复。

## 维护任务配置

```http
GET /api/admin/maintenance
PUT /api/admin/maintenance
```

配置示例：

```json
{
  "cleanupEnabled": true,
  "cleanupFinishedDays": 30,
  "cleanupIntervalHours": 24
}
```

当前自动清理仅删除已结束且超过保留天数的对局。

## 立即清理

```http
POST /api/admin/maintenance/cleanup
```

立即执行一次已结束对局清理。

## Socket.IO 事件

### room:join

客户端进入房间页后发送：

```json
{
  "roomCode": "ABC123"
}
```

后端会把 socket 加入：

```text
room:ABC123
```

### room:leave

客户端离开房间时可发送：

```json
{
  "roomCode": "ABC123"
}
```

### room:sync

后端在房间状态变化后广播完整房间状态：

```json
{
  "room": {},
  "players": [],
  "transactions": [],
  "settlements": []
}
```

前端收到后应直接刷新状态，不应自行计算最终分数。
