# Thought Bestie

A voice-first, context-aware Chromium (Manifest V3) browser extension for
capturing and organizing thoughts on any webpage. This repository is the
**project foundation** — the long-term product (highlight-to-speak, voice
recording, transcription, and AI organization) is not implemented yet.

## What's here

- **Popup UI** (React + TypeScript + Tailwind CSS v4) showing the product name,
  a short description, and a placeholder for saved notes.
- **Content script** that is injected on pages but currently only logs that it
  loaded. No selection or recording behavior yet.
- **Vite** build that outputs a loadable unpacked extension to `dist/`.

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
6. Click the Thought Bestie icon in the toolbar to open the popup.

After rebuilding, click the reload icon on the extension card in
`chrome://extensions` to pick up changes.

## Project structure

```
.
├── public/
│   ├── manifest.json        # MV3 manifest (copied verbatim into dist/)
│   └── icons/               # Placeholder toolbar icons
├── scripts/
│   └── make-icons.mjs       # Regenerates placeholder PNG icons
├── src/
│   ├── content/
│   │   └── content.ts        # Minimal content script (injection only)
│   └── popup/
│       ├── components/
│       │   └── NotesPlaceholder.tsx
│       ├── App.tsx
│       ├── index.css         # Tailwind entry (@import "tailwindcss")
│       ├── index.html        # Popup HTML entry
│       └── main.tsx          # React mount
├── vite.config.ts
└── tsconfig.json
```

## Permissions

The manifest requests no API permissions. The content script matches
`<all_urls>` only so it can load on pages for future features; nothing is read
or stored yet. Permissions will be added as corresponding features land.
