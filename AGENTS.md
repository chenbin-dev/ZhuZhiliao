# 项目说明

## 当前状态

原生 JavaScript 的 Vite 单页游戏，包含 Three.js 渲染、物理模拟、实时 Web Audio、鼠标/触摸/摇动/MediaPipe 手势控制与挑战记分。项目已接入 EdgeOne Makers 持续部署：推送 `main` 会触发 GitHub Actions 构建验证，Makers 的 GitHub Provider 自动发布该提交。

## 项目结构

- `index.html`：页面结构和操作控件。
- `src/main.js`：3D 场景、物理、音频、交互与手势逻辑。
- `src/styles.css`：响应式 UI 和声波视觉反馈。
- `public/audio/you-gan-ma.mp3`：用户提供的“你干嘛”模式循环音轨。
- `edgeone.json`：EdgeOne Makers 的构建命令和输出目录配置。
- `.github/workflows/edgeone-makers.yml`：main 分支的构建验证工作流。
- `package.json`：启动脚本与依赖。
- `README.md`：启动、操作与部署说明。

## 启动

使用 Node.js 20+ 执行 `npm install`，然后运行 `npm run dev`。

手势功能要求 localhost 或 HTTPS、摄像头权限以及 MediaPipe CDN 可访问。默认竹鸣通过 Web Audio API 合成；人声音轨仅在用户明确选择“你干嘛”模式时播放。项目不需要向 GitHub Actions 注入 EdgeOne API Token；部署由 Makers 的 GitHub Provider 执行。

## 部署

在 EdgeOne Makers 中关联 GitHub 仓库并选择 `main` 作为生产分支后，推送到 `main` 会自动发布；在 Actions 页面手动运行 `EdgeOne Makers 构建验证` 可单独检查构建。
