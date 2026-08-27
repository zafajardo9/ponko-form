# Popup Embed Guide

> **Design a lead-capture popup on a free-position canvas, choose when it appears, and embed it on any website — WordPress included — with one `<script>` snippet.** Popups are the lead-capture layer on top of your existing forms: a button element links to any URL, so you wire a popup to a form you already have.
> Verified against `main` on 2026-08-18.

---

## How Popup Embed Works

A popup is a self-contained lead-capture surface. You lay out elements (heading, text, image, button, divider, raw HTML) anywhere on a design canvas, pick a trigger (on load, exit intent, scroll depth, or a click on a page element), and publish. Visitors on any site where the snippet is embedded see the popup at the right moment; views and clicks are counted per popup.

```
  Your website (WordPress, Wix, plain HTML)
        │
  <script data-popup="…">  →  popup-loader.js (host side)
        │                        · fetches config
        │                        · watches the trigger
        │                        · gates by frequency
        ▼
  iframe → /popups/:id/embed (renders your design)
        │
  Button click → opens the URL you set (e.g. your form's share link)
```

The loader never sets cookies and reports only aggregate counters (a view per session, each button click) via `sendBeacon`.

---

## Step 1: Create a Popup

1. Open **Popups** (route: `/popups`). The editor uses `/popups/:popupId/edit`.
2. Click **New popup**, give it a name — it starts from a starter layout ("Get 10% off…") you can fully replace.
3. The builder opens with three panes: **elements** (left), **canvas** (center), **settings** (right).

## Step 2: Design on the Canvas

- **Add** — drag an element chip from the left onto the canvas (it drops where you let go), or click a chip to add it centered.
- **Move** — drag any element; positions snap to an 8px grid.
- **Resize** — drag the corner handle on a selected element. Images can also be pinned to 100% of the canvas width, height, or both from their element settings.
- **Restyle** — with an element selected, the right pane shows its contextual controls (text, colors, sizes, alignment, opacity, rotation, corner radius).
- **Add background artwork** — in **Popup → Look & feel → Canvas background**, paste an HTTPS image URL, choose whether it fills the canvas or shows the whole image, set its focal edge, and add an optional color tint for readable copy.
- **Layer** — bring forward / send backward, duplicate (⌘D), delete (⌘D's neighbor: the Delete key).
- **Button links** — a button's *Link URL* accepts any URL. Paste an existing form's share link (`/forms/submit/…`) or embed URL, or any external page. An empty link renders as a dashed "add a link" placeholder until you set one.

## Step 3: Choose Behavior

In the right pane's **Popup** tab:

| Setting | Options |
|---|---|
| **Size** | Exact canvas width × height from 120–4,000 px per axis |
| **Placement** | Center, four corners, or fullscreen |
| **Trigger** | On load (+ delay), exit intent, scroll depth (%), click on a CSS selector |
| **Frequency** | Every visit, once per session, once per day, once per week |
| **Look & feel** | Font, card color or background image, image fit/focus/readability tint, overlay color/opacity, corner radius, entrance animation, ✕ button, overlay-click close |

On screens narrower than the popup, it automatically becomes a full-width bottom sheet with the canvas scaled to fit — the layout stays intact.

## Step 4: Preview and Publish

- **Preview** (top bar) opens `/popups/:publicId/preview` — a mock host page that runs the *real* loader, with a trigger simulator (fire on-load / exit-intent / scroll, reset frequency).
- **Publish** flips the popup live. Drafts are never served publicly (the config API 404s and the embed renders nothing).

## Step 5: Embed on Your Site

Click **Embed** and copy the snippet:

```html
<script async src="https://ponkoform.com/embed/popup-loader.js" data-popup="abc123…" data-popup-wordpress-admin-test="true"></script>
```

Paste it anywhere on your site:

- **WordPress** — Appearance → Customize → Custom HTML, a Custom HTML block, or an Elementor HTML widget.
- **Wix / Webflow / Squarespace** — use their embed/HTML element.
- **Plain HTML** — before `</body>`.

One snippet per popup. Multiple popups on one page each run independently (they may overlap — orchestration is on the roadmap).

### WordPress admin test safeguard

The generated snippet detects WordPress's standard `body.logged-in` class. For
logged-in administrators it runs the popup in test mode: frequency storage,
popup view/click analytics, form sessions and responses, payments, redirects,
notifications, and integrations are suppressed. A banner inside linked Ponko
forms confirms that test mode is active. Logged-out visitors continue through
the normal production path.

This requires the generated `data-popup-wordpress-admin-test="true"` attribute,
so existing WordPress installations should copy the latest snippet again. It
also assumes the active WordPress theme uses the standard `body_class()` output.

---

## Measuring Results

Each card on **Dashboard → Popups** shows **Views** (one per visitor session), **Clicks** (button clicks), and **CTR** (clicks ÷ views). Counters are totals; time-series analytics is a planned enhancement.

---

## Compatibility Notes

- **Ad blockers / privacy tools** may block third-party scripts or iframes; nothing beyond the snippet is required, and the loader sets no cookies.
- **Strict CSP sites** must allow the PonkoForm origin in `script-src` (and `frame-src` for the iframe).
- **Raw HTML element** supports safe formatting and sandboxed HTTPS iframes. Scripts, inline event handlers, and unsafe URL schemes are removed when content is saved and rendered.
- **Buttons that link out** navigate the host page by default; tick *Open in a new tab* to keep visitors on the page.
