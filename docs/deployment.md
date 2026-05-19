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

当前发布版本：`v1.0.0`。

在项目根目录执行：

```bash
docker compose up -d --build
```

默认服务：

- `web`：对外暴露 `8899` 端口；
- `server`：内部监听 `3100` 端口；
- SQLite 数据文件：挂载到 `./server/data/mahjong.db`。

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
