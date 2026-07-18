# Design QA — Codex 式余弦阴影扫光

- source visual truth: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-slower-shadow/slower-shadow-timeline.png`
- implementation desktop: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-cosine/codex-cosine-desktop.png`
- implementation mobile: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-cosine/codex-cosine-mobile.png`
- focused timeline: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-cosine/codex-cosine-timeline.png`
- comparison: `/Users/tietiezhi/.codex/visualizations/2026/07/18/019f74a2-91b9-79b2-8054-98d9b589d2b7/release-codex-cosine/compare-linear-vs-cosine.png`
- viewport: 1280 × 720 desktop; 390 × 844 mobile
- state: `v0.0.1`, 8.8-second cycle sampled before, during, and after the sweep

## Source implementation grounding

Codex TUI computes a cosine intensity curve across characters: the band is darkest at its center and falls smoothly to zero at both edges. The website implementation approximates the same curve with symmetric CSS gradient stops while retaining the homepage-appropriate long pause between passes.

## Full-view comparison evidence

Only the title overlay gradient changed. Typography, layout, starfield, mascot, page sweep, and download cards remain unchanged. Desktop and mobile captures show no horizontal overflow.

## Focused region comparison evidence

The side-by-side timeline places the earlier asymmetric angled shadow on the left and the new symmetric vertical cosine approximation on the right. The new band has matching falloff on both sides and no colored or blurred edge.

## Findings

- No actionable P0/P1/P2 findings.

## Comparison history

- Earlier finding [P2]: the shadow used an asymmetric 105-degree linear gradient, so its entry and exit did not match Codex's per-character cosine falloff.
- Fix: changed the angle to 90 degrees and introduced symmetric opacity samples at 10%, 40%, 70%, 82%, 70%, 40%, and 10% around the center.
- Post-fix evidence: timeline captures show a centered dark band with even feathering before returning to intact white text; desktop and mobile layouts remain stable.

## Runtime checks

- Animation remains `title-shine 8.8s ease-in-out infinite`.
- Overlay text computes to transparent outside the gradient.
- Desktop title: 656.14 × 80 px.
- Mobile title: 275.48 × 33.59 px.
- Browser warnings/errors: none.
- Reduced-motion fallback remains enabled.

final result: passed
