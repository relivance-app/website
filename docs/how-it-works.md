# How It Works page

`/how-it-works/` is a static GitHub Pages route. There is no build step,
framework, animation package, third-party script, or additional production
service. A small homepage link makes it discoverable. The existing waitlist
form, backend, legal pages and deployment configuration are unchanged.

## Architecture and design

The supplied 1200 × 2200 SVG, PNG and PDF are preserved in
`assets/how-it-works/`. The page reconstructs the illustration as reusable SVG
`symbol` glyphs, seven independent station groups, seven connector paths,
moving arrowheads, and semantic HTML captions. It does not animate a poster.
Only the SVG reference is linked; the other two files are not downloaded by
the page. Roboto and the authentic logo come from the existing local assets.
The animation uses Relivance active blue **#5997DF** on white.

Files:

- `how-it-works/index.html`: page, SVG components, all accessible copy and CTA.
- `how-it-works/how-it-works.css`: page-scoped design, sticky stage,
  responsive layout, static/reduced-motion and print presentations.
- `how-it-works/story-motion.mjs`: pure scroll-progress-to-frame evaluator.
- `how-it-works/how-it-works.mjs`: DOM adapter, measurements and lifecycle.
- `tests/how-it-works.test.mjs`: motion and content contracts.
- `tests/how-it-works.browser.cjs`: optional real-browser regression runner.
- `index.html` and `styles.css`: quiet homepage discovery link only.

Native `position: sticky` pins the stage. A passive scroll listener schedules
one `requestAnimationFrame`; the renderer maps the current scroll offset to a
complete frame. It does not ease toward a time-based target, intercept wheel
or touch input, or continue playing after scrolling stops. Reverse scrolling
and arbitrary seeks use the same state function.

GSAP ScrollTrigger would provide useful pinning and scrubbing utilities, but
this site has no dependency or build pipeline. Native sticky plus one explicit
timeline covers this choreography without another runtime. CSS scroll
timelines alone were not chosen because the coordinated SVG camera, sampled
arrowhead positions, fallbacks and state tests benefit from one shared
evaluator. Relevant platform references: [sticky positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)
and [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).

### Timeline

Progress is normalized over a bounded scroll distance (2,400–4,800px,
responsive to stage height). The final 9% holds the complete view.

| Progress | Motion |
| --- | --- |
| 0–.15 | Goal appears; first arrow extends downward. |
| .15–.29 | Camera travels to milestones; next arrow extends. |
| .29–.365 | Network is the focus; the surrounding circle remains hidden. |
| .365–.50 | Camera zooms out around that same network icon. |
| .50–.58 | Clockwise path traces toward Prepare. |
| .58–.66 | Clockwise path traces toward Meeting. |
| .66–.74 | Clockwise path traces toward Save a recap. |
| .74–.82 | Clockwise path traces toward Follow through. |
| .82–.90 | Final path returns to the network. |
| .91–1 | Complete composition holds before normal document flow resumes. |

Node reveals and caption crossfades overlap the relevant path segments. Each
path has normalized `pathLength="1"`; stroke-dashoffset draws the path.
Arrowhead points/tangents are sampled once on initialization. Scroll frames
write transforms, opacity, font size and stroke offset without layout reads.
ResizeObserver, font readiness and viewport changes refresh cached geometry.
Cleanup disconnects listeners and observers; pagehide preserves presentation
geometry for browser history restoration. Scroll anchoring is disabled on this
page so enhancement does not displace a restored scroll offset.

### Mobile and accessibility

Phones use a smaller close-up scale, independent caption layout, fixed physical
12px overview labels, and labels beside the goal spine. `svh` stabilizes the
stage when mobile browser chrome changes. The whole diagram is fitted inside
the graphic area while captions retain readable HTML sizes. Icons remain
vector shapes. Desktop overview labels are 14px.

