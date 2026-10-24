# 腾讯云轻量服务器部署

本项目 2026-10-24 的实际迁移使用 Node.js + systemd，见 [当前实例运维](TENCENT-NATIVE.md)。下文为可选的 Docker 部署方案，生产数据来源以 [迁移记录](TENCENT-CUTOVER.md) 为准。

推荐环境：Ubuntu 24.04、2 核 4GB 或以上、Docker Engine 与 Docker Compose 插件。应用使用服务器 SQLite（WAL 模式）、数据库头像、Nginx、Let's Encrypt 和 Docker 自动重启。已有免费测试站迁移见 [迁移核对记录](TENCENT-CUTOVER.md)，不要直接创建空库后切换域名。

## 1. 准备腾讯云资源

1. 将域名的 A 记录指向轻量服务器公网 IP。
2. 防火墙开放 TCP 22、80、443；不要开放 3000。
3. 环境示例默认 `IMAGE_STORAGE=database`，头像随数据库持久化；COS 可用于异地备份，不是头像功能的前提。
4. 准备 Resend 发信域名及 API Key，或后续把 `lib/campus-email.ts` 换成腾讯云 SES。

## 2. 配置并启动

```bash
sudo mkdir -p /opt/tongpin
sudo chown "$USER":"$USER" /opt/tongpin
cd /opt/tongpin
# 将本项目上传或 git clone 到这里
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production up -d --build app nginx
```

生成安全验证码密钥：

```bash
openssl rand -hex 32
```

全新站点可把结果填入 `AUTH_CODE_SECRET`。从 Render 迁移已有数据时必须沿用原密钥，避免已提交的加密材料无法解密。`ADMIN_EMAIL` 是唯一自动获得管理权限的邮箱；生产环境必须保持 `AUTH_ALLOW_DEMO_CODES=false`。

## 3. 开启 HTTPS

确认域名已经解析到服务器后运行：

```bash
sh deploy/scripts/enable-https.sh
```

脚本先用 HTTP 完成 ACME 验证，再切换到 HTTPS，并启动每天两次的证书续期检查。

## 4. 每日备份

先手动验证：

```bash
sh deploy/scripts/backup.sh
```

再写入 `crontab -e`，每天北京时间 03:20 备份：

```cron
20 3 * * * cd /opt/tongpin && sh deploy/scripts/backup.sh >> /var/log/tongpin-backup.log 2>&1
```

备份使用 SQLite 在线备份 API 生成一致性快照，保存在 Docker 的 `app_backups` 数据卷；配置 COS 后还会上传至 `COS_BACKUP_PREFIX`。本机默认保留 14 天。如需导出本地副本：

```bash
mkdir -p backups-export
docker cp "$(docker compose --env-file .env.production ps -q app):/app/backups/." ./backups-export/
```

## 5. 运维命令

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs -f --tail=200 app nginx
curl -fsS https://你的域名/api/health
docker compose --env-file .env.production up -d --build
```

Docker 的 `restart: unless-stopped` 负责进程守护和服务器重启后的自动拉起；应用容器启动前自动执行数据库迁移。
