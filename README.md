# dumyap

A voice-first, context-aware Chromium (Manifest V3) browser extension for
capturing and organizing thoughts on any webpage. This is an **early build** —
selection capture and local voice recording work; transcription, AI
organization, and storage are not implemented yet.

## What's here

- **Popup UI** (React + TypeScript + Tailwind CSS v4) showing the product name,
  a short description, and a placeholder for saved notes.
- **Text selection detection** in the content script: highlighting non-empty
  text on a page shows a small floating microphone button near the selection.
  Clearing the selection or clicking elsewhere dismisses it.
- **Voice recording.** Clicking the microphone captures the selected text, page
  URL, title, and a timestamp, then opens a small recorder window where you can
  record a spoken thought, watch an elapsed timer, stop or cancel, and play the
  audio back.
- **Vite** build that outputs a loadable unpacked extension to `dist/`.

Recordings stay entirely local (in memory, as a `Blob`). No audio or page
context is uploaded anywhere. Transcription, AI organization, note storage,
authentication, and cloud services are not implemented yet.

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
│   │   └── service-worker.ts    # Opens the recorder window, relays context
│   ├── content/
│   │   ├── content.ts           # Selection events + mic button + capture
│   │   ├── floatingMicButton.ts # Shadow-DOM isolated mic button UI
│   │   └── selection.ts         # Selection geometry / text helpers
│   ├── recorder/
│   │   ├── App.tsx              # Recorder UI (status/timer/stop/cancel/play)
│   │   ├── audioRecorder.ts     # Framework-agnostic recording logic
│   │   ├── context.ts           # Loads capture context from session storage
│   │   ├── index.css
│   │   ├── index.html           # Recorder page entry
│   │   ├── main.tsx
│   │   └── useAudioRecorder.ts  # React hook: recorder lifecycle + timer
│   ├── popup/
│   │   ├── components/
│   │   │   └── NotesPlaceholder.tsx
│   │   ├── App.tsx
│   │   ├── index.css            # Tailwind entry (@import "tailwindcss")
│   │   ├── index.html           # Popup HTML entry
│   │   └── main.tsx             # React mount
│   └── shared/
│       └── messages.ts          # Shared message + context types
├── vite.config.ts
└── tsconfig.json
```

## Permissions

- **`storage`** — the only declared manifest permission. Used for
  `chrome.storage.session` to pass the capture context from the content script
  to the recorder window in memory (cleared when the browser closes).
- The content script matches `<all_urls>` so it can detect selections on pages.
  Passive detection reads only the selection's position and emptiness; the
  selected text is read only when you deliberately click the microphone.
- **Microphone access** is a runtime browser permission (prompted on first
  record), not a manifest permission. Audio never leaves the device.

More permissions will be added only as corresponding features land.
