# TruthVideo 独立安卓 APK

完全离线的教学视频渲染器，无需 Termux / 云服务 / 外部依赖。

## 原理

```
你的 Markdown
     │
     ▼
┌─────────────────────────────────┐
│ WebView (内置 V8 引擎)          │
│  ├─ 解析 Markdown → 场景列表     │
│  └─ 生成 HTML + CSS 动画         │
├─────────────────────────────────┤
│ Canvas 截帧                      │
│ 每帧以 Bitmap 形式捕获 WebView   │
├─────────────────────────────────┤
│ MediaCodec (H.264 硬件编码器)    │
│ Bitmap 帧 → H.264 视频流         │
├─────────────────────────────────┤
│ TextToSpeech (离线语音)          │
│ 中文语音 → AAC 音频流            │
├─────────────────────────────────┤
│ MediaMuxer → MP4                │
└─────────────────────────────────┘
     │
     ▼
  视频文件 (相册/Movies/TruthVideo)
```

## 构建

在 GitHub Actions 运行 **Build Standalone APK** 工作流，
或本地用 Android Studio 打开 `android/` 目录构建。

## 使用

1. 安装 APK
2. 写入 Markdown（`# 标题` + `## 场景` 格式）
3. 选择视觉模板
4. 点击「开始渲染」
5. 等待完成（3-10分钟，取决于内容长度）
6. 视频自动保存到 Movies/TruthVideo/
