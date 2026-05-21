# 部署说明

本文档说明如何在本地或 Docker 环境部署“雀桌记”。

## 环境要求

本地开发：

- Node.js 24 或以上；
- npm 11 或以上。

Docker 部署：

- Docker；
- Docker Compose。

后端当前使用 Node.js 24 内置的 `node:sqlite` 模块。该模块在 Node.js 24 中仍会显示实验性提示，但可以减少额外 SQLite 原生依赖，降低部署复杂度。

## Docker Compose 部署

推荐部署用户从 GitHub Release 下载稳定版本：

1. 打开 [Releases](https://github.com/littleseven2003/mahjong_scoreboard/releases) 页面；
2. 下载目标版本的 `Source code (zip)` 或 `Source code (tar.gz)`；
3. 解压后进入项目根目录；
4. 执行 Docker Compose 部署命令。

当前分支版本：`v1.3.0-admin-alpha.1`。该版本包含管理员与数据管理实验功能，和正式稳定版区分发布。

在项目根目录执行：

```bash
docker compose up -d --build
```

默认服务：

- `web`：对外暴露 `8899` 端口；
- `server`：内部监听 `3100` 端口；
- SQLite 数据文件：挂载到 `./server/data/mahjong.db`。

## 管理员配置

管理员功能需要通过服务端环境变量启用。建议在项目根目录创建 `.env` 文件，Docker Compose 会自动读取：

```bash
ADMIN_PASSWORD=请替换为高强度密码
ADMIN_SESSION_SECRET=请替换为随机长字符串
```

其中：

- `ADMIN_PASSWORD`：管理员入口验证密码。未配置时，管理入口无法登录；
- `ADMIN_SESSION_SECRET`：管理员登录 Token 签名密钥，建议使用随机长字符串；
- 不要把 `.env` 文件提交到 Git，也不要在公开页面或截图中暴露这些值。

公网部署时，建议额外使用 HTTPS、反向代理访问控制、强密码和定期轮换密码。当前管理员功能属于实验能力，默认只建议在可信局域网中使用。

部署后访问：

```text
http://服务器局域网IP:8899
```

## 端口说明

默认端口配置在 [docker-compose.yml](../docker-compose.yml)：

```text
web: 8899 -> 80
server: 3100
```

外部用户只需要访问 `8899`。前端容器内的 Nginx 会把：

- `/api/` 代理到后端 REST API；
- `/socket.io/` 代理到后端 Socket.IO。

## 数据持久化

SQLite 数据库文件位于：

```text
server/data/mahjong.db
```

该目录已在 Compose 中挂载，容器重建不会删除历史数据。

建议定期备份：

```text
server/data/
```

数据库文件、WAL 文件和 SHM 文件不会提交到 Git。

## 常用命令

启动或更新：

```bash
docker compose up -d --build
```

查看服务状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

## 常见问题

### 打开页面显示 403，或 Logo 不显示

这通常表示前端容器内没有正确生成或挂载静态文件，Nginx 在
`/usr/share/nginx/html` 找不到 `index.html`，因此返回 403。

请检查：

- 上传的是 Release 解压后的完整项目目录，而不仅是 `docker-compose.yml`；
- `docker-compose.yml` 位于项目根目录，旁边应能看到 `web/`、`server/`、`package.json`；
- 不要把空目录挂载到前端容器的 `/usr/share/nginx/html`；
- 修改文件后需要重新构建镜像，而不是只重启旧容器。

可在项目根目录执行：

```bash
docker compose down
docker compose up -d --build
docker compose logs -f web
```

如果仍然异常，进入前端容器检查文件：

```bash
docker compose exec web ls -la /usr/share/nginx/html
```

正常情况下应至少包含：

```text
index.html
logo.png
assets/
```

停止服务：

```bash
docker compose down
```

停止并保留数据：

```bash
docker compose down
```

不要手动删除 `server/data/`，除非确认不再需要历史对局。

项目建议只在局域网内使用。公网访问、HTTPS、反向代理、内网穿透和权限控制可在后续单独设计。
