# WordGarden 实时词云互动工具 - 技术需求文档（TRD）

## 1. 技术架构

### 1.1 技术选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端 | HTML + Vanilla JS | — | 无框架，零构建 |
| 词云渲染 | wordcloud2.js | latest | 前端 Canvas 渲染 |
| 二维码 | qrcode.js | latest | 前端生成二维码 |
| 后端 | Node.js + Express | Node 20 LTS | 单进程 |
| 实时通信 | ws | ^8.x | WebSocket 库 |
| 数据库 | SQLite (better-sqlite3) | — | 嵌入式，单文件 |
| 进程管理 | PM2 | latest | 自动重启 + 开机自启 |
| 反向代理 | Nginx | latest | HTTPS + WebSocket 代理 |
| SSL 证书 | Let's Encrypt (Certbot) | — | 免费（域名就绪后） |

### 1.2 系统架构图

```
                          ┌──────────────────────────────────┐
                          │          华为云 ECS               │
                          │                                   │
  学生手机  ──HTTP/WS──→  │  Nginx (80/443)                  │
                          │    ├── 静态文件 → public/         │
                          │    ├── /api/*  → Express           │
                          │    └── /ws/*   → WebSocket 升级   │
                          │                                   │
                          │  Node.js (Express + ws)           │
                          │    ├── REST API                   │
                          │    ├── WebSocket Server           │
                          │    └── better-sqlite3             │
                          │         │                          │
                          │    ┌────┴────┐                    │
                          │    │ SQLite  │                    │
                          │    │ data.db │                    │
                          │    └─────────┘                    │
                          │                                   │
  教师电脑  ──HTTP/WS──→  │  PM2 进程管理                     │
                          └──────────────────────────────────┘
```

### 1.3 请求链路

```
1. 教师创建问题:
   浏览器 → POST /api/garden → Express → 写入 SQLite → 返回 garden_id
   → 浏览器跳转 /garden/:id

2. 学生提交回答:
   手机 → POST /api/garden/:id/answer → Express → 写入 SQLite
   → Express 通过 WebSocket 广播到所有连接的展示页

3. 教师端实时更新:
   展示页 WebSocket 连接 → 收到推送 → wordcloud2.js 重新渲染词云
```

## 2. API 设计

### 2.1 REST API

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/garden` | 创建问题 | `{ "question": "..." }` | `{ "id": "abc123" }` |
| GET | `/api/garden/:id` | 获取词云数据 | — | `{ "question": "...", "words": [{"text":"hello","count":3}] }` |
| POST | `/api/garden/:id/answer` | 提交回答 | `{ "word": "..." }` | `{ "success": true }` |

### 2.2 WebSocket

| 路径 | 说明 | 消息格式 |
|------|------|---------|
| `ws://host/ws/:id` | 实时词云同步 | `{ "type": "update", "words": [{"text":"hello","count":3}] }` |

**WebSocket 事件流程：**

```
学生提交回答 → POST /api/garden/:id/answer
    → 服务端写入 SQLite
    → 服务端找到该 garden_id 的所有 WebSocket 连接
    → 广播: { type: "update", words: [...] }
    → 所有展示页收到 → 重新渲染词云
```

## 3. 数据库设计

### 3.1 gardens 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 6位随机字符串（短链ID） |
| question | TEXT NOT NULL | 问题文本（≤100字符） |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 3.2 answers 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | 自增ID |
| garden_id | TEXT NOT NULL | 关联 gardens.id |
| word | TEXT NOT NULL | 回答文本（≤40字符） |
| count | INTEGER DEFAULT 1 | 累计次数（相同回答+1） |
| ip_hash | TEXT | IP的哈希值（防重复提交） |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 3.3 建表语句

```sql
CREATE TABLE IF NOT EXISTS gardens (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    garden_id TEXT NOT NULL,
    word TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    ip_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(garden_id, word),
    FOREIGN KEY (garden_id) REFERENCES gardens(id)
);

CREATE INDEX IF NOT EXISTS idx_answers_garden ON answers(garden_id);
```

## 4. 前端页面设计

### 4.1 页面路由

| 路由 | 页面文件 | 说明 |
|------|---------|------|
| `/` | `index.html` | 创建问题页（首页） |
| `/garden/:id` | `garden.html` | 展示页（教师投屏，二维码+词云） |
| `/answer/:id` | `answer.html` | 回答页（学生手机端） |

### 4.2 页面交互

**首页 `/`**

```
┌──────────────────────────────────────┐
│            WordGarden                │
│                                      │
│   输入你的问题：                       │
│   ┌──────────────────────────────┐   │
│   │                              │   │
│   └──────────────────────────────┘   │
│                                      │
│           [ 创建词云 ]                │
│                                      │
└──────────────────────────────────────┘
```

**展示页 `/garden/:id`**

