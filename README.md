# dumyap

A voice-first, context-aware Chromium (Manifest V3) browser extension for
capturing and organizing thoughts on any webpage. This is an **early build** —
text selection capture, screen-region capture, local voice recording, and
persistent local note storage work; transcription and AI organization are not
implemented yet.

## What's here

- **Popup UI** (React + TypeScript + Tailwind CSS v4) with a functional list of
  saved notes.
- **Text selection detection** in the content script: highlighting non-empty
  text on a page shows a small floating microphone button near the selection.
  Clearing the selection or clicking elsewhere dismisses it.
- **Voice recording.** Clicking the microphone captures the selected text, page
  URL, title, and a timestamp, then opens a small recorder window where you can
  record a spoken thought, watch an elapsed timer, stop or cancel, and play the
  audio back.
- **Screen-region capture (visual notes).** A **Capture area** button in the
  popup starts an **in-page selection overlay** directly on the webpage. You
  drag a rectangle over the page, dumyap captures just that region, and the
  existing recorder window opens to annotate it with voice. Capture only ever
  happens on an explicit click — nothing is captured automatically.
- **Persistent local storage.** After recording, a **Save note** button stores
  the audio, any screenshot, and the context in IndexedDB. Saved notes appear
  in the popup (newest first), tagged **Text** or **Visual**, with the page
  title, a text preview or screenshot thumbnail, date, and duration; each can be
  replayed, opened at its source page, or deleted.
- **Vite** build that outputs a loadable unpacked extension to `dist/`.

Everything stays local. Audio, screenshots, and page context live in the
browser's IndexedDB on your machine — nothing is uploaded. Screenshot capture
and cropping happen entirely in the browser. Transcription, AI organization,
authentication, cloud storage, and export are not implemented yet.

### How recording works (architecture)

`getUserMedia` is unreliable inside a content script under Manifest V3, so
recording runs in an extension-owned page instead:

1. The content script captures the bounded context and messages the background
   **service worker**.
2. The service worker stashes that context in `chrome.storage.session` under a
   one-time id and opens the **recorder page** in a small popup window — a
   visible, extension-origin, user-initiated context where the microphone
   permission prompt can appear and `MediaRecorder` can run.
3. The recorder page reads its context, requests the mic, records, and offers
   playback. Microphone tracks are stopped on stop, cancel, or close.

Screen capture happens **in the page**, not in a separate window:

1. On your **Capture area** click, the popup messages the active tab's content
   script to start selection, then closes so the webpage is fully visible.
2. The content script shows a lightweight, Shadow-DOM-isolated overlay that
   dims the page and blocks page interaction. You drag a rectangle; **Escape**
   or **Cancel** aborts.
