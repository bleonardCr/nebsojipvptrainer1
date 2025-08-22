# Nebsoji PvP Trainer

**A side-by-side assistant for Pokémon GO PvP battles.**  
Keep this app open on a laptop or tablet while you battle on your phone. It gives fast, readable picks, danger moves, and timing so you can play smarter without pausing.

---

## Features

- **Live Results cards**
  - Best pick from your team vs the selected opponent.
  - **Top 2 enemy charged danger moves** with timing:
    - fasts to first throw
    - turns to first throw
    - seconds to first throw
  - Your own danger moves with timing.
- **Quick Matrix**
  - Compact meta-style table to spot safe leads and swaps.
- **Smart search**
  - Type at least 2 letters.
  - Matches only at the **start of words**.
  - Results capped to 30 to avoid long scrolling.

---

## Setup

1. Install Node.js and npm, then verify:
   ```bash
   node -v
   npm -v
   ```
2. Open the project folder in Visual Studio 2022 or any editor.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open http://localhost:3000 in your browser.

---

## Side-by-side usage

- Keep the web app visible on a laptop or tablet.
- Battle on your phone.
- For each opponent you see in queue:
  1. Select the League.
  2. Enter your team picks and the opponent.
  3. Set shields for both sides.
  4. Read the **Live Results** card:
     - Your best pick to lead or safe swap.
     - The opponent’s top danger moves and **when** they come online.
     - Your recommended charged move.

Tip: Mark a pick as **Dead** to keep it visible but excluded from the calculation.

---

## Input tips

- Search opens only after 2 characters.
- Matching happens at the **start** of any word in the Pokémon name.
- The list shows at most 30 options to stay fast.

---

## Data and leagues

- The app builds Great, Ultra, and Master lists from `src/Data/gamemaster.json`.
- Builder outputs live in `src/Data/leagueFiles`.

**Rebuild league files from the Game Master:**

- Cross platform:
  ```bash
  npx cross-env CLEAN=1 node scripts/buildLeaguesFromGM.js
  ```
- Windows PowerShell:
  ```powershell
  $env:CLEAN='1'; node scripts/buildLeaguesFromGM.js; Remove-Item Env:CLEAN
  ```
- Windows cmd.exe:
  ```bat
  set CLEAN=1 && node scripts\buildLeaguesFromGM.js
  ```

If the UI still shows stale options, restart `npm start` so it reloads the JSON files.

---

## Quick reference

- 1 turn = **0.5 s** in GO PvP.
- Fast move energy gain and turn length come from the Game Master.
- Timing shown is the **first** possible throw of each charged move.

---

## Troubleshooting

- **A species is missing**
  - Confirm it exists in `src/Data/gamemaster.json`.
  - Rebuild league files as shown above.
- **Danger timings look off**
  - Ensure your team picks have sensible fast and charged moves selected.
  - Rebuild moves with `buildMoveBook` on startup is already handled by the app.
- **Long option lists**
  - By design, the menu opens only after 2 characters and caps results at 30.

---

## Privacy

- All calculations run locally in your browser.
- No accounts, no remote battle logic.

---

## Versioning

Tag releases with npm so GitHub gets a proper tag:

```bash
npm version 1.2.0 -m "chore(release): v%s"
git push
git push --tags
```

---

## Changelog

### v1.2.0
- Live Results shows the **top 2 enemy charged danger moves** with fasts, turns, and seconds.
- Live Results shows your **top 2 danger moves** with timings.
- Search upgraded to **word-start matching**, 2 character minimum, 30 option cap.
- League builder writes to `src/Data/leagueFiles` to match app imports.
