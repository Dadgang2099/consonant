# iPhone Scroll Hero — Agent Onboarding

This file is the authoritative entry point for any agent picking up this prototype.
Read this before touching any code. Then read `docs/ARCHITECTURE.md`.

---

## What This Is

A scroll-driven interactive prototype that proves a new approach to design QA and authoring:
panels of real controls float over a live webpage and let a designer adjust animation values,
typography, layout, and imagery in real time — with a timeline to keyframe any value against scroll position.

The live URL is **https://justus.agency** (redirects to `/demos/iphone-scroll/`).
The repo is at `/Users/ecoakley/dev/projects/consonant` on the local machine.
The working branch is `feat/iphone-scroll-hero`.

---

## Running Locally

```
cd /Users/ecoakley/dev/projects/consonant/demos/iphone-scroll
node server.js
```

Then open `http://localhost:3737`. No build step. No npm install required for the demo itself.

The repo uses Nx and has a `package.json` at the root, but the demo is vanilla JS/CSS/HTML
and runs standalone.

---

## Deploying

**There is no auto-deploy.** Pushing to GitHub does NOT trigger Vercel.

```
cd /Users/ecoakley/dev/projects/consonant
vercel --prod --yes
git push personal feat/iphone-scroll-hero
```

- Vercel project: `ecoakleyadobecoms-projects/consonant` (id `prj_nsvh4gzyX7DORXZATXluCykQwuTD`)
- Aliases: `justus.agency`, `scroll.justus.agency`, `consonant-alpha.vercel.app`
- `vercel.json` at repo root sets `buildCommand: ""`, `outputDirectory: "."`,
  redirects `/` → `/demos/iphone-scroll/`
- Push goes to `personal` remote (GitHub: `Dadgang2099/consonant`), NOT `origin` (Adobe org fork)

To verify a deploy landed: `curl -s https://justus.agency/demos/iphone-scroll/styles.css | grep "some-known-string"`

---

## Key Files

| File | Purpose |
|---|---|
| `demos/iphone-scroll/index.html` | ~1535 lines — all panel HTML, section HTML, canvas elements |
| `demos/iphone-scroll/main.js` | ~7300 lines — all logic, split into IIFEs (see Architecture) |
| `demos/iphone-scroll/styles.css` | ~5700 lines — all styling including panel system, animation, themes |
| `demos/iphone-scroll/assets/` | hero.mp4, phone_endframe.jpg, phone_endframe_mask.svg, triptych images, camera images, phone_360/ frames |
| `api/ai-edit.js` | Vercel serverless — proxies AI edit requests (key in Vercel env) |
| `api/jira.js` | Vercel serverless — creates Jira tickets from annotations |
| `api/jira-attach.js` | Vercel serverless — attaches screenshots to Jira tickets |
| `api/slack.js` | Vercel serverless — posts annotation comments to Slack |
| `demos/iphone-scroll/api/live-json.js` | Serves live.json for the live-push system |
| `demos/iphone-scroll/api/push-live.js` | Accepts live value pushes from the prototype |

---

## The Sections (Scroll Order)

1. **Hero** — scroll-scrubbed video (`hero.mp4`) drives `video.currentTime`; phone PNG
   crossfades in at video end using the S-formula (see Architecture)
2. **Phone hero** — static phone with content overlay, headline, CTA buttons; garage-door
   reveal slides phone off the top
3. **Triptych** — three product cards with parallax, individual image-replace capability
4. **Pro Camera** — camera lens cluster animates as triptych exits; cluster rotation,
   per-lens XY/scale/panel-rotation driven by scroll
5. **360 Sequence** — `phone_360/` frame sequence (64 webp frames) driven by s6 scroll
   position; scrim fades in, phone rises from below

---

## Panel System Overview

Seven panels, each a `div.pw-panel`:

| Panel ID | Controls | Appears when |
|---|---|---|
| `seqPanel` | Scroll speed, lens in/out/peak | Hero section active |
| `tweakPanel` | Phone scale, yRef, xOff, shadow | Phone crossfade active |
| `shadowPanel` | Shadow color, blur, spread | With tweakPanel |
| `contentPanel` | Headline, body, CTA text/size/position | Content overlay active |
| `cardsPanel` | Per-card image, position, alignment | Triptych in viewport |
| `cameraPanel` | Lens XY/scale, cluster rotation | Camera section active |
| `s6Panel` | Scrim opacity, split %, phone Y start/end, X offset, height, opacity | 360 sequence active |

