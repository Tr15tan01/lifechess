# Life Chess

A 3D chess game where every move becomes a small life situation. Play against a built-in engine at five difficulty levels, with optional coaching tips. Sign in only if you want to save progress and see charts.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

No keys, no AI provider and no database are needed to play. `DATABASE_URL=memory://local` keeps accounts in memory; point it at MongoDB to keep them.

## What it does

- **3D chess** with lathe-turned pieces, animated moves, orbit camera, and a 2D fallback (also used when WebGL is missing).
- **Five levels**: Beginner, Casual, Club, Expert, Master. The engine (negamax, alpha-beta, quiescence) runs in a Web Worker so the board never freezes.
- **Coaching tips (toggle)**: rule-based, no AI. Warns about hanging pieces, checks and opening basics, and can highlight the best move.
- **Life hints (toggle)**: each turn is turned into a life situation (a pawn move might be "you advanced in life: you finally decided to apply for the new job"). Hand-written text pools picked by what happened on the board; **no AI**, deterministic per game. Each piece is a life area: pawn = life steps, knight = relationships, bishop = health, rook = money, queen = career, king = wellbeing.
- **Optional account**: email and password, Argon2id, HttpOnly session cookie. Finished games are saved to the account and drawn as charts on `/stats` (win rate trend, life score, results by level, life balance radar, games per week).
- **Everything else is localStorage**: settings, the game in progress, and your guest history. When you sign in, unsynced guest games are uploaded.

## Layout

```
src/lib/chess/      game rules glue, bot, life hints, coach, stats (pure, tested)
src/components/chess/  game screen, 2D and 3D boards
src/server/         optional accounts + saved games (MongoDB or in-memory)
src/app/            /, /stats, /login, /register, /api/auth/*, /api/games
```

Stats are reported by the browser when a game ends, so they are for personal tracking and are not tamper-proof.
