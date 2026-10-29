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
- 每个问题固定从创建起开放 3 小时，不提供时长设置或续时。绝对截止时间持久化到 SQLite，服务端在到期时拒绝新回答（HTTP 410），向在线展示页发送最终快照并关闭 WebSocket；过期问题拒绝建立新的 WebSocket，原回答链接重定向到展示页。原词云、原始记录及导出仍可查看。历史问题按原创建时间加 3 小时补齐截止时间，重启不会延长。
- 6 位随机 ID；三个页面路由与 REST API 按 TRD 提供。
- 回答先经 segmentit 中文分词，再过滤常见停用词、功能词、标点及纯数字，按关键词汇总生成词云。英文大小写合并，同一条回答内重复出现的关键词只计一次。
- 同一花园、同一浏览器匿名标识、相同原始回答仅计一次；不同浏览器共用同一出口 IP 时仍可分别提交相同回答。回答总数与关键词计数分开统计。
- 使用独立 submissions 表存储去重记录，answers 表保持词频聚合，事务保证一致性。
- 匿名标识使用服务端签名的 HttpOnly / SameSite=Lax Cookie（HTTPS 下设置 Secure），有效期一年。参与数是匿名标识数，不等同于真实人数；清除 Cookie、使用无痕窗口或更换浏览器会产生新标识。历史 IP 去重记录及计数保留，不会从 IP 猜测或回填浏览器身份。
- 词云显示被最多回答提及的 80 个关键词（不足 80 个全部显示），低频长尾隐藏；下方可查看原始回答和次数。原始数据保留，已有回答在读取时自动分词，无需迁移数据库。
- WebSocket 每 250ms 合并一批更新；前端也合并重绘，离屏绘制后再呈现，优先保留已有词位，词频变化或尺寸变化时可能局部调整。Canvas 使用确定性布局和配色，支持全屏与二维码折叠。
- 展示页可下载包含问题、词云及版权的 PNG，或导出「问题、用户 IP、原始发言」CSV。CSV 使用 UTF-8 BOM、标准引号转义和公式转义；屏蔽内容不会导出。
- 新提交记录服务端识别的原始 IP，用于在「查看原始回答」中逐条展示 IP 与发言。历史记录未保存原始 IP，显示「未记录 IP」，无法从哈希还原。HMAC 密钥同时用于匿名标识签名，默认保存在数据库同目录的 `.salt` 文件，重启保持稳定。数据库和密钥均应保护并一同备份。

## ECS 部署

Ubuntu / Debian 安装 Node LTS、构建依赖（build-essential、python3）、Nginx。将项目放入 `/opt/wordgarden`，由专用非 root 用户持有应用及 data 目录，执行 `bash setup.sh`。npm 全局安装 PM2 若无权限，请先由管理员安装。

将 nginx.conf 放入 Nginx 的站点配置目录并启用；替换 server_name 为域名（IP 阶段可保留 `_`），执行 `sudo nginx -t` 后 `sudo systemctl reload nginx`。所有请求通过 Node 路由，避免 `/garden/:id` 被错误回退到首页。

执行 `pm2 startup`，运行它输出的命令，然后 `pm2 save`。仅开放 22/80/443，Node 默认监听 127.0.0.1。域名就绪后使用 `sudo certbot --nginx -d example.com` 配置 HTTPS；Cloudflare 使用仅 DNS（灰云）。WebSocket 自动采用 wss。

PM2 配置启用 `TRUST_PROXY=loopback`，仅信任本地 Nginx；Nginx 覆盖客户端传入的转发头。直接运行时默认不信任转发头。请保持该代理拓扑，避免去重与限流 IP 失真。保持单 PM2 进程，词云连接池属于单进程。

可配置：`HOST`、`PORT`、`DB_PATH`、`IP_HASH_SALT`、`TRUST_PROXY`。更换密钥会使已发放的浏览器标识失效。每浏览器每分钟最多创建 10 次、提交 30 次；API 每 IP 每分钟总上限 6000 次，为共享网络保留容量。正常浏览器会自动携带 Cookie，脚本客户端需要自行保存并发送 Cookie 才能正确去重。

## 备份与运维

内容过滤词表位于 `config/blocked-terms.json`，修改后需重启应用。先进行 Unicode 归一化并去掉空格、标点和零宽字符，再匹配词表；命中新问题或新回答会拒绝提交。命中的历史回答整条从词云、原始回答列表和推送中隐藏，历史问题标题替换为提示文字，原数据库保留。历史回答总数与参与 IP 数仍保留原计数。该规则是词表匹配，未列出的谐音、隐喻等内容不保证识别。

```sh
node scripts/backup.js /var/backups/wordgarden
```

使用 SQLite 在线备份 API，可在运行中执行；例如为应用用户配置每日 cron：`0 3 * * * cd /opt/wordgarden && /usr/bin/node scripts/backup.js /var/backups/wordgarden`。确保备份目录可写，按需清理历史备份并拷贝到其他磁盘。恢复时先停止 PM2，替换数据库及配套 `.salt` 文件后重启。使用环境变量密钥时需另行安全备份该密钥。

服务器按需配置 Fail2ban 和交换分区。`pm2 logs wordgarden` 查看日志。国内延迟、真实移动端兼容性和公网推送延迟需在实际 ECS 与客户端网络上验收；本地测试不代表公网 SLA。
