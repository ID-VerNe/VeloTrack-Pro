# VeloSync (Android Companion App)

VeloTrack Pro 原生 Android 数据中继伴侣应用。

专为解决手机端骑行数据导出、脱敏与同步的痛点而打造。打通**华为运动健康 / Garmin 导出 $\rightarrow$ 系统一键分享 $\rightarrow$ 端侧本地隐私圈裁剪与 GCJ-02 纠偏 $\rightarrow$ 静默自动同步至云端**的无感闭环。

---

## 核心设计哲学

1. **定位极简**：坚决不做重型的移动端大屏图表或分析器，纯粹定位为高能、轻量的**系统级中继伴侣（Companion Uploader）**。安装包体积仅约 **7MB**。
2. **零信任端侧脱敏**：任何涉及家庭、公司等隐私区域的轨迹裁剪，**100% 在 Android 手机本地完成**，敏感原始坐标绝不出设备。
3. **极速无感体验**：点击分享后，屏幕底部弹出半透明微卡片显示进度，1~2 秒内自动同步并关闭退出，不打扰前台正在使用的其他应用。

---

## 核心功能特性

### 1. 系统级分享 Intent 接管
- 注册 `Intent.ACTION_SEND` 与 `ACTION_VIEW`，支持 `application/*`、`text/xml` 与 `.tcx` 扩展名。
- 无论从【华为运动健康】导出分享，还是从系统文件管理器点击 TCX 文件打开，均可一键直达。

### 2. 遥测核心计算引擎 (`core/`)
- **`TcxParser.kt`**：基于 Android `XmlPullParser` 的流式解析器，内存占用低（< 5MB），秒级解析数万个航点。
- **`GeoCalculations.kt`**：
  - WGS-84 $\rightarrow$ GCJ-02 国测局高精度火星纠偏算法。
  - 球面 Haversine 大圆距离解算。
  - 道格拉斯-普克（Ramer-Douglas-Peucker）轨迹抽希降采样算法。
  - 心率区间（Z1~Z5）累积时长计算。
- **`PrivacyScrubber.kt`**：
  - **圈内抹除**：距离隐私圈中心点 $R + 50\text{m}$ 内的点位彻底清除。
  - **垂足防穿透**：计算相邻两点线段到圆心的垂足距离，穿透圆圈的线段自动截断。
  - **起点安全缓冲**：起点 $300\text{m}$ 范围内如果涉及隐私圈，整段初始起步轨迹自动抹除。
  - **Google Polyline 压缩**：脱敏后自动重新编码为高压缩率的 Polyline 字符串。
- **`ActivityAggregator.kt`**：
  - 自动剔除静止点，精确解算停表有效骑行均速（Moving Avg Speed）与全历时均速。

### 3. Cloudflare Zero Trust 穿透与一键扫码配对 (`data/`)
- **Service Auth 凭证注入**：原生支持在请求头中自动注入 `CF-Access-Client-Id` 与 `CF-Access-Client-Secret`，轻松穿透企业级安全门禁。
- **ZXing 扫码配对**：支持直接扫描 VeloTrack Pro Web 端【配对手机】二维码，一键导入服务域名、Admin 令牌及 Zero Trust 凭证，并自动进行前缀正则清洗。
- **Jetpack DataStore 持久化**：安全保存凭据及离线缓存的隐私圈区域数据。

---

## 快速上手与配置

### 1. 扫码配对
1. 在 PC 浏览器打开 VeloTrack Pro，进入【数据导入】页面；
2. 点击右上角【**配对手机 (VeloSync)**】；
3. 手机打开 VeloSync App，点击【**扫码配对电脑端**】对准屏幕二维码；
4. 点击【**立即同步隐私圈**】，确认主页显示“已就绪，等待数据同步”。

### 2. 日常使用
1. 打开手机【**华为运动健康**】$\rightarrow$ 找到任意骑行记录；
2. 点击右上角分享/导出为 **TCX 格式**；
3. 在系统弹出的应用列表中选择 **【VeloSync】**；
4. 底部微卡片显示“正在同步”并在完成入库后自动收起！

---

## 本地编译构建

### 环境要求
- Android Studio Ladybug / Koala 或 Android SDK 35
- JDK 17 / 21
- Gradle 8.9+ (内置 Gradle Wrapper)

### 命令行编译与安装
```bash
cd apps/android

# 运行核心算法单元测试
./gradlew testDebugUnitTest

# 编译并直接安装到已连接的真机/模拟器
./gradlew installDebug
```
