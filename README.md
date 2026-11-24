# Pantheon Clash — Mythology Trump Card Game

![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-DD2C00?style=flat-square&logo=firebase&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-Tested-6E9F18?style=flat-square&logo=vitest&logoColor=white)

A deterministic **Mythology Trump Card** web game built with Vite, React, TypeScript, Tailwind CSS, and Firebase (Authentication + Cloud Firestore), configured for static hosting on GitHub Pages.

Zero runtime AI or LLM calls are used anywhere in the application—deck shuffling, Round 1 leader selection, rotating realms, prophecy hints, and bot tactics are 100% deterministic via a seeded **Mulberry32** PRNG.

## Game Modes & Mechanics

- **Play vs Bot (2P)**: Instant offline 2-player clash (30 cards each) against a deterministic bot.
- **Online Rooms (2–4P)**: Create or join rooms via 6-character code, with optional **2v2 Teams** at 4 seats, bot auto-fill, ready states, 20-second turn timer, and Firestore `activePlayers` cleanup + 2-hour stale lobby sweep.
- **60-Deity Roster & Gold Idol Cards**: Seven pantheons (`Greek`, `Norse`, `Hindu`, `Egyptian`, `Japanese`, `Celtic`, `Mesoamerican`) with transparent PNG deity artwork in `public/deity/`.
- **Four Stats**: `Might`, `Arcana`, `Cunning`, and `Influence`.
- **Rotating Realms**: Every 3 rounds, the active realm cycles across `SKY`, `NETHER`, `SEA`, and `WAR` (`+15` to matching-domain cards).
- **Passives & Gambit**: `Piercing`, `Prophecy`, `Resurrection` (once per match), once-per-match `Gambit` (lowest effective stat wins), `War Pot` ties, and a `60`-round cap.

## Local Development

```bash
npm install --legacy-peer-deps
npm run dev
```

For local online room support, configure a local `.env.local` file from `.env.example` (`.env*` files are gitignored).

### Verification & Testing

```bash
npm run lint
npm test
npm run build
npx eslint firestore.rules
```

## GitHub Pages Deployment

`.github/workflows/deploy.yml` builds, tests, and deploys `dist/` to GitHub Pages with `vite.config.ts` (`base: './'`). Play vs Bot (2P) and the 60-card Codex work completely offline in the static build.
