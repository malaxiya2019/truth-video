# truth-video Docker 镜像
# 构建: docker build -t truth-video .
# 运行: docker run -p 3000:3000 -v ./输出:/app/output truth-video

FROM node:22-bullseye-slim

LABEL description="truth-video 知识图谱教学视频编译器"
LABEL version="3.0.0"

# ── 系统依赖 ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    # ffmpeg (视频编码)
    ffmpeg \
    # 中文字体 (字幕渲染)
    fonts-wqy-zenhei \
    # Chromium 依赖 (Playwright)
    libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 \
    # Python + edge-tts
    python3 python3-pip \
    # 工具
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── edge-tts 语音合成 ──
RUN pip3 install --no-cache-dir edge-tts

# ── 应用目录 ──
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts

# ── Chromium (Playwright) ──
RUN npx playwright install chromium 2>&1 | tail -5

# ── 源码 ──
COPY . .

# ── 默认命令 ──
EXPOSE 3000
ENTRYPOINT ["node", "src/server.js"]
