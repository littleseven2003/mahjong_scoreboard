# 开发说明

本文档面向继续开发本项目时使用。

## 本地启动

面向使用者的部署包以 GitHub Release 为准。开发者可以直接克隆仓库进行本地开发；当前分支版本为 `v1.3.0-admin-alpha.1`，用于管理员与数据管理实验功能。

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run dev:server
```

后端默认监听：

```text
http://localhost:3100
```

如需本地测试管理员入口，启动后端前配置：

```bash
ADMIN_PASSWORD=dev-password ADMIN_SESSION_SECRET=dev-secret npm run dev:server
```

启动前端：

```bash
npm run dev:web
```

前端默认监听：

```text
http://localhost:8899
```

Vite 开发环境会把 `/api` 和 `/socket.io` 代理到后端。

## 构建验证

生产构建：

```bash
npm run build
```

后端语法检查：

```bash
node --check server/src/index.js
```

## 目录说明

```text
server/src/db.js
```

负责 SQLite 初始化、建表和事务封装。

```text
server/src/service.js
```

负责房间、玩家、记分、撤销、结算、历史记录等核心业务逻辑。分数计算应尽量集中在这里。

```text
server/src/admin.js
```

负责管理员登录 Token、管理数据查询、单条对局删除和已结束对局清理配置。

```text
server/src/index.js
```

负责 Fastify 路由、Socket.IO 连接和房间状态广播。

```text
web/src/api/client.ts
```

负责 REST API 请求、类型定义和 Socket.IO 客户端实例。

```text
web/src/stores/room.ts
```

负责当前房间状态、当前玩家身份、本地存储和实时同步。

```text
web/src/views/
```

负责页面视图：

- `HomeView.vue`：首页入口、继续对局、项目信息；
- `CreateRoomView.vue`：创建房间；
- `JoinRoomView.vue`：加入房间；
- `RoomView.vue`：等待、记分、结算；
- `HistoryView.vue`：历史列表；
- `HistoryDetailView.vue`：历史详情。

## 数据模型

当前 SQLite 表：

- `rooms`：房间；
- `players`：玩家；
- `transactions`：记分流水；
- `settlements`：结束结算。

数据库初始化逻辑在 `server/src/db.js`。项目当前没有迁移系统，后续如果数据模型变复杂，应增加迁移机制。

## 实时同步原则

Socket.IO 房间频道格式：

```text
room:{房间号}
```

客户端进入房间页后发送：

```text
room:join
```

后端在每次房间状态变化后广播：

```text
room:sync
```

前端收到完整房间状态后直接刷新本地状态。不要让前端自行推导最终分数。

## 提交规范

提交消息使用中文 Conventional Commit：

```text
feat: 实现快捷记分功能
fix: 修复房主身份丢失问题
docs: 更新使用说明
refactor: 调整房间服务结构
chore: 更新依赖配置
```

每次有实际代码或文档修改后，都需要提交并推送到 GitHub。

## 后续开发建议

优先级建议：

1. 优化移动端房间分享体验。
2. 增加一人收三家、一人赔三家的快捷记分。
3. 增加导出结算图片。
4. 增加 PWA 支持。
5. 引入数据库迁移和更完整的测试。
