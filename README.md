# mahjong_scoreboard

中文名：麻将桌计分器。

`mahjong_scoreboard` 是一个面向家庭娱乐麻将桌场景的轻量级实时计分与结算 Web 应用。项目支持 Docker Compose 部署，用户在局域网内通过手机浏览器访问同一个房间，实时查看分数、流水和结算结果。

## 功能范围

当前已实现：

- 创建三人或四人房间
- 从首页继续进入未完成对局，超时对局可删除本机入口
- 玩家通过房间号和昵称加入
- 设置起始分、计分单位、是否允许负分
- 非房主准备 / 取消准备 / 退出等待房间
- 房主在房间人数满员且所有非房主准备后开始对局，或在准备阶段解散房间
- 记录“扣分玩家给加分玩家多少分”
- Socket.IO 实时同步房间状态
- 查看记分流水
- 相关双方确认后撤销指定流水
- 房主结束对局并生成结算
- 查看历史对局和历史详情

当前不包含完整麻将规则、自动算番、用户登录、微信分享、公网访问、排行榜或金额支付能力。本项目只用于娱乐积分记录与结算辅助。

## 合规声明

本软件工具仅用于线下娱乐麻将场景中的积分记录与结算辅助，与任何赌博、资金交易或其他违法行为无关。使用者应遵守所在地法律法规，不得将本项目用于任何违法违规用途。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + Pinia + Vue Router
- 后端：Node.js 24 + Fastify + Socket.IO
- 数据库：SQLite
- 部署：Docker Compose + Nginx 静态服务反向代理

后端是唯一可信分数来源。前端只提交操作，所有分数变化、撤销和结算都由后端写入 SQLite 后广播给客户端。

## 快速开始

推荐部署用户从 GitHub Release 下载稳定版本：

1. 打开 [Releases](https://github.com/littleseven2003/mahjong_scoreboard/releases) 页面。
2. 下载目标版本的 `Source code (zip)` 或 `Source code (tar.gz)`。
3. 解压后进入项目根目录。
4. 执行 Docker Compose 部署命令。

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
http://服务器局域网IP:8899
```

当前发布版本：`v0.1.0`。

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
├── LICENSE
├── package.json
└── README.md
```

## 文档

- [设计文档](docs/design.md)
- [使用说明](docs/usage.md)
- [部署说明](docs/deployment.md)
- [开发说明](docs/development.md)
- [API 概览](docs/api.md)

## 开源协议

本项目使用 [GNU General Public License v3.0](LICENSE) 开源。

## 提交规范

提交消息使用中文 Conventional Commit 格式：

```text
feat: 实现房间创建功能
fix: 修复撤销流水后分数错误
docs: 完善部署说明
chore: 更新项目配置
```
