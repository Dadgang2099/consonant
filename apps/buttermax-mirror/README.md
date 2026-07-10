# ButterMax — stand-in mirror

A self-contained, single-file recreation of the **buttermax.net** layout, built to
play with for an update. The live site couldn't be fetched from the build
environment (network policy blocked outbound access), so **all copy, imagery, and
exact colors are placeholders** — the point of this mirror is the **structure and
per-section behavior**, which you can recolor and repopulate freely.

## Run it

It's plain static HTML — no build step.

```bash
# from repo root
open apps/buttermax-mirror/index.html          # macOS
# or serve it
npx serve apps/buttermax-mirror
```

## What's here

Everything lives in `index.html` (inline CSS + vanilla JS, no dependencies,
no external fonts/images so it works fully offline).

### Sections (top → bottom)
1. Dismissible announcement bar
2. Sticky nav (transparent → blurred/solid on scroll) + mobile drawer
3. Hero with an animated "butter ribbon" canvas + live FPS chip
4. Logo marquee (infinite scroll, pauses on hover)
5. Features bento grid (hover lift + pointer tilt)
6. "How it works" — 3 numbered steps
7. Before/After drag-to-compare slider
8. Stats band (count-up on scroll into view)
9. Testimonials carousel (autoplay + prev/next + dots)
10. Pricing (monthly/yearly toggle) with 3 tiers
11. FAQ accordion (single-open)
12. CTA band
13. Footer (link columns + newsletter) + back-to-top button

### Behaviors
Light/dark theme toggle (persisted), scroll-reveal, sticky-nav state, mobile
menu, marquee, hover tilt, drag slider, animated counters, autoplay carousel,
pricing toggle, accordion, smooth-scroll anchors, back-to-top. All motion
respects `prefers-reduced-motion`.

## Recolor in one place
Every color is a CSS custom property in the `:root` blocks at the top of the
`<style>` — light tokens, a `@media (prefers-color-scheme: dark)` block, and
explicit `[data-theme]` overrides. Change the accent (`--accent`) and grounds
(`--bg`, `--surface`, `--text`) to match the real brand and the whole page
follows.
