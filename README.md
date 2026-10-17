# 同频实验室

面向全国高校学生的人格测试、学生认证、关系匹配、私信和社交广场产品。

备案期间的免费内测支持 Render + Turso 云数据库 + 数据库头像，步骤见 [deploy/FREE-HOSTING.md](deploy/FREE-HOSTING.md)。原有腾讯云部署默认继续使用本地 SQLite；使用 Render 时必须设置 `DATABASE_PROVIDER=turso`。

## 社区流程

- 完成 32 题后直接进入统一的 `/community` 四栏主界面，默认选中「同频广场」。顶部不再有重复的「逛广场」入口，旧 `/match` 链接跳转到同一主界面的相应栏目。通过签名 HttpOnly 浏览凭证免登录查看官方话题和用户主动选择 `public` 的动态。分享结果页本身不会授予浏览权限。
- 发帖、点赞、评论、匹配和私信统一要求邮箱登录、高校认证、完整资料以及全部 20 题有效匹配答案；页面和接口均检查权限。
- 原有 `national` 和 `same_university` 动态及评论不向游客开放。发帖默认仍为认证高校可见，公开需主动选择。
- 小同（男生猫头鹰）与小频（女生水豚）是明确标识的官方虚拟伙伴，提供预设产品问答、六个常驻话题和标注的预设评论引导；也出现在「今日同频」的体验匹配中。每位伙伴有三个校园情境，完成参与准备后可以点选对话，不需要双向等待，不占用真人推荐名额。角色性格标注为设定，不展示虚构契合度或高校认证。
- 体验匹配通过 `/api/companions` 独立校验完整参与权限，使用 `companion_experiences` 表按账号与角色保存当前情境进度；更新携带版本号，避免重复点击或多页覆盖。真实用户、真人匹配、真人私信表不混入虚拟数据。这里是预设情境练习，暂不支持开放式 AI 自由聊天。
- 登录与认证保留原始话题或发帖位置；草稿在本设备保留 7 天，完成准备后由用户确认发送。资料草稿按账号隔离，匹配问卷逐题自动同步，验证码和认证材料不进入本地草稿。
- 私信图片、表情留待下一版。

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

构建后可运行隔离 SQLite 回归；浏览器验收需要本机 Chrome，截图在 `.tmp/unified-community-qa/`。以下脚本均不连接生产数据库、不发送真实邮件：

```bash
node scripts/verify-social-flow.mjs
node scripts/verify-community-ui.mjs
```

腾讯云轻量服务器的完整部署流程见 [deploy/README.md](deploy/README.md)。

## 生产环境必填配置

- `DOMAIN`、`CERTBOT_EMAIL`
- `ADMIN_EMAIL`
- `AUTH_CODE_SECRET`
- `RESEND_API_KEY`、`EMAIL_FROM`
- `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`

生产环境保持 `AUTH_ALLOW_DEMO_CODES=false`、`AUTH_COOKIE_SECURE=true`、`COS_ALLOW_LOCAL_STORAGE=false`。
