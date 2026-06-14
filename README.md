# 🎮 MathClash — Real-Time Multiplayer Math Game

A bright, cartoon-style head-to-head math game where **two players on separate
devices** compete in real time. Inspired by MathTug, MathClash offers two game
modes, three difficulty levels, and live Socket.IO multiplayer — no account
required to play.

> Fox 🦊 vs Bear 🐻 — pull the rope, race the clock, and crown a math champion!

---

## ✨ Features

- **Tug-of-War mode** — both players race on the same question; correct (and
  fast!) answers pull an animated rope toward your side. First to **10 correct**
  (or a full rope pull) wins.
- **Turn-Based mode** — players alternate turns with a 30-second countdown.
  First to **10 points** wins.
- **Three difficulties** — Elementary (arithmetic), Middle School (fractions),
  High School (algebra). Questions are generated **server-side** and never
  repeat within a session.
- **Play vs Computer** — no friend needed! Face a server-driven AI bot in
  **Solo** (1 human vs bot) or **Co-op** (2 humans share one side of the rope vs
  the bot). Three bot skill levels: **Easy / Medium / Hard**.
- **Guest play** — pick a display name and go. Optional account system is
  scaffolded (see below).
- **Real-time** — Socket.IO keeps both clients in perfect sync (shared
  questions, live rope, turn handoff).
- **Cartoon UI** — Fredoka/Nunito fonts, bouncing mascots, confetti on win,
  green-glow/red-shake answer feedback, fully responsive + keyboard-accessible.
- **Anti-cheat** — answers are validated **only** on the server. The client
  never receives the correct answer mid-game.
- **Graceful disconnects** — if a player leaves, the opponent is notified and
  the match ends cleanly. Idle rooms expire after 30 minutes.

---

## 🗂 Project Structure

```
mathclash/
├── package.json                # root scripts (runs backend + frontend together)
├── README.md
├── .gitignore
│
├── backend/                    # Node.js + Express + Socket.IO server
│   ├── package.json
│   ├── server.js               # Express app + Socket.IO event wiring
│   └── src/
│       ├── questionGenerator.js# server-side math questions + answer validation
│       ├── roomManager.js      # in-memory rooms (teams/sides), codes, TTL janitor
│       ├── botStrategy.js      # computer-opponent timing + accuracy by level
│       └── gameLogic.js        # win rules, scoring, rope physics (server-only)
│
└── frontend/                   # React (Vite) + Tailwind + Framer Motion
    ├── package.json
    ├── vite.config.js          # dev proxy to the backend (API + websocket)
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx            # app bootstrap (Router + GameProvider)
        ├── App.jsx             # route table
        ├── index.css           # Tailwind layers + cartoon component styles
        ├── socket.js           # shared Socket.IO client
        ├── context/
        │   └── GameContext.jsx # all multiplayer state + socket handlers
        ├── components/
        │   ├── Mascot.jsx      # inline SVG fox & bear (no image assets needed)
        │   ├── TugRope.jsx     # animated tug-of-war rope + mascots
        │   ├── Scoreboard.jsx  # turn-based side-by-side scores
        │   ├── QuestionCard.jsx# question display + answer input + feedback FX
        │   └── Confetti.jsx    # winner confetti burst
        └── pages/
            ├── Landing.jsx     # hero + guest name entry
            ├── Lobby.jsx       # difficulty/mode pick + create/join room
            ├── WaitingRoom.jsx # share code + "waiting for opponent"
            ├── Game.jsx        # live gameplay (both modes)
            └── GameOver.jsx    # leaderboard, stats, confetti, play again
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js **18+** and npm

### Install & run

From the project root:

```bash
npm install        # installs root, backend, and frontend deps (via postinstall)
npm run dev        # starts BOTH the backend (:4000) and frontend (:5173)
```

Then open **http://localhost:5173**.

> To play head-to-head locally, open the site in **two browser windows/tabs**
> (or two devices on the same network). Create a room in one, copy the 6-letter
> code, and join from the other.

If `postinstall` doesn't run in your environment, install everything explicitly:

```bash
npm run install:all
```

### Run pieces individually

```bash
npm run dev:backend   # nodemon backend on http://localhost:4000
npm run dev:frontend  # Vite dev server on http://localhost:5173
```

---

## 🌐 How the Multiplayer Works (Socket.IO Protocol)

**Client → Server**

| Event           | Payload                                                  | Purpose                                  |
| --------------- | -------------------------------------------------------- | ---------------------------------------- |
| `create-room`   | `{ username, difficulty, mode, opponent, teamSize, botLevel }` | Host creates a room → returns room code  |
| `join-room`     | `{ username, roomCode }`                                 | Second player joins by code              |
| `submit-answer` | `{ answer, responseMs }`                  | Submit an answer (validated server-side) |
| `turn-timeout`  | `{}`                                      | Turn-based: active player ran out of time|
| `play-again`    | `{}`                                      | Replay with the same opponent            |
| `leave-room`    | `{}`                                      | Voluntarily leave                        |

**Server → Client**

| Event                 | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `room-update`         | Room snapshot (players, status, difficulty, mode)        |
| `game-start`          | Match begins; includes the first question                |
| `answer-result`       | Correct/incorrect + new rope position or turn state      |
| `next-question`       | The next shared question                                 |
| `game-over`           | Winner + per-player stats                                |
| `player-disconnected` | A player left; remaining player is notified              |

### Key logic, in one line each
- **Room management** (`roomManager.js`): 6-char unique codes from an
  unambiguous alphabet; a janitor sweeps rooms idle > 30 min.
- **Answer validation** (`questionGenerator.js`): answers are parsed numerically
  (fractions, mixed numbers, decimals all accepted) and compared on the server.
- **Rope position** (`gameLogic.js`): each correct answer pulls the rope
  `BASE_PULL` + a speed bonus (faster = bigger pull), clamped to 0–100.
- **Teams / sides** (`gameLogic.js`): wins aggregate per *side* (0 = left/fox,
  1 = right/bear), so two co-op humans pool their correct answers vs the bot.
- **Computer opponent** (`botStrategy.js` + `server.js`): the bot is driven by
  server-side timers with a human-like think delay and per-level accuracy
  (Easy 60% / Medium 80% / Hard 95%). It validates through the exact same
  answer path as a human — no special-casing.

### Ways to play
- **vs Friend** — create a room, share the 6-char code, play head-to-head.
- **vs Computer · Solo** — one human vs the bot; starts instantly (no code).
- **vs Computer · Co-op** — two humans share one side of the rope vs the bot;
  create a room, a friend joins, then you both face the computer together.

---

## 🔐 Optional Account System (scaffold)

Guest play requires **no database**. The optional registered-account experience
(persistent win/loss, accuracy per difficulty, game history dashboard) is
described in the UI and can be layered on with a lightweight DB:

1. Add `better-sqlite3` (or MongoDB) to `backend/package.json`.
2. Create `backend/src/db.js` with `users` and `matches` tables.
3. Add Express routes: `POST /api/register`, `POST /api/login` (hash passwords
   with `bcrypt`, issue a JWT), and `GET /api/me/history`.
4. On `game-over`, persist the match for any authenticated player.

The end-of-game leaderboard is already shown to **both** guests and registered
users — only registered users would have their history saved.

---

## 📦 Production Build & Deploy

```bash
npm run build      # builds the React app into frontend/dist
npm start          # backend serves the API, websockets, AND the built frontend
```

In production the Express server (`backend/server.js`) serves the static
`frontend/dist` bundle, so a single Node process hosts everything on `PORT`
(default `4000`).

### Deploy to Render (one-click blueprint)

This repo includes a [`render.yaml`](./render.yaml) blueprint, so deploying is:

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com): **New + → Blueprint**,
   then select this repo. Render auto-detects `render.yaml`.
3. Click **Apply**. Render runs `npm install && npm run build`, then `npm start`,
   and gives you a public `https://<your-app>.onrender.com` URL.

