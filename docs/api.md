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

只有房主可以开始对局。

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

后端会扣减付款方分数、增加收款方分数，并写入流水。

## 撤销上一笔

```http
POST /api/rooms/:code/undo
```

请求：

```json
{
  "playerId": 1
}
```

只有房主可以撤销。撤销会标记上一笔有效流水为已撤销，并回滚分数。

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
