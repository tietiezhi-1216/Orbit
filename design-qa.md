# Design QA — 标题阴影扫光减速

- source visual truth: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-shadow/dark-shadow-sweep-desktop.png`
- implementation screenshot: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-slower-shadow/slower-shadow-desktop.png`
- focused timeline comparison: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-slower-shadow/slower-shadow-timeline.png`
- viewport: 1280 × 720; responsive spot-check at 582 × 964
- state: `v0.0.1`, animation sampled at 0.8-second intervals and captured at 2.2 / 3.6 / 5.0 seconds

## Codex reference observation

Codex 当前官网没有文字扫光，标题保持静止；动态主要来自缓慢变化的背景柔光。因此本页没有继续增强扫光频率，而是增加静止时间并降低阴影移动速度。

## Full-view comparison evidence

标题样式、阴影颜色、页面布局和其他动画均未变化，只调整标题动画时间。完整截图显示无布局回归或横向溢出。

## Focused region comparison evidence

三帧时间轴分别展示扫光前、扫光中和扫光后的状态。标题大部分时间保持纯白，炭黑阴影只在中间阶段缓慢经过。

## Findings

- No actionable P0/P1/P2 findings.

## Comparison history

- Earlier finding [P2]: 5.8 秒周期中实际移动约 2.2 秒，扫光出现频率和移动速度偏快。
- Fix: 周期调整为 8.8 秒；静止区间改为 0–20% 与 60–100%，移动区间扩展到约 3.5 秒。
- Post-fix evidence: 浏览器计算动画时长为 `8.8s`，0.8 秒采样记录显示起始位置保持两帧，随后平滑移动；时间轴显示完整的静止—阴影—静止节奏。

## Runtime checks

- Animation: `title-shine 8.8s ease-in-out infinite`.
- Background position changes from 145% to -55%.
- No horizontal overflow at tested viewports.
- Browser warnings/errors: none.
- Reduced-motion fallback remains enabled.

final result: passed
