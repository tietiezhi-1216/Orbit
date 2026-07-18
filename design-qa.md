# Design QA — Tietiezhi Desktop 标题扫光优化

- 用户反馈截图：`/var/folders/dh/4xyy8_s111dfpk0msplz51_h0000gn/T/codex-clipboard-c6b17eeb-04cc-4d72-aa18-47f83229fbda.png`
- 桌面端实现：`/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-polish/final-shine-desktop.png`
- 移动端实现：`/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-polish/final-shine-mobile.png`
- 标题区域裁图：`/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-polish/final-shine-title-crop.png`
- 前后对照：`/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-polish/compare-title-sweep-before-after.png`
- 验证视口：1280 × 720；390 × 844
- 验证版本：v0.0.1

## 视觉结论

原效果的深色大面积斜切层破坏了标题字形，静止帧会像标题被挖掉一块。新效果保留完整白色标题，只让一条窄幅青白紫高光穿过字面；外围光束被裁切在标题附近，透明度控制在 0.16 以下，不再出现黑色块面。

## 关键设计面

- 字体与层级：标题字号、字重、字距和换行均保持不变，底层白字始终完整可读。
- 光效：扫光使用窄幅羽化渐变，周期从 3.2 秒调整为 5.2 秒并改为匀速，避免突然切入。
- 色彩：沿用页面现有青蓝、冷白、浅紫光谱，不新增突兀色块。
- 布局：下载卡片、平台图标、星空、页面扫光和正文位置均未改动。
- 可访问性：光效层保持 `aria-hidden`；系统启用减少动态效果时不播放动画。

## 对照与修复历史

- [P1] 原深蓝斜切多边形覆盖标题中心，破坏 `Tietiezhi` 字形完整性。
- 修复：删除深色文字裁切层，改为独立白字底层 + 窄幅渐变文字层 + 低透明度位图光束。
- 复核：组合对照图显示标题不再被切断，动画采样时 `background-position` 为 57.15%，且持续移动。

## 运行检查

- 桌面端标题尺寸 656.14 × 80 px，无横向溢出。
- 移动端标题尺寸 275.48 × 33.59 px，无横向溢出。
- 桌面端和移动端均正确显示 `v0.0.1`。
- 动画名称为 `title-shine`，页面正常加载。
- Tailwind 产物已重新构建。

## 验收清单

- [x] 去除黑色/深色硬切块
- [x] 白色标题始终完整
- [x] 窄幅冷色扫光可见
- [x] 动画节奏更慢、更平滑
- [x] 桌面端与移动端无溢出
- [x] 前后对照完成

final result: passed
