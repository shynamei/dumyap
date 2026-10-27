# dumyap

A voice-first, context-aware Chromium (Manifest V3) browser extension for
capturing and organizing thoughts on any webpage. This is an **early build** —
the long-term product (voice recording, transcription, and AI organization) is
not implemented yet.

## What's here

- **Popup UI** (React + TypeScript + Tailwind CSS v4) showing the product name,
  a short description, and a placeholder for saved notes.
- **Text selection detection** in the content script: highlighting non-empty
  text on a page shows a small floating microphone button near the selection.
  Clearing the selection or clicking elsewhere dismisses it.
- **Vite** build that outputs a loadable unpacked extension to `dist/`.

The microphone button is UI-only for now. Clicking it does nothing beyond a
console log. No audio recording, transcription, AI calls, note storage, or
backend services exist yet, and the selected text is never read, stored, or
transmitted.

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
   selection. Clicking it logs a message to the page's DevTools console
   (`[dumyap] mic button clicked`) and does nothing else yet.
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

## Project structure

```
.
├── public/
│   ├── manifest.json            # MV3 manifest (copied verbatim into dist/)
│   └── icons/                   # Placeholder toolbar icons
├── scripts/
│   └── make-icons.mjs           # Regenerates placeholder PNG icons
├── src/
│   ├── content/
│   │   ├── content.ts           # Orchestrates selection events + button
│   │   ├── floatingMicButton.ts # Shadow-DOM isolated mic button UI
│   │   └── selection.ts         # Selection geometry / emptiness helpers
│   └── popup/
│       ├── components/
│       │   └── NotesPlaceholder.tsx
│       ├── App.tsx
│       ├── index.css            # Tailwind entry (@import "tailwindcss")
│       ├── index.html           # Popup HTML entry
│       └── main.tsx             # React mount
├── vite.config.ts
└── tsconfig.json
```

## Permissions

The manifest requests no API permissions. The content script matches
`<all_urls>` only so it can detect selections on pages; it reads only the
selection's position and whether it is empty — never the selected text or page
content. Permissions will be added as corresponding features land.