Render injects `$PORT` automatically and supports WebSockets on all plans
(including free). Note: free instances sleep after ~15 min idle and cold-start
on the next request — fine for demos; upgrade for always-on.

> Heads-up: the frontend build tool (Vite) is a `devDependency`. The blueprint
> deliberately leaves `NODE_ENV` unset during build so dev deps install and the
> client can bundle. If you deploy manually, make sure your build step installs
> dev dependencies (don't set `NODE_ENV=production` for the build).

**Environment variables**

| Variable          | Where     | Default     | Purpose                                   |
| ----------------- | --------- | ----------- | ----------------------------------------- |
| `PORT`            | backend   | `4000`      | HTTP/WebSocket port                       |
| `CLIENT_ORIGIN`   | backend   | `*`         | CORS allow-list for the frontend origin   |
| `VITE_SERVER_URL` | frontend  | same-origin | Point the client at a remote API if split |

Deployable to any Node host (Render, Railway, Fly.io, a VPS, etc.). For split
hosting (static frontend + separate API), set `VITE_SERVER_URL` at build time
and `CLIENT_ORIGIN` on the server.

---

## ♿ Accessibility & Responsiveness

- Large tap targets (≥ 52px) and high-contrast cartoon colors.
- Keyboard-first: answer input auto-focuses; Enter submits.
- Works across desktop, tablet, and mobile via Tailwind responsive layouts.

---

## 🧩 Tech Stack

| Layer       | Tech                                              |
| ----------- | ------------------------------------------------- |
| Frontend    | React 18, React Router, Vite, Tailwind CSS, Framer Motion |
| Backend     | Node.js, Express, Socket.IO                       |
| Real-time   | WebSockets via Socket.IO                          |
| State       | In-memory rooms (no DB needed for guest play)     |

Happy clashing! 🦊🆚🐻
