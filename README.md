# mahjong_scoreboard

中文名：麻将桌计分器。

`mahjong_scoreboard` 是一个面向家庭娱乐麻将桌场景的轻量级实时计分与结算 Web 应用。项目优先支持绿联云 NAS / Docker Compose 部署，用户在局域网内通过手机浏览器访问同一个房间，实时查看分数、流水和结算结果。

## 功能范围

当前已实现：

- 创建三人或四人房间
- 从首页继续进入未完成对局，超时对局可删除本机入口
- 玩家通过房间号和昵称加入
- 设置起始分、计分单位、是否允许负分
- 房主开始对局
- 记录“扣分玩家给加分玩家多少分”
- Socket.IO 实时同步房间状态
- 查看记分流水
- 收付双方确认后撤销指定流水
- 房主结束对局并生成结算
- 查看历史对局和历史详情

当前不包含完整麻将规则、自动算番、用户登录、微信分享、公网访问、排行榜或金额支付能力。本项目只用于娱乐积分记录与结算辅助。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + Pinia + Vue Router
- 后端：Node.js 24 + Fastify + Socket.IO
- 数据库：SQLite
- 部署：Docker Compose + Nginx 静态服务反向代理

后端是唯一可信分数来源。前端只提交操作，所有分数变化、撤销和结算都由后端写入 SQLite 后广播给客户端。

## 快速开始

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run dev:server
```

启动前端：

```bash
npm run dev:web
```

浏览器访问：

```text
http://localhost:8899
```

生产构建：

```bash
npm run build
```

Docker Compose 部署：

```bash
docker compose up -d --build
```

部署后访问：

```text
http://NAS局域网IP:8899
```

## 项目结构

```text
mahjong_scoreboard/
├── docs/
│   ├── api.md
│   ├── deployment.md
│   ├── design.md
│   ├── development.md
│   └── usage.md
├── server/
│   ├── src/
│   ├── data/
│   └── Dockerfile
├── web/
│   ├── src/
│   ├── nginx/
│   └── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 文档

- [设计文档](docs/design.md)
- [使用说明](docs/usage.md)
- [部署说明](docs/deployment.md)
- [开发说明](docs/development.md)
- [API 概览](docs/api.md)

## 提交规范

提交消息使用中文 Conventional Commit 格式：

```text
feat: 实现房间创建功能
fix: 修复撤销流水后分数错误
docs: 完善部署说明
chore: 更新项目配置
```