```
┌──────────────────────────────────────────────┐
│  Q: 用一个词描述你的感受          [全屏] ⛶   │
│                                              │
│  ┌───────────┐   ┌────────────────────────┐ │
│  │           │   │                        │ │
│  │   QR码    │   │      实时词云区域       │ │
│  │           │   │   大词  小词  中等词    │ │
│  │  扫码回答  │   │                        │ │
│  │           │   │                        │ │
│  └───────────┘   └────────────────────────┘ │
│                                              │
│  参与人数: 12   回答总数: 18                  │
└──────────────────────────────────────────────┘
```

**回答页 `/answer/:id`**

```
┌──────────────────────────┐
│      WordGarden          │
│                          │
│  Q: 用一个词描述你的感受   │
│                          │
│  输入你的回答：            │
│  ┌────────────────────┐  │
│  │                    │  │
│  └────────────────────┘  │
│  最多40字符               │
│                          │
│     [ 提交回答 ]          │
│                          │
│  ✅ 提交成功！             │
│  继续输入新的回答          │
└──────────────────────────┘
```

## 5. 项目目录结构

```
wordgarden/
├── package.json
├── server.js                # Express + WebSocket 主服务
├── db.js                    # SQLite 数据库初始化与操作
├── public/
│   ├── index.html           # 创建问题页
│   ├── garden.html          # 展示页（二维码+词云）
│   ├── answer.html          # 回答页（学生手机端）
│   ├── css/
│   │   └── style.css        # 全局样式
│   └── lib/
│       ├── wordcloud2.min.js # 词云渲染库
│       └── qrcode.min.js    # 二维码生成库
├── nginx.conf               # Nginx 配置模板
├── ecosystem.config.js      # PM2 配置
└── setup.sh                 # 一键安装脚本
```

## 6. 关键实现细节

### 6.1 短链 ID 生成

```javascript
// 6位随机字符串，大小写字母+数字
function generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}
```

### 6.2 WebSocket 广播机制

```javascript
// 每个 garden 维护一个 WebSocket 连接池
const connections = new Map(); // garden_id -> Set<WebSocket>

function broadcast(gardenId, words) {
    const clients = connections.get(gardenId);
    if (clients) {
        const message = JSON.stringify({ type: 'update', words });
        clients.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                ws.send(message);
            }
        });
    }
}
```

### 6.3 课堂模式防重复

```javascript
// 同一 IP 提交相同回答只计一次
// 通过 ip_hash + word 组合判断
// answers 表 UNIQUE(garden_id, word) 约束
// 提交时检查是否已存在该 ip_hash 的相同回答
```

### 6.4 词云渲染

```javascript
// 前端收到 WebSocket 推送后重新渲染
WordCloud(document.getElementById('cloud'), {
    list: words.map(w => [w.text, w.count]),
    gridSize: 8,
    weightFactor: function(size) {
        return Math.max(12, size * 16);
    },
    fontFamily: 'Microsoft YaHei, sans-serif',
    color: 'random-dark',
    rotateRatio: 0.3,
    backgroundColor: '#fff'
});
```

## 7. 部署方案

### 7.1 环境准备

```bash
# 1. 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 2. 安装构建依赖（better-sqlite3 需要）
apt install -y build-essential python3

# 3. 安装 PM2
npm install -g pm2

# 4. 安装 Nginx
apt install -y nginx
```

### 7.2 应用部署

```bash
# 1. 克隆代码
git clone <repo-url> /opt/wordgarden
cd /opt/wordgarden

# 2. 安装依赖
npm install

# 3. 用 PM2 启动
pm2 start server.js --name wordgarden
pm2 save
pm2 startup  # 开机自启
```

### 7.3 Nginx 配置

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # 域名就绪后替换

    # 静态文件
    location / {
        root /opt/wordgarden/public;
        try_files $uri $uri/ /index.html;
    }

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### 7.4 HTTPS（域名就绪后）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
certbot --nginx -d yourdomain.com
```

### 7.5 Cloudflare DNS 配置

```
类型: A
名称: @ (或 www)
内容: <华为云服务器 IP>
代理状态: 仅 DNS (灰云) ← 重要！不要开橙色云朵
TTL: 自动
```

## 8. 性能设计

| 关注点 | 策略 |
|--------|------|
| 实时性 | WebSocket 推送，替代轮询 |
| 数据库 | SQLite 嵌入式，零网络开销 |
| 词云渲染 | 前端 Canvas 渲染，不占服务器 CPU |
| 内存 | better-sqlite3 同步操作，内存占用低 |
| 防OOM | 2G Swap 交换分区 |
| 进程守护 | PM2 自动重启 + 开机自启 |
| 并发 | 单进程 EventLoop，50+ 并发无压力 |

## 9. 安全设计

| 风险 | 措施 |
|------|------|
| XSS 攻击 | 前端转义所有用户输入，HTML escape |
| 重复提交 | IP 哈希 + UNIQUE 约束 |
| 恶意大量请求 | Express rate-limit 中间件 |
| 端口暴露 | 仅开 22/80/443，应用监听 127.0.0.1:3000 |
| SSH 暴力破解 | Fail2ban |
| 数据丢失 | SQLite 文件定期备份 cron |
