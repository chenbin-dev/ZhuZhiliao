# 竹知了 3D 仿真游戏

使用 Three.js 渲染的传统竹知了网页游戏。薄竹片会因二次空气阻力逐渐停转；“哇呜”声完全由 Web Audio API 实时合成，不含预录音频。

## 启动

```bash
npm install
npm run dev
```

在终端给出的本地地址打开页面。首次点击“唤醒知了”后，浏览器才允许播放实时合成声音。

## 操作

- 在“搓动”区左右快速拖动，可持续加速。
- 直接拖动 3D 模型，可旋转观察。
- “竹鸣 / 你干嘛”可切换实时合成竹鸣和随转动循环播放的人声音轨；默认是竹鸣。
- 点击“手势”并授予摄像头权限，双手同时入镜做相对搓动可控制转速。
- 支持传感器的移动设备可启用“摇一摇”加速。

## 实现说明

- `Three.js`：立体竹签、节、握持部、薄竹片和高速残影。
- `Web Audio API`：锯齿波、泛音、程序化滤波噪声与速度相关颤动组成的实时声响。
- 物理模型：`dω/dt = -0.27ω - 0.00125ω²`，同时表达轴承摩擦与切风阻力。
- `MediaPipe Hand Landmarker`：跟踪双手掌心相对横向位移来驱动加速。
- 最佳鸣叫时长保存在浏览器 `localStorage`。

## EdgeOne Pages 持续部署

项目已包含 `edgeone.json` 和 `.github/workflows/edgeone-pages.yml`。工作流在推送到 `main` 或手动运行时执行 `npm ci`、`npm run build`，并将 `dist` 部署到 EdgeOne Pages。

首次配置步骤：

1. 在腾讯 EdgeOne Pages/Makers 控制台创建项目，记录项目名称和 API Token。
2. 在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中新增 Repository variable `EDGEONE_PROJECT_NAME`，值为 EdgeOne 项目名称。
3. 在同一页面的 Secrets 中新增 `EDGEONE_API_TOKEN`，值为 EdgeOne API Token。Token 只保存到 GitHub Secrets，不要写入代码或提交到仓库。
4. 推送到 `main` 后查看仓库 `Actions` 页面；工作流成功即完成生产部署。EdgeOne 控制台也可以直接关联 GitHub 仓库并选择 `main` 作为生产分支。

构建设置与 `edgeone.json` 保持一致：构建命令为 `npm run build`，输出目录为 `dist`。摄像头手势和摇一摇需要通过 `localhost` 或 HTTPS 访问，部署后的 EdgeOne 域名满足安全上下文要求。

## 运行时资源

启用手势时会从 jsDelivr 和 Google MediaPipe 模型地址加载 WASM 与手势模型。默认竹鸣不使用预录音频；“你干嘛”模式使用项目内 `public/audio/you-gan-ma.mp3`。
