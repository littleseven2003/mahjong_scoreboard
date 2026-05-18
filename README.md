# mahjong_scoreboard

中文名暂定：麻将桌计分器。

`mahjong_scoreboard` 是一个面向家庭娱乐麻将桌场景的轻量级实时计分与结算 Web 应用。第一版目标是在绿联云 NAS 的 Docker / Docker Compose 环境中部署，通过局域网手机浏览器访问。

## 第一版定位

- 创建三人或四人麻将房间
- 玩家通过房间号加入
- 设置起始分与计分单位
- 记录谁给谁多少分
- 实时同步所有玩家当前分数
- 查看流水、撤销上一笔、结束结算
- 保存历史对局

第一版不做完整麻将规则、自动算番、登录系统或公网分享，后端作为唯一可信分数来源。

## 技术方案

- 前端：Vue 3 + Vite + TypeScript
- 后端：Node.js + Fastify + Socket.IO
- 数据库：SQLite
- 部署：Docker Compose

详细设计见 [docs/design_v1.md](docs/design_v1.md)。
