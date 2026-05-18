# The Initiative: Closing the Gap Between Design Intent and Shipped Experience

## The Problem That Doesn't Have a Name Yet

Every modern interactive design project has the same invisible tax: the translation tax.

A designer produces a Figma frame showing a scroll-driven hero. The frame has motion specs
annotated in a comment: "parallax multiplier 0.6, ease-out cubic, 300ms." An engineer
reads those specs and implements them. The implementation goes to QA two weeks later.
The designer looks at it and says, "that's not quite right." Three more back-and-forth
rounds follow. The experience that ships is a reasonable approximation of what was designed.

This is not a workflow problem. It is a medium problem. Figma operates in static frames.
The web operates in scroll, time, physics, and viewport. Every handoff between those two
mediums introduces loss. The loss is structural — it cannot be fixed by better specs,
better tools, or faster engineers working in the current model.

According to Figma's own 2025 survey, 91% of developers and designers report that the
handoff between design and development could be improved. InVision — the platform that
defined collaborative design for a decade — shut down entirely in 2024. The industry
knows the current model is broken. It doesn't yet have a replacement.

This initiative proposes one.

---

## The Thesis

**The design medium should be the production medium.**

Not a prototype. Not a simulation. Not a Figma component that approximates what the page
will look like. The actual page — running real CSS, real scroll physics, real video, real
typography — with controls that reach into every value that matters.

When a designer adjusts a parallax multiplier and sees it live on the production page,
the translation step is eliminated. The control IS the spec. The keyframe IS the motion
spec. The exported values are not a description of what to build — they are what to commit.

---

## What the Prototype Proves

The iPhone scroll hero demo was chosen as the proof vehicle deliberately.

It is among the hardest categories of interactive web design to get right: a scroll-scrubbed
video that must stay pixel-locked to a static asset across every viewport size, a multi-phase
crossfade that must be tuned by feel rather than formula, per-section animation timing that
only makes sense when experienced in the browser, and a 360-frame phone sequence that
must feel physically real. Getting any of this right in Figma is impossible. Getting it
right via designer → spec → engineer → QA typically takes weeks.

This prototype was built by one designer and one AI agent in a single sprint, with the
designer making every visual decision in the browser, in real time, at production fidelity.

The proof is not that the demo looks good. The proof is how it was made.

---

## What "Controls as Deliverable" Means

Current design deliverables are descriptions of intent: Figma frames, motion specs,
redlines, handoff comments. They describe what to build.

The panel system inverts this. The controls that adjust the experience ARE the deliverable:

**Scroll-value controls:**
- Every scroll-driven value — position, scale, opacity, timing, parallax depth — is exposed
  as a slider connected to a keyframe system
- Adjusting a slider is not a note to an engineer; it is the edit, live, at production fidelity
- Keyframing a value against scroll position creates the animation spec directly as data

**Timeline:**
- Per-input colored lanes show all keyframed values against scroll position simultaneously
- The playhead mirrors page scroll in real time — scrubbing the page IS previewing the timeline
- Undo/redo for any sequence of edits; 10-deep history

**Copy All:**
- One button outputs all keyframe values as diff-ready code
- The output is not documentation — it is the commit

**Asset hot-swap:**
- Drag a new image onto any asset target; it replaces immediately at production fidelity
- A designer can evaluate a new hero image at the correct scale and scroll position before
  the image is approved

**Annotation layer:**
- Comment anchors stay welded to their scroll position as the page moves
- Draw layer for markup directly on the live page
- One-click Jira ticket creation with screenshot, scroll position, and keyframe values attached
- Slack routing directly to the relevant team

The designer stays in the page. The session produces keyframe values, annotation records,
and adjusted defaults. Not a spec document that someone else will interpret.

---

## The Gap No Existing Tool Closes

CSS Scroll-Driven Animations — the native browser mechanism for exactly this kind of
scroll-linked motion — reached 82.96% browser coverage in 2025. The capability exists
in the platform. There is no visual authoring tool for it. Framer exports custom React.
Webflow exports its own runtime. Neither operates on an existing production codebase.
Neither has a timeline connected to real scroll physics. Neither lets a designer open
the actual target URL and adjust values on the live DOM.

The landscape as of 2025–2026:

| Tool | Production page? | Scroll physics? | Timeline? | VQA? | Agent tools? |
|---|---|---|---|---|---|
| Figma / Figma Motion | No | No | Limited | No | No |
| Framer | No (exports React) | Limited | No | No | No |
| Webflow | No (exports Webflow) | Limited | No | No | No |
| Builder.io | No | No | No | No | Limited |
| Storybook / Chromatic | Component only | No | No | Post-commit | No |
| **This approach** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

The combination — production-faithful page + visual controls + keyframe timeline +
annotation + VQA + agent-connected tool suite — does not exist anywhere else.

---

## Phase 2: Adobe.com on Edge Delivery Services

Adobe.com runs on Edge Delivery Services (EDS). Design and motion changes still require
a developer to implement them. A designer who wants to adjust the feel of a scroll
animation on a live adobe.com page today must write a ticket, wait for an engineer,
review the implementation, and iterate — the full translation cycle.

EDS is structured around flat Markdown/HTML documents served via CDN with a thin JS
layer. This is, architecturally, exactly the kind of production page that the panel
system can overlay.

Phase 2 applies the same approach directly to adobe.com:

1. **The panel system ports to overlay any target URL** — iframe injection or bookmarklet;
   the designer opens the live adobe.com page, the panels float over it
2. **The keyframe system connects to EDS design tokens and animation variables** — adjusting
   `--ease-standard` changes all instances across the page simultaneously
3. **The "bake" command produces a diff against the EDS codebase** — values are not
   copied into a spec; they are ready to commit
