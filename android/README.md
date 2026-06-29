# TruVid — 独立安卓 APK

完全离线的教学视频渲染器。安装即用，零依赖。

## 原理

```
Markdown ─→ 解析场景 ─→ WebView 渲染 + Canvas 截帧
                      ─→ Android TTS 语音
                      ─→ MediaCodec H.264 + MediaMuxer MP4
```

## 构建

GitHub Actions: **Build Standalone APK** 工作流

## 使用

1. 安装 APK
2. 写 Markdown（`# 标题` + `## 场景` 格式）
3. 选视觉模板
4. 点「开始渲染」
5. 视频保存到 Movies/TruVid/
