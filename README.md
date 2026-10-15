# 同频实验室

面向全国高校学生的人格测试、学生认证、关系匹配、私信和社交广场产品。

备案期间的免费内测支持 Render + Turso 云数据库 + 数据库头像，步骤见 [deploy/FREE-HOSTING.md](deploy/FREE-HOSTING.md)。原有腾讯云部署默认继续使用本地 SQLite；使用 Render 时必须设置 `DATABASE_PROVIDER=turso`。

## 当前服务器架构

- Next.js 16，Node.js 24
- 服务器 SQLite（WAL 模式、自动迁移）
- 邮箱验证码登录、数据库会话、HttpOnly Cookie
- 腾讯云 COS 用户图片与异地备份
- Docker Compose 进程守护
- Nginx 反向代理与 Let's Encrypt HTTPS

## 本地开发

```bash
cp .env.production.example .env.local
# 本地可将 AUTH_ALLOW_DEMO_CODES=true、AUTH_COOKIE_SECURE=false、COS_ALLOW_LOCAL_STORAGE=true
npm run dev
```

首次访问数据库时会自动执行 `drizzle/` 中尚未运行的迁移。默认数据库位置为 `data/tongpin.sqlite`。

## 检查和构建

```bash
npm run lint
npm run build
npm run db:backup
```

腾讯云轻量服务器的完整部署流程见 [deploy/README.md](deploy/README.md)。

## 生产环境必填配置

- `DOMAIN`、`CERTBOT_EMAIL`
- `ADMIN_EMAIL`
- `AUTH_CODE_SECRET`
- `RESEND_API_KEY`、`EMAIL_FROM`
- `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`

生产环境保持 `AUTH_ALLOW_DEMO_CODES=false`、`AUTH_COOKIE_SECURE=true`、`COS_ALLOW_LOCAL_STORAGE=false`。
