# 当前腾讯云实例运维

2026-10-24，本次迁移使用 Node.js standalone、systemd 和主机 Nginx。实例没有安装 Docker；同目录 README 中的 Docker 命令属于另一种部署方案，不能用于当前实例的服务管理。

## 实例与目录

- 北京 Lighthouse：`lhins-4r20ydy8`，`tongpinlab-prod`，公网 `62.234.167.162`。
- Ubuntu 24.04.4，2 核约 4GB；Node.js 24.22.1。
- 发布目录：`/opt/tongpin/releases/20261024`；当前版本：`/opt/tongpin/current` 符号链接。
- 启动目录：`/opt/tongpin/current/.next/standalone`；应用账号：`tongpin`。
- 生产配置：`/etc/tongpin/production.env`，root:root，0600。不得将配置加入 Git、归档或日志。
- 运行缓存：`/opt/tongpin/cache`；本地数据与备份目录：`/opt/tongpin/data`、`/opt/tongpin/backups`。

## 数据来源

当前应用连接原有 Turso 数据库，头像仍保存在数据库中，邮件沿用 Resend。账号、社区、私信、认证材料没有迁入服务器 SQLite。不要把本机测试 SQLite 或空数据库当成生产数据，也不要对 Turso 使用 SQLite 备份脚本。

必须保留原 AUTH_CODE_SECRET，它也用于认证材料加密。管理员配置仅为 `1904818062@qq.com`，演示验证码关闭。

## 服务检查与重启

```sh
sudo systemctl status tongpin --no-pager
sudo systemctl restart tongpin
curl -fsS http://127.0.0.1:3000/api/health
sudo nginx -t
sudo systemctl reload nginx
```

服务已设置开机启动与失败自动重启。仅监听 127.0.0.1:3000，公网使用 Nginx 的 80/443；不要在防火墙公开 3000。

## 域名和证书

正式域名为 `tongpinlab.cn`，`www.tongpinlab.cn` 跳转主域名。网站配置在 `/etc/nginx/sites-available/tongpinlab.cn`，两条 A 解析指向实例，三条发信记录保留。

证书位于 `/etc/letsencrypt/live/tongpinlab.cn/`，Certbot timer 定期续期；部署钩子 `/etc/letsencrypt/renewal-hooks/deploy/tongpin-nginx` 在续期后测试并重载 Nginx。

## 后续发布

当前 Tencent 实例使用人工上传的源码构建，没有启用 GitHub 自动部署。更新源码应上传到新的 releases 目录，在该目录安装依赖并运行生产构建，再准备 standalone 的 public、static、drizzle、scripts 和可写缓存。验证通过后才切换 current 链接并重启 tongpin。不要直接覆盖运行中的发布目录。

旧 Render 服务暂留作回退入口，与新实例共用同一 Turso。未经单独确认不关闭或删除旧服务和数据库。
