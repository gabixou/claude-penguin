<div align="center">

<img src="logo.svg" alt="Claude Penguin logo" width="320" />

# Claude Penguin

### A fan-made recreation of **Club Penguin** that runs entirely in your browser: no Flash, no plugins, no installs.

![Platform](https://img.shields.io/badge/platform-web-1e90ff?style=flat-square)
![Engine](https://img.shields.io/badge/engine-Phaser%203-9b59b6?style=flat-square)
![Language](https://img.shields.io/badge/language-JavaScript-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Multiplayer](https://img.shields.io/badge/multiplayer-WebSocket-2ecc71?style=flat-square)
![Status](https://img.shields.io/badge/status-in%20development-orange?style=flat-square)
![License](https://img.shields.io/badge/license-fan%20project-lightgrey?style=flat-square)

</div>

---

## About

**Claude Penguin** is a Brazilian fan project by **[Arenovisk](https://github.com/gabixou)** that reimagines the classic Club Penguin experience as a modern web game. Walk through snowy villages, cozy coffee shops and lively dance floors rendered with real animated `.swl` scenes — all running at 60 FPS in any modern browser.

It is a love letter to the penguin that stole our childhoods: authentic HUD, real game assets, chat, rooms, outfits, minigames and a multiplayer world — rebuilt from scratch for the web.

## Features

- 🐧 **Authentic SWL renderer** — a pure-JavaScript port of the original `swl.c` scene engine. All 9 `.swl` rooms parse and animate correctly (town, coffee shop, pizza parlor, lodge, lounge, shop, village, attic, book room).
- 🖥️ **Classic web HUD** — two-layer HUD faithful to the original: chat bar on top, action bar below, with real cropped icons, working chat input and in-game map/mail buttons.
- 🎨 **True penguin rendering** — sprite-atlas body with dynamic color tinting, nametags positioned exactly like the original, selection rings and smooth room transitions.
- 🌐 **Multiplayer** — real-time rooms over WebSocket: player movement sync, chat and multiple simultaneous rooms.
- 🎮 **Minigames** — playable minigame support bundled in the client.
- ⚡ **Modern stack** — instant hot-reload dev mode and a production build served by Vite.

## How it differs from CPPs (Club Penguin Private Servers)

Most Club Penguin private servers are **emulators of the original Flash client**: they re-host the dead `.swf` files and reimplement the network protocol (Houdini, Timeline, Kitsune, etc.). They require Flash emulators like Ruffle, server stacks like Wand/Docker, and heavy backends like PostgreSQL.

**Claude Penguin takes a completely different approach:**

| | CPPs (Flash emulators) | Claude Penguin |
|---|---|---|
| **Client** | Original `.swf` files via Flash emulator (Ruffle) | Native JavaScript/Phaser 3 — zero Flash dependency |
| **Rendering** | Adobe Flash Player (dead tech) | WebGL via Phaser 3 at 60 FPS |
| **Server** | Python/Perl/Ruby protocol emulators + databases | Lightweight Node.js WebSocket server (`ws`) |
| **Setup** | Docker, PostgreSQL, Nginx, websockify bridges | `npm install` → `npm start` |
| **Scenes** | SWF timelines | Custom JS port of the `.swl` scene format |

In short: instead of resurrecting Flash, this project **rebuilds the game natively for the web** — same soul, modern bones.

## Tech stack

**Client** (`client/`)
- [Phaser 3](https://phaser.io/) — 2D game engine (WebGL/Canvas)
- [Vite](https://vitejs.dev/) — dev server & bundler
- Pure JavaScript, ES modules

**Server** (`server/`)
- [Node.js](https://nodejs.org/) + [`ws`](https://github.com/websockets/ws) — WebSocket multiplayer server
- SQLite via `better-sqlite3` — player persistence

**Tooling**
- Playwright MCP — automated browser QA
- Gemini Vision API (`tools/gemini-vision.mjs`) — visual regression analysis
- Ollama (local) — AI-assisted code generation during development

## Getting started

```bash
# 1. Server (WebSocket on port 8080)
cd server
npm install
npm start

# 2. Client (Vite dev server on port 3000) — in another terminal
cd client
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

For a production build:

```bash
cd client && npm run build && npx vite preview --port 3000
```

On Windows, `INICIAR_JOGO.bat` and `INICIAR_JOGO_RAPIDO.bat` automate the whole flow.

## Built with AI

This project was created almost entirely with **AI coding agents** running for free:

- 🤖 **[Devin](https://devin.ai)** — developed on the free promotional plan powered by **SWE-2 Flash Medium**
- 🦙 **[Ollama](https://ollama.com/)** with **Qwen 3.5** — running locally on the developer's machine for heavy lifting
- 👁️ **Gemini Vision** — validates every visual change by comparing screenshots against the reference implementation

A real-world experiment in what a solo developer + free AI tools can build.

## Disclaimer

Claude Penguin is a **non-commercial fan project**. It is **not affiliated with, endorsed by, or related to Disney, Club Penguin, or Miniclip** in any way. All Club Penguin assets, names and trademarks belong to their respective owners. This project exists for preservation and educational purposes.

## Credits

- 🐧 **[solero/wand](https://github.com/solero/wand)** — the Docker-based CPP stack that inspired the multiplayer architecture research
- 🕹️ **[Tweebbo/gopenguin-3ds](https://github.com/Tweebbo/gopenguin-3ds)** — GoPenguin for Nintendo 3DS, proof that the Club Penguin spirit lives on across platforms
- 🎮 **[gopenguin.lol](https://gopenguin.lol)** — the reference implementation used for visual parity QA
- 🙏 The entire Club Penguin private server community, for keeping the penguins sliding since 2017

---

<div align="center">
  <sub>Feito com 🐧 e muito café — um projeto brasileiro de <a href="https://github.com/gabixou">Arenovisk</a></sub>
</div>