3. On release, the content script **hides its own overlay first** (so dumyap's
   UI isn't in the shot), waits for the browser to repaint, then asks the
   service worker to `chrome.tabs.captureVisibleTab` — which `activeTab`
   permits because you invoked the extension via the popup.
4. The content script crops the selected region from the returned screenshot on
   a canvas. Crop coordinates are scaled by `screenshot.naturalWidth /
   window.innerWidth`, so the result stays aligned under any device pixel ratio
   or page/browser zoom. The overlay is captured in viewport (`position:
   fixed`) coordinates, matching the visible-tab screenshot.
5. It sends the cropped PNG to the service worker, which opens the **recorder
   window** — a visible, extension-origin context where the microphone prompt
   can appear and `MediaRecorder` can run (this is required by MV3; recording
   can't happen in the content script). You record, preview, and save; the note
   stores the cropped screenshot, audio, URL, title, timestamp, and duration.

## Tech stack

React 18 · TypeScript · Vite 6 · Tailwind CSS v4 (`@tailwindcss/vite`)

## Prerequisites

- Node.js 18+ (developed on Node 24)
- npm

## Setup

```bash
npm install
```

## Development commands

| Command | Description |
| --- | --- |
| `npm run build` | Type-check and produce a production build in `dist/`. |
| `npm run dev` | Rebuild `dist/` on file changes (watch mode). |
| `npm run typecheck` | Run the TypeScript compiler with no emit. |

> There is no hot-reload dev server — browser extensions load from built files.
> Use `npm run dev` to rebuild on save, then reload the extension in Chrome.

## Load the unpacked extension in Chrome

1. Run `npm run build` (or `npm run dev` for watch mode).
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the generated **`dist/`** folder.
6. Click the dumyap icon in the toolbar to open the popup.

After rebuilding, click the reload icon on the extension card in
`chrome://extensions` to pick up changes.

## Manual testing: floating microphone button

After loading the unpacked extension:

1. Open any normal webpage (for example an article or a Wikipedia page).
   `chrome://` pages and the Chrome Web Store are off-limits to extensions, so
   test on a regular site.
2. **Highlight some text** by dragging across it with the mouse, or by holding
   Shift and using the arrow keys.
3. A round indigo **microphone button** should appear just above the end of the
   selection. Clicking it opens the recorder window (see the recording tests
   below).
4. **Clear the selection** — click on empty space, or press an arrow key to
   collapse it. The button should disappear.
5. **Click elsewhere** on the page while a selection is active: the button
   hides immediately.
6. **Scroll or resize** the window while text is selected: the button tracks
   the selection and stays on screen (clamped to the viewport edges).

Things that should NOT show the button:

- Selecting text inside an input, textarea, or editable field (typing areas are
  left alone).
- Selecting only whitespace.

To confirm the content script loaded, open DevTools on the page and look for
`[dumyap] content script loaded.` in the console.

### Style isolation

The button renders inside a Shadow DOM, so page CSS cannot restyle it and its
styles cannot leak onto the page. Pressing the button uses `mousedown`
prevention so it does not collapse your active text selection.

## Manual testing: voice recording

The first time you record, Chrome asks for microphone permission for the
extension. Granting it once applies to later recordings.

1. On a normal webpage, **highlight text** and click the microphone button.
2. A **recorder window** opens showing the selected text, and Chrome prompts
   for **microphone access**. Click **Allow**.
3. Recording starts automatically: a red "Recording" indicator and an **elapsed
   timer** count up.
4. Click **Stop**. The status switches to "Recording ready" and an **audio
   player** appears — press play to hear the recording back.
5. Click **Done** to close the window.

Error and edge cases to try:

- **Permission denied:** click the mic, then **Block** (or Deny) the prompt.
  The window shows a clear "microphone access was blocked" message with **Try
  again** / **Close** buttons rather than failing silently. (If you blocked it
  earlier, reset it via the site/extension permission controls to re-test the
  prompt.)
- **No microphone:** unplug/disable all audio input devices, then record. You
  should see a "no microphone was found" message.
- **Cancel:** start recording, then click **Cancel**. The window closes and the
  audio is discarded (nothing to play back).
- **Repeated clicks:** click the mic several times quickly. Each click opens its
  own recorder window; within a window, recording only starts once.

### Resource cleanup check

After stopping, cancelling, or closing the recorder, the microphone is
released. Verify the OS/browser **recording indicator turns off** (the dot in
the Chrome tab strip / the system mic indicator). The content script never
touches the microphone — only the recorder page does.

## Manual testing: screen capture + visual notes

1. On a normal webpage, open the dumyap popup and click **Capture area**. The
   popup closes and a **dimmed selection overlay** appears directly over the
   page, with a "Drag to capture a region" hint.
2. **Drag** a rectangle over the region you want. On release, the overlay
   disappears and the **recorder window** opens showing a **thumbnail** of the
   captured region at the top.
3. Chrome prompts for the microphone (first time) and recording starts.
   **Stop**, play back, then **Save note**. The cropped image is saved with the
   recording.
4. Open the popup — the new note is tagged **Visual** and shows a **screenshot
   thumbnail**. Click the thumbnail to open the full image in a new tab; replay
   the audio; **Open ↗** reopens the source page; **Delete** (with confirm)
   removes it.

Crop alignment and edge cases to try:

- **Crop matches the selection:** the saved thumbnail should contain exactly
  what you dragged over — and **none of dumyap's overlay** (the overlay is
  hidden before pixels are captured).
- **DPR / zoom:** on a HiDPI display or with the page zoomed in/out, the crop
  should still match your selection (coordinates are scaled by the screenshot's
  natural width over the CSS viewport width).
- **Escape / Cancel:** press **Escape** or click **Cancel (Esc)** mid-selection
  — the overlay vanishes and you're back to normal browsing with nothing saved.
- **Page interaction is blocked:** while the overlay is up, clicks/links on the
  page underneath should not fire.
- **Tiny drags** (a click or a few pixels) are ignored and cancel the overlay,
  so you don't get an empty crop.
- **Unsupported pages:** try **Capture area** on a `chrome://` page or the
  Chrome Web Store — the popup shows a clear "this page can't be captured"
  message instead of failing. On a normal page that loaded before the extension
  was installed/reloaded, you may see "reload the page and try again" (the
  content script isn't injected yet).
- **Recorder cancel:** during annotation, **Cancel** / **Discard & close**
  closes the window without saving — no visual note is added.
- **Scrolling:** capture reflects the **currently visible** viewport. Scroll to
  what you want visible before clicking Capture area.

## Manual testing: saving and managing notes

Saved notes are stored in IndexedDB (database `dumyap`, object store `notes`),
local to your Chrome profile.

1. **Save a note.** Record and click **Stop**, then click **Save note**. A
   green "Note saved" confirmation replaces the button. The **Save note** button
   is disabled while saving and does not reappear afterward, so a single
   recording can't be saved twice. Click **Done** to close.
2. **See it in the popup.** Click the dumyap toolbar icon. The note appears with
   the page title, a two-line preview of the selected text, the date, and the
   duration. Recording more notes puts the newest at the top.
3. **Replay.** Press play on a note's audio player in the popup.
4. **Open the source.** Click **Open ↗** to reopen the original page in a new
   tab.
5. **Delete.** Click **Delete**, then confirm with **Delete** (or back out with
   **Keep**). The note disappears from the list.
6. **Cancelled recordings are never saved.** Record, click **Cancel** — no note
   is added to the popup.

### Persistence checks

- Close the recorder and reopen the popup — the saved note is still there.
- Close and reopen the popup several times — notes persist.
- **Restart Chrome**, then open the popup — notes survive a full restart
  (IndexedDB is on-disk, unlike the in-memory session storage used only to hand
  context to the recorder).

### Empty / loading / error states

- With no notes saved, the popup shows an **empty state** ("No notes yet").
- On open, a brief **"Loading notes…"** state shows while IndexedDB opens.
- If the database can't be read, an **error state** with a **Retry** button
  appears instead of a blank list.

### Storage inspection (optional)

In the popup's DevTools (right-click the popup → Inspect), open **Application →
IndexedDB → dumyap → notes** to see stored records. Each holds the audio blob
plus `selectedText`, `url`, `title`, `createdAt`, `durationMs`, and `mimeType`.
Visual notes additionally carry a `screenshot` blob and `screenshotMimeType`.

## Project structure

```
.
├── public/
│   ├── manifest.json            # MV3 manifest (copied verbatim into dist/)
│   └── icons/                   # Placeholder toolbar icons
├── scripts/
│   └── make-icons.mjs           # Regenerates placeholder PNG icons
├── src/
│   ├── background/
│   │   └── service-worker.ts    # captureVisibleTab + opens the recorder window
│   ├── content/
│   │   ├── content.ts           # Selection events, mic button, area-capture
│   │   ├── captureCrop.ts       # DPR/zoom-aware viewport crop → PNG data URL
│   │   ├── floatingMicButton.ts # Shadow-DOM isolated mic button UI
│   │   ├── selection.ts         # Selection geometry / text helpers
│   │   └── selectionOverlay.ts  # In-page drag-to-select overlay (Shadow DOM)
│   ├── recorder/
│   │   ├── App.tsx              # Voice recorder page
│   │   ├── RecorderPanel.tsx    # Shared record/preview/save UI (+screenshot)
│   │   ├── audioRecorder.ts     # Framework-agnostic recording logic
│   │   ├── context.ts           # Loads capture context from session storage
│   │   ├── index.css
│   │   ├── index.html           # Recorder page entry
│   │   ├── main.tsx
│   │   └── useAudioRecorder.ts  # React hook: recorder lifecycle + timer
│   ├── popup/
│   │   ├── components/
│   │   │   ├── NoteItem.tsx      # One saved note: thumbnail/playback/delete
│   │   │   └── NotesList.tsx     # Notes list + loading/empty/error states
│   │   ├── App.tsx              # Popup: Capture area button + notes list
│   │   ├── capture.ts           # Tells the active tab to start selection
│   │   ├── index.css            # Tailwind entry (@import "tailwindcss")
│   │   ├── index.html           # Popup HTML entry
│   │   ├── main.tsx             # React mount
│   │   └── useNotes.ts          # React hook: load + delete saved notes
│   └── shared/
│       ├── db.ts                # IndexedDB data layer (CRUD + errors)
│       ├── format.ts            # Duration / date formatting helpers
│       ├── messages.ts          # Shared message + context types
│       └── note.ts              # VoiceNote record type (+ optional screenshot)
├── vite.config.ts
└── tsconfig.json
```

## Permissions

- **`storage`** — used for `chrome.storage.session` to hand the capture context
  (including the cropped screenshot, as a data URL) to the recorder window in
  memory (cleared when the browser closes).
- **`activeTab`** — grants one-time access to the current tab when you invoke
  the extension via the popup, which is what `chrome.tabs.captureVisibleTab`
  requires. No broad host permission is requested; capture only runs on your
  explicit **Capture area** click and only for the active tab.
- **IndexedDB** (saved notes, including screenshots) needs no manifest
  permission — it's standard web storage, local to the browser profile and
  on-disk so notes survive restarts.
- The content script matches `<all_urls>` so it can detect selections on pages.
  Passive detection reads only the selection's position and emptiness; the
  selected text is read only when you deliberately click the microphone. The
  full page is never stored.
- **Microphone access** is a runtime browser permission (prompted on first
  record), not a manifest permission. Audio never leaves the device.

More permissions will be added only as corresponding features land.
