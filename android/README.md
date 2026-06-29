# TruthVideo Android App

TruthVideo 的安卓客户端。通过 GitHub Actions 云渲染，无需在手机上安装 Node.js/ffmpeg。

## 工作原理

```
你的手机 (APK)                    GitHub 云端 (Actions)              你的手机 (APK)
    │                                   │                               │
    ├─ 输入 Markdown ──────────────────►│                               │
    │                                   ├─ 安装依赖 (Node/ffmpeg/...)   │
    │                                   ├─ 渲染视频                     │
    │                                   ├─ 上传 Artifact                │
    │                                   │                               │
    │◄────── 下载视频 ──────────────────┤                               │
```

## 使用方法

1. **生成 GitHub Token**
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 和 `workflow` 权限
   - 复制 Token

2. **安装 APK**
   - 在 Releases 或 Actions 的 Artifacts 中下载 APK
   - 手机打开安装（允许未知来源应用）

3. **使用 App**
   - 打开 TruthVideo
   - 输入 GitHub Token 和仓库名（默认 `malaxiya2019/truth-video`）
   - 写入 Markdown 内容
   - 选择讲师/模板/画质
   - 点击「开始渲染」
   - 等待 3-8 分钟
   - 点击「下载视频」

## 从源码构建

在 GitHub Actions 中运行 **Build APK** 工作流即可自动编译。