All panels are:
- Portalled to `document.body` on init (avoids stacking context traps from `.stage`)
- Draggable via header mousedown
- Resizable via left/right edge strips
- Z-index near `Number.MAX_SAFE_INTEGER` (rule: ALL PANELS OVER ALL CONTENT)

**Never** set a non-`auto` z-index, `opacity`, `transform`, `filter`, or `backdrop-filter` on
any ancestor of a panel — this creates a stacking context and clips the panel.

---

## Critical Rules for Any Agent

### 1. Read before building
When a file, asset, or class you haven't opened is relevant, Read it first.
Never assume mask values, shadow values, scale factors, or offset values.

### 2. Pixel parity is the standard
The user (Eric) treats every pixel as load-bearing. "Close enough" is a failure.
Test panel padding before reporting done — border-radius clips content without horizontal padding.

### 3. Bake-in values: always three layers
When pushing default values into the build, update all three:
- HTML `value` attribute on the input
- JS state object (e.g. `const G = { scrimOpa: 0.78 }`)
- The wire/bind function — confirm it seeds state from HTML on load (not just on `input` events)
Missing one layer means the value is stale on page load.

### 4. Panel bodies use CSS max-height for accordion
Section bodies (`.pw-sec__body`) have `max-height: 400px` in CSS for the open state.
Collapse is toggled via the `pw-sec--collapsed` class (`max-height: 0 !important`).
Do NOT set inline `maxHeight` on section bodies — JS measurement is unreliable when
the parent panel body is `display:none` at page init.

### 5. The S formula — never hardcode video dimensions
```js
const S = Math.max(W / VIDEO_NATIVE_W, H / VIDEO_NATIVE_H);
```
This replicates `object-fit: cover`. Video native dimensions must come from `mdls` or
MediaInfo, not guessed. hero.mp4 is 1894×1440. Getting this wrong breaks every viewport.

### 6. No overflow-x:hidden or touch-action on html/body
Both kill `position: sticky` on `.stage`. The phone scrub stops working. Use
`overscroll-behavior-x: none` on body instead.

### 7. Weld animated components
Two separately-positioned elements kept in sync via CSS vars always desync during
transitions. If two things move as one, make them one DOM element.

### 8. Off-panel picker lookup
`panel.contains(inp)` alone misses popovers that render outside the panel DOM.
Always pair with an id-prefix fallback: `inp.id.startsWith(panelId.replace(/Panel$/, ''))`.

### 9. Hover ≠ delete
Never put a destructive affordance on a hover state that covers a click+drag target.
Delete UI only surfaces on the `--selected` state.

### 10. KF capture uses `change`, not `input`
Slider drag fires `input` 30+ times. `change` fires once on release. KF auto-capture
listens on `change` only.

---

## Environment Variables (Vercel)

These live in Vercel project settings, not in the repo:
- `ANTHROPIC_API_KEY` — used by `api/ai-edit.js` for AI panel text edits
- `JIRA_TOKEN`, `JIRA_BASE_URL`, `JIRA_PROJECT_KEY` — used by `api/jira*.js`
- `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` — used by `api/slack.js`

For local dev: create `demos/iphone-scroll/.env.local` with the same keys and load via
`node -r dotenv/config server.js` or export them before running.

---

## MCP Connections Active in This Project

- **figma-console** — Figma plugin MCP; allows reading/writing Figma files from Claude
- **figma** — Figma REST API MCP; read comments, post comments, view nodes
- **claude.ai Adobe MCPs** — AEM Content (Dev/Stage/Prod), AEM DA, Adobe Analytics,
  Adobe CJA, Adobe Illustrator, Adobe Experience Manager Stage, Frame.io, Firefly,
  Stock, Marketing Agent, Experience Governance, and others
- **mcp__plugin_vercel_vercel** — Vercel MCP; deployment, logs, project management

The canonical Figma file for this initiative is **"Elliot"**
(key: `amSaJWzzROsV1Q00L9hPl8`, canonical node: `7563-11467`).

---

## What "Panels" Means

When Eric says "panels", "the timeline", "the dock", or "keyframes" —
he means the `demos/iphone-scroll` prototype and its full animation system.
Always load this context first.
