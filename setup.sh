#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo '请先安装 Node.js 22 或 24 LTS'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'
npm ci --omit=dev
command -v pm2 >/dev/null || npm install -g pm2
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo '应用已启动。请配置 nginx.conf，并执行 pm2 startup 输出的命令以启用开机自启。'