The ordered HTML sequence is the default presentation. Reduced motion, missing
JavaScript, unsupported sticky positioning, a blocked module or initialization
failure leave all seven steps readable. A skip link leads directly to the
explanation. The decorative SVG and scroll status are hidden from assistive
technology; semantic headings and descriptions are always in the DOM. There
are no live announcements on every scroll frame. Print restores the full text
sequence. CTA text is dark on the brand blue for readable contrast.

## Product accuracy

This is an **intended product journey**, not a claim that every pre-beta
capability is enabled. Goals are explicitly optional in the introduction and
explanation. The page explains user-supplied inputs and does not promise
passive recording, universal correspondence integrations, automatic outreach,
automatic goal changes or guaranteed outcomes. The pre-beta note stays below
the animation rather than complicating its diagram.

Copy was checked against the iOS repository's `origin/main` snapshot
`8493cd5250b1a91d256d4efef2c8c4c4bb237d3e` on 2026-10-23:

- `Relivance/RecapSheet.swift`: user-entered recaps, transcript/text inputs,
  audio attachments, and recording-consent notice.
- `Relivance/MeetingLoop/MeetingPreparationEngine.swift`: saved earlier
  meeting accounts, attendee notes, commitments and goal-related context.
  This does not establish universal raw email/message retrieval, hence
  **“A meeting brief from your saved history.”**
- `Relivance/RelivanceFeatureFlag.swift`: the new meeting brief,
  conversational debrief, pre-generation and automatic task-suggestion flags
  default off. Existing on-demand paths and new gated paths must not be
  conflated.
- `RecapIntelligenceWriter.swift`: legacy automatic downstream writes are
  fenced by `LegacyRecapDerivation.automaticWritesPermitted`. The page says
  users record and follow up on agreements; it does not promise that every
  recap automatically creates tasks.
- `Relivance/GoalCoachService.swift`, `Relivance/ContextCoachService.swift`
  and the corresponding coach flow: clarification and starting-point context
  inform the goal/strategy journey. The website introduces the concept rather
  than claiming these service files alone prove production availability.

These are code-inspection findings, not end-to-end verification of the iOS
app or its deployed backend. The website introduces no app integrations.

## Preview and validation

From the repository root:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Open `http://127.0.0.1:5173/how-it-works/`. The existing waitlist remains on
the homepage; no new signup endpoint or alternate provider is introduced.

There are no lint, type-check or build commands in this plain static site.
Run syntax and automated checks with Node.js:

```sh
node --check how-it-works/how-it-works.mjs
node --check how-it-works/story-motion.mjs
node --test tests/*.test.cjs tests/*.test.mjs
git diff --check
```

The 19 tests comprise 12 existing waitlist checks and seven new motion/content
checks. The browser runner requires Playwright available to Node; it is a QA
tool only and is never shipped to visitors. With Playwright installed outside
the repository, set `NODE_PATH` to its containing `node_modules` directory.
Use an installed Chrome via `HOW_CHROME_PATH`, or Playwright's bundled Chromium:

```sh
HOW_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node tests/how-it-works.browser.cjs
```

Optional environment variables: `HOW_PREVIEW_URL` for another local server and
`HOW_QA_OUTPUT` for screenshot output (defaults to the OS temporary directory).
The runner blocks non-preview network requests, never submits a waitlist
entry, and checks:

- Desktop 1440 × 1000, phone 390 × 844, and small phone 320 × 568.
- Exact forward/reverse state equality, paused-scroll stability, complete-view
  label bounds and collisions, and no horizontal overflow.
- Reload and browser-back restoration midway through the animation, resizing,
  and switching reduced motion on and off.
- Reduced-motion, disabled-JavaScript and failed-module static presentations.
- Existing homepage/legal routes, discovery navigation and original CTA.

All these checks passed in installed headless Google Chrome, with desktop,
phone and static-fallback screenshots inspected. Physical iPhone Safari,
Firefox, screen-reader interaction and real touch performance remain
unverified. Stable `svh` is used deliberately; physical device review remains
valuable before release.

## Release boundary

GitHub Pages currently serves the root of `main`. This work belongs on its
feature branch for review. Creating a draft PR does not publish it. No
production deployment, waitlist submission, merge or backend change is part
of this implementation.
