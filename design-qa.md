# Design QA — Codex 风格黑色阴影扫光

- source visual truth: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-shadow/codex-official-reference.png`
- previous implementation: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-polish-visible/after-sweep-visible-desktop.png`
- implementation desktop: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-shadow/dark-shadow-sweep-desktop.png`
- implementation mobile: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-shadow/dark-shadow-sweep-mobile.png`
- focused comparison: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-shadow/compare-color-to-dark-shadow.png`
- viewport: 1280 × 720 desktop; 390 × 844 mobile
- state: `v0.0.1`, title sweep sampled near 61% background position

## Reference observation

OpenAI Codex 当前官网标题采用纯色文字，不在字面叠加彩色光晕；视觉质感主要来自背景中柔和、低频的明暗变化。实现据此采用单色、低频、柔边的阴影扫光，而不是复制官网布局或背景。

## Full-view comparison evidence

首页原有星空、角色、下载卡片与排版保持不变。彩色文字高光已移除，页面仍有原本的环境光和星空动画，因此标题不显得孤立。

## Focused region comparison evidence

对照图上半部分为青蓝紫彩色扫光，下半部分为新的炭黑阴影扫光。新版本通过多段透明度渐变形成羽化边缘，没有早期版本的硬多边形切口，也不再产生彩色模糊。

## Findings

- No actionable P0/P1/P2 findings.

## Comparison history

- Earlier finding [P1]: 彩色高光在白色标题上显得模糊，与用户要求的黑色阴影方向不符。
- Fix: 删除标题外部位图光束，将字面渐变改为透明 → 深灰 → 炭黑 → 深灰 → 透明的对称软边带，并把周期调整为 5.8 秒缓入缓出。
- Post-fix evidence: 桌面和移动截图中阴影只存在于字形内部，白色基础标题保持完整；组合对照图清楚显示色彩与锐度变化。

## Runtime checks

- Desktop title: 656.14 × 80 px; no horizontal overflow.
- Mobile title: 275.48 × 33.59 px; no horizontal overflow.
- Animation: `title-shine 5.8s ease-in-out infinite`.
- Overlay text remains transparent outside the gradient band.
- Reduced-motion fallback remains enabled.
- Browser warnings/errors: none.

final result: passed
