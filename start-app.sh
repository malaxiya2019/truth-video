#!/data/data/com.termux/files/usr/bin/bash
# TruthVideo App Launcher
# 用法: bash start-app.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=${PORT:-3456}

echo "  🎓 TruthVideo 启动中..."
echo ""

# 检查 ffmpeg
which ffmpeg >/dev/null 2>&1 || echo "  ⚠ ffmpeg 未安装"

# 启动
node "$ROOT/src/server.js" &
SERVER_PID=$!
sleep 2

# 用 Termux 打开浏览器
if which termux-open-url >/dev/null 2>&1; then
  termux-open-url "http://localhost:$PORT"
  echo "  ✅ 已在浏览器打开"
fi

echo ""
echo "  🌐 http://localhost:$PORT"
echo "  📱 按 Ctrl+C 停止服务"
echo ""

# 等待
wait $SERVER_PID
