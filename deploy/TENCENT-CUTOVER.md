# tongpinlab.cn 腾讯云迁移记录

2026-10-24，正式地址 https://tongpinlab.cn 已上线。HTTP 和 www 自动跳转至 HTTPS 主域名并保留路径；旧 Render 地址 https://tongpinlab.onrender.com 保留作回退入口。

## 当前部署

- 北京 Lighthouse tongpinlab-prod，实例 lhins-4r20ydy8，公网 62.234.167.162。
- Ubuntu 24.04.4 LTS，实测 2 核约 4GB，Node.js 24.22.1；独立 tongpin 账号、systemd 和主机 Nginx。
- 当前版本基于 78f84603f140bdd68b118fe0148721968c8ae95c，新增经核验的备案页脚，生产构建成功。
- 发布目录 /opt/tongpin/releases/20261024；/opt/tongpin/current 指向此版本。
- tongpin 服务开机启动、失败自动重启；监听 127.0.0.1:3000，公网仅使用网站端口 80/443，上传限制 6MB。
- DNSPod 的 @、www A 记录均指向实例，TTL600；三条原有 Resend 邮件记录保留。
- 备案号：闽ICP备2026041377号-1，页脚链接 https://beian.miit.gov.cn/ 。
- 证书覆盖主域名与 www，到期日 2027-01-22，Certbot timer 自动续期，部署钩子测试并重载 Nginx；续期演练与钩子执行通过。

## 数据和配置

五项生产配置由用户填写至本机 Git 忽略的模板，再通过固定主机公钥的 SSH/SCP 安装为 /etc/tongpin/production.env，root:root 0600。服务器中转副本已删除，没有将配置值加入源码、文档或聊天。

网站应用已迁至腾讯云，数据继续使用原有 Turso，头像保存在数据库中，发信沿用 Resend。账号、私信、认证材料没有迁入腾讯云 SQLite。原 AUTH_CODE_SECRET 保留，新站签发的匿名测评凭证在旧站验签成功。管理员仅为 1904818062@qq.com，演示验证码关闭。

未清空或改写真实数据，未注销真实账号、审批真实材料或发送测试邮件。新域名需要重新登录，原业务资料仍来自同一数据库。

## 验收

- 正式 HTTPS 地址通过 29 项流程检查：主页、测评、登录入口、社区、官方话题、伙伴、四栏导航、游客浏览、交互权限、后台及材料匿名访问限制、退出跳转、健康检查。
- 一张已有头像经正式 HTTPS 读取，与原数据库字节完全一致。
- 新旧站返回相同的既有公开动态，签名凭证兼容。
- HTTP 主域名、HTTP www、HTTPS www 均以 301 保留路径跳转至 HTTPS 主域名。
- 健康接口返回 200，数据库 turso，注册配置 ready，邮件配置 email。
- 邮件实际收取、登录后的双向私信与身份审核未冒用真实账号进行端到端测试。

临时 setup 域名、接收服务、代理入口及证书均已清理。该交接没有收到凭据，实际迁移使用本机配置与 SSH。Render 原配置和服务保留。实际运维见 [当前实例运维](TENCENT-NATIVE.md)。