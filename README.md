# CardMaker 2026

A rebuilt version of [CardMaker](https://github.com/MatthewLandis/CardMaker): a Yu-Gi-Oh! card maker with no ads and high-quality card templates. Edit everything from a side panel and watch the card update live, then download it as a full-size PNG or save it to your account.

## Features

- Every frame: Normal, Effect, Ritual, Fusion, Synchro, Dark Synchro, Xyz, Link, Token, the three Gods, Spell, Trap, Legendary Dragon and Skill
- Levels, Ranks and Negative Levels, Link arrows (the Link rating counts itself), Pendulum cards with separate left and right scales
- Spell and Trap types (Quick-Play, Counter and so on) are saved with the card
- Name, type line, ATK/DEF and card text automatically shrink to fit, like real cards
- Upload card art or drag an image onto the card (big images are resized automatically)
- Accounts: save cards, reopen them later, save copies, delete them
- Unsaved new cards are kept in your browser, so a refresh doesn't lose your work

## Tech

- **Frontend:** Angular 22 (standalone components, signals, zoneless), `html-to-image` for exports
- **Backend:** Express 5 on Node 24, which runs the TypeScript directly with no build step
- **Database:** SQLite through Node's built-in `node:sqlite`. It's a single file, so there's no database server to install.

## Running it locally

You only need [Node.js](https://nodejs.org) 22.18 or newer (Node 24 recommended).

**Terminal 1: backend** (http://localhost:4000)

```bash
cd backend
npm install
npm run dev
```

**Terminal 2: frontend** (http://localhost:4200)

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200. The Angular dev server forwards `/api` requests to the backend.

Settings are optional during development. To keep your login across backend restarts, copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`.

## Deploying

The backend also serves the built site, so you only deploy one service. From the project root:

```bash
npm run build
NODE_ENV=production JWT_SECRET=<long random string> npm start
```

On a host like Railway, set the build command to `npm run build`, the start command to `npm start`, and the environment variables `NODE_ENV=production` and `JWT_SECRET`. SQLite stores everything in one file, so attach a persistent volume and point `DB_PATH` at it (for example `DB_PATH=/data/cardmaker.db`). Otherwise saved cards disappear on every redeploy.

## Project layout

```
backend/src/
  server.ts        Express app, serves /api and the built site
  auth.ts          register, login, password hashing, login check
  cards.ts         card create / read / update / delete (owner only)
  db.ts            SQLite tables
frontend/src/app/
  card/            card model, live preview + image export, API service
  editor/          the main page: preview + controls
  catalog/         "My cards"
  auth/            login page, token handling
frontend/public/   card templates, icons and fonts
```
