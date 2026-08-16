# 项目说明

## 当前状态

原生 JavaScript 的 Vite 单页游戏，包含 Three.js 渲染、物理模拟、实时 Web Audio、鼠标/触摸/摇动/MediaPipe 手势控制与挑战记分。

## 项目结构

- `index.html`：页面结构和操作控件。
- `src/main.js`：3D 场景、物理、音频、交互与手势逻辑。
- `src/styles.css`：响应式 UI 和声波视觉反馈。
- `public/audio/you-gan-ma.mp3`：用户提供的“你干嘛”模式循环音轨。
- `package.json`：启动脚本与依赖。
- `README.md`：启动与操作说明。

## 启动

使用 Node.js 20+ 执行 `npm install`，然后运行 `npm run dev`。

手势功能要求 localhost 或 HTTPS、摄像头权限以及 MediaPipe CDN 可访问。默认竹鸣通过 Web Audio API 合成；人声音轨仅在用户明确选择“你干嘛”模式时播放。项目没有敏感配置或密钥；未来如有敏感值，必须通过 `.env` 引入。