4. **The annotation system routes to the actual Jira boards and Slack channels the team uses**

What changes at adobe.com scale:
- **Global tokens**: `PARALLAX_BASE`, `--ease-standard`, `--section-gap` — one value
  cascades to every instance on every page that uses it
- **Section vs. component scope**: a panel can target one card's Y position or a
  global spacing token; the scope is explicit and visible
- **VQA integrated continuously**: not post-commit regression testing, but real-time
  diffing against the approved state as the designer makes edits

---

## The Agent Layer

The prototype already has an AI bar. It proxies to Claude for text edits: "make this
headline more urgent" → Claude rewrites the headline in the contentPanel. This is
the beginning of a pattern that goes much further.

The design session of the future does not require the designer to switch between
Figma, a browser, Slack, Jira, Frame.io, the CMS, and a code editor. An agent
handles the tool-switching. The designer stays in the page.

### Active MCPs in This Project Environment

The following MCPs are live in the current project:

- **AEM Content** (Dev/Stage/Prod) — read/write page content in Adobe Experience Manager
- **AEM DA** — Document Authoring: edit EDS source documents directly
- **Adobe Analytics / CJA** — pull engagement data to inform design decisions in context
- **Adobe Illustrator** — generate or modify vector assets without leaving the session
- **Adobe Experience Manager Stage** — preview content changes before publishing
- **Frame.io** — pull approved video cuts, review assets against revision history
- **Firefly** — generate images from text descriptions inline; iterate without opening another app
- **Adobe Stock** — find and license assets in context
- **Figma** (console + REST) — read component specs, sync design tokens, post review comments
- **Vercel** — deploy the current state, roll back, check logs

### The Connected Session

1. Designer opens the prototype overlaid on a live adobe.com/stage page
2. Adjusts a headline in the contentPanel — AI bar queries CJA MCP for what's performing
   on the current version; suggests copy variants backed by engagement data
3. Needs a new hero image — Firefly MCP generates candidates from a description;
   Frame.io MCP pulls the approved video cut; Stock MCP finds a licensed alternative
4. Spots a component that needs design revision — Figma MCP finds the source component,
   opens a side-by-side comparison, creates a review comment with the observed delta
5. Satisfied with the session state — Vercel MCP deploys to preview; AEM MCP pushes
   content to Stage; annotation system creates Jira tickets for remaining open items
6. The commit includes the VQA report, the keyframe diff, and the screenshot record
   of every edit made in the session

The designer did not open a separate app. The agent handled all tool transitions.

---

## The VQA Layer

Visual Quality Assurance today is manual and late: a designer compares the shipped page
against a reference screenshot or Figma frame, after implementation, at the end of the
cycle. Chromatic and Percy catch visual regressions post-commit. They do not give a
designer real-time feedback during the design session.

The VQA layer makes it continuous and connected:

**Real-time diffing:**
- On every panel value change, capture a viewport screenshot
- Diff against the last approved state
- Surface pixel-delta regions as annotation markers on the live page

**Agent-assisted spec check:**
- Agent reads the Figma component spec via MCP
- Agent reads the live page via browser automation
- Agent produces a structured report: "Component X in Figma specifies 24px bottom margin;
  current render shows 18px. Accept or override?"
- Designer's decision is recorded in the session log

**Commit-attached record:**
- When the designer publishes, the VQA report attaches to the git commit
- The report is the source of truth for what was intentionally changed vs. what drifted
- Engineering reviews the diff + the VQA record, not an ambiguous spec

---

## Global Values Architecture

The prototype has per-section panels. Phase 2 introduces a global layer sitting above
the section controls — adjusting values that cascade across the entire experience:

**Shared motion tokens:**
- `PARALLAX_BASE` — all scroll-driven animations reference this multiplier; changing it
  changes the feel of every section simultaneously
- `--ease-standard`, `--duration-fast`, `--duration-slow` — changing one plays all
  animations at once so the designer can feel the system-wide effect

**Typography and spacing tokens:**
- `--type-scale`, `--headline-weight`, `--line-height-dense`
- `--section-gap`, `--component-padding`, `--grid-gutter`

**Micro-adjustments per section:**
- Panel XYZ location (exact position of a UI element within a section)
- Rotation (camera lens angle, card tilt, perspective depth)
- Z-depth (parallax layer assignment)

**The scope model is explicit:** changing `--ease-standard` shows a global preview.
Changing one card's rotation only affects that card. The designer chooses scope;
the tool doesn't blur it.

---

## Success Metrics

These are testable against the current model:

- **Time from decision to staging**: minutes, not days. Measured from panel edit to
  Vercel preview URL with AEM content updated.
- **Handoff rounds eliminated**: zero spec-to-implementation translation passes.
  The keyframe export IS the implementation.
- **VQA defect rate**: percentage of shipped components matching their Figma spec within
  2px and one design token step.
- **Designer confidence**: does the designer feel they have direct control over the
  final shipped experience, not a simulation that will be re-interpreted?

---

## The Longer View

The design industry was built on tools that separated design from building. Photoshop,
Illustrator, Figma — all of them operate in a medium that is not the web. The handoff
is structural to how those tools work.

The proposition here is not a better handoff. It is the elimination of the handoff
as a category.

When a designer adjusts the parallax multiplier and sees it live on adobe.com/stage,
and an agent simultaneously updates the design token, commits the value, runs the VQA
diff, and posts the before/after to the review channel — that is not a workflow improvement.
That is a different model of how web experiences are made.

The iPhone scroll hero demo is the first proof that this model works in practice, on a
real production-quality interaction, without a separate engineering sprint. That was the
hard part. The rest is scope.
