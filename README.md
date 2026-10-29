# WordGarden

按目录内 PRD / TRD 实现的实时课堂词云。原生 HTML / JS、Express、ws、better-sqlite3，无前端构建步骤。

## 本地运行

安装 Node.js 22 或 24 LTS（支持 Node >=20），然后执行：

```sh
npm ci
npm start
```

访问 http://127.0.0.1:3000 。`npm test` 验证 API、WebSocket、55 路并发、去重与重启持久化。安装时自动复制词云和二维码库到 public/lib，无 CDN 请求。

手机联调：设置 `HOST=0.0.0.0` 后启动，电脑和手机连接同一局域网，用电脑局域网 IP 打开首页再创建问题；二维码会使用当前访问地址。localhost 二维码无法被其他设备访问。

## 功能与计数规则

- 问题 1–100 字，回答 1–40 字；空白与无效输入会被服务端拒绝。
- 6 位随机 ID；三个页面路由与 REST API 按 TRD 提供。
- 回答先经 segmentit 中文分词，再过滤常见停用词、功能词、标点及纯数字，按关键词汇总生成词云。英文大小写合并，同一条回答内重复出现的关键词只计一次。
- 同一花园、同一 IP、相同原始回答仅计一次，不同回答可继续提交。回答总数与关键词计数分开统计。
- 使用独立 submissions 表存储去重记录，answers 表保持词频聚合，事务保证一致性。
- 参与数显示为参与 IP 数。校园共享出口 IP 的用户提交相同词语也只计一次，这是 PRD 的 IP 去重规则带来的限制，无法等同于真实人数。
- 词云显示被最多回答提及的 80 个关键词（不足 80 个全部显示），低频长尾隐藏；下方可查看原始回答和次数。原始数据保留，已有回答在读取时自动分词，无需迁移数据库。
- WebSocket 初始快照、心跳清理与指数退避重连；全屏、复制链接、加载及错误反馈。
- IP 使用 HMAC 哈希，默认密钥保存在数据库同目录的 `.salt` 文件，重启保持稳定。数据库和密钥均应保护并一同备份。

## ECS 部署

Ubuntu / Debian 安装 Node LTS、构建依赖（build-essential、python3）、Nginx。将项目放入 `/opt/wordgarden`，由专用非 root 用户持有应用及 data 目录，执行 `bash setup.sh`。npm 全局安装 PM2 若无权限，请先由管理员安装。

将 nginx.conf 放入 Nginx 的站点配置目录并启用；替换 server_name 为域名（IP 阶段可保留 `_`），执行 `sudo nginx -t` 后 `sudo systemctl reload nginx`。所有请求通过 Node 路由，避免 `/garden/:id` 被错误回退到首页。

执行 `pm2 startup`，运行它输出的命令，然后 `pm2 save`。仅开放 22/80/443，Node 默认监听 127.0.0.1。域名就绪后使用 `sudo certbot --nginx -d example.com` 配置 HTTPS；Cloudflare 使用仅 DNS（灰云）。WebSocket 自动采用 wss。

PM2 配置启用 `TRUST_PROXY=loopback`，仅信任本地 Nginx；Nginx 覆盖客户端传入的转发头。直接运行时默认不信任转发头。请保持该代理拓扑，避免去重与限流 IP 失真。保持单 PM2 进程，词云连接池属于单进程。

可配置：`HOST`、`PORT`、`DB_PATH`、`IP_HASH_SALT`、`TRUST_PROXY`。更换哈希密钥会使旧 IP 去重记录失效。创建接口每 IP 每分钟 20 次，API 总请求每 IP 每分钟 240 次。

## 备份与运维

内容过滤词表位于 `config/blocked-terms.json`，修改后需重启应用。先进行 Unicode 归一化并去掉空格、标点和零宽字符，再匹配词表；命中新问题或新回答会拒绝提交。命中的历史回答整条从词云、原始回答列表和推送中隐藏，历史问题标题替换为提示文字，原数据库保留。历史回答总数与参与 IP 数仍保留原计数。该规则是词表匹配，未列出的谐音、隐喻等内容不保证识别。

```sh
node scripts/backup.js /var/backups/wordgarden
```

使用 SQLite 在线备份 API，可在运行中执行；例如为应用用户配置每日 cron：`0 3 * * * cd /opt/wordgarden && /usr/bin/node scripts/backup.js /var/backups/wordgarden`。确保备份目录可写，按需清理历史备份并拷贝到其他磁盘。恢复时先停止 PM2，替换数据库及配套 `.salt` 文件后重启。使用环境变量密钥时需另行安全备份该密钥。

服务器按需配置 Fail2ban 和交换分区。`pm2 logs wordgarden` 查看日志。国内延迟、真实移动端兼容性和公网推送延迟需在实际 ECS 与客户端网络上验收；本地测试不代表公网 SLA。
