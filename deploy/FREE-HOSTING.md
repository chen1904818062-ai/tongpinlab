# 同频实验室：备案期间的免费内测部署

本版本使用 Render 免费 Web Service、新加坡节点、Turso libSQL 云数据库、数据库头像和 Resend 验证码邮件。应用和数据库在免费额度内运行；不需要为头像另开 COS。免费额度并不等于无限访问或服务可用性保证。

## 1. 先准备账号

注册 [GitHub](https://github.com/signup)、[Render](https://dashboard.render.com/register)、[Turso](https://app.turso.tech/)。验证码邮件沿用项目的 Resend 接口；没有邮件账号时再注册 [Resend](https://resend.com/signup)。第三方账号由本人登录和完成验证，密钥只填写在 Render 的环境变量面板。

大陆访问效果必须实测。可以先用 Render 官方 Next.js 示例 <https://next-js.onrender.com> 在自己的手机流量和校园网络测试平台地址是否能打开；此测试仅代表当前网络。正式部署后仍需测试自己的地址、验证码到达、头像、双账号私信。出现明显访问问题时先不要扩大内测人数。

## 2. 建立 Turso 数据库

创建一个名为 `tongpin-trial` 的 **libSQL** 数据库，优先选择与 Render 新加坡服务接近的可用区域。当前驱动是 `@libsql/client`，请使用 libSQL 引擎。

从数据库面板取得 Database URL 和具有读写权限的 Auth Token。URL 通常是 `libsql://…turso.io`。不要把 Token 写进仓库。

若面板选项不同，可以按 [Turso 官方快速入门](https://docs.turso.tech/quickstart) 在支持的终端登录，然后运行：

```sh
turso db create tongpin-trial
turso db show tongpin-trial --url
turso db tokens create tongpin-trial
```

创建命令不加 `--tursodb`，即使用 libSQL。Windows CLI 按官方文档使用 WSL；也可以直接使用网页面板，应用本身无需 WSL。

此部署默认从空数据库开始。当前服务器的数据不会自动复制过来；若需要迁移已有用户，请先做一致性备份再单独导入，不能拿正在写入的 SQLite 文件直接复制。

## 3. 配置真实验证码邮件

在 Resend 添加自己持有的发信域名或子域名，例如 `mail.example.com`，按面板指引添加 DNS 验证记录。完成验证后创建 API Key，并选一个发信地址，例如 `同频实验室 <login@mail.example.com>`。

Resend 的测试发信域名只能用于受限测试，不能作为向大家发送验证码的正式发信地址。网站备案中的域名不要恢复网页访问或改为指向临时站；邮件域名验证与网站解析分别处理，具体备案要求以接入商为准。

## 4. 上传代码并创建 Render 服务

将交付的 `tongpin-free-deploy.zip` 解压，新建自己的 GitHub 私有仓库，再上传解压后的文件。推荐用 [GitHub Desktop](https://desktop.github.com/) 发布解压后的文件夹；若用网页上传，分批上传各目录和根目录文件，不要把 ZIP 本身放进仓库。仓库根目录应直接看到 `package.json`、`render.yaml` 和 `Dockerfile.render`，不能多套一层项目文件夹。部署包未包含真实密钥、用户数据库或已有上传图片。

在 Render 选择 **New → Blueprint**，连接该仓库，使用根目录 `render.yaml`。确认服务套餐是 **Free**，区域是 Singapore。

按提示填入以下变量：

| 变量 | 填写内容 |
| --- | --- |
| `TURSO_DATABASE_URL` | 上一步的云数据库 URL |
| `TURSO_AUTH_TOKEN` | 云数据库读写 Token |
| `ADMIN_EMAIL` | 你用来登录管理后台的邮箱，小写 |
| `RESEND_API_KEY` | Resend API Key |
| `EMAIL_FROM` | 已验证域名的发信地址 |

其余变量由模板设置：`DATABASE_PROVIDER=turso`、`IMAGE_STORAGE=database`、安全 Cookie、禁用演示验证码和假用户，`AUTH_CODE_SECRET` 自动随机生成。

如果手动选择 **New → Web Service**：连接仓库，Runtime 选 Docker，Dockerfile Path 填 `./Dockerfile.render`，套餐选 Free，Region 选 Singapore，Health Check Path 填 `/api/health`；按 `render.yaml` 填完整环境变量。手动部署需自行生成 `AUTH_CODE_SECRET`，至少 32 字节随机内容。

Docker 启动时会自动迁移 Turso 数据库；迁移失败会停止启动，不会偷偷降级使用 Render 临时磁盘。

## 5. 上线验收

等待 Render 状态变为 Live，使用面板返回的 `https://你的服务.onrender.com` 地址。

1. 打开 `/api/health`，应返回 HTTP 200、`database: "turso"`、`registration: "ready"`。它检查数据库连接与配置，但不证明邮件实际送达。
2. 用两个真实邮箱完成登录，检查验证码实际到达；不要打开 `AUTH_ALLOW_DEMO_CODES` 来代替真实认证。
3. 保存资料、上传头像，完成学生认证和问卷，在两个账号间测试匹配、双向选择、私信与动态。
4. 在 Render 手动重新部署后再次登录，检查资料、头像和消息仍在。数据库在 Turso，不能在 Render 增加收费磁盘。
5. 用大陆电信、联通、移动和校园网络测试自己的网址后再发送邀请。

## 免费额度和使用边界

- Render：免费服务闲置 15 分钟后休眠，首次唤醒约需 1 分钟；每月 750 实例小时。带宽和构建还有额度限制。只选择免费资源；未添加付款方式时，超过有关额度会暂停相应服务或构建。不要通过保活任务绕开休眠限制。
- Turso：当前免费套餐提供总计 5GB 存储、每月 5 亿行读取和 1000 万行写入；头像计入同一存储额度。本版本每个账号只保存当前头像，转为 WebP、最长边 768px、每张最多 384KB，替换时删除旧图片。
- Resend：当前免费验证码邮件额度为每月 3000 封、每日最多 100 封，登录与校园认证共用额度。超过额度会影响新用户登录，宜先小范围邀请。
- 备案通过后若迁回腾讯云，需要同时迁移用户、会话、消息和头像数据库；这不是只换网址的操作。

已核实的官方资料（2026-10-13）：[Render 免费限制](https://render.com/docs/free)、[Render Blueprint 配置](https://render.com/docs/blueprint-spec)、[Turso 免费额度](https://turso.tech/pricing)、[Turso SDK](https://docs.turso.tech/sdk/ts/reference)、[Resend 免费额度](https://resend.com/pricing)、[邮件域名验证](https://resend.com/docs/dashboard/domains/introduction)、[腾讯云备案期间要求](https://cloud.tencent.com/document/product/243/19637)。

## 本次准备的验证结果

已通过 Next.js 生产构建和 TypeScript 检查，以及 standalone 服务中的双账号登录、验证码不可复用、头像压缩及替换、匹配、私信、广场权限和应用进程重启后数据读取。原有 SQLite 模式的社交流程也已通过。

Turso 路径使用官方 HTTP SDK连接本地 Hrana 协议模拟接口验证了异步行为、二进制图片、迁移幂等和事务回滚。尚未连接真实 Turso 账号、在 Render 发布、发送真实邮件或测试大陆运营商连通性；这些步骤在账号配置后完成。
