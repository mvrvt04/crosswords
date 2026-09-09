# Apollo Crossword

A crossword app built for the second part of the Apollo assessment. It started
as the requested crossword UI and grew into a small product: a personal
dashboard with animated stats and history, a shared library of puzzles served
at random, an admin panel to add crosswords by JSON and see everyone's results,
and a phone experience with its own keyboard.

![Dashboard](docs/dashboard.png)

<p>
  <img src="docs/play.png" alt="Playing a crossword on desktop" width="66%">
  <img src="docs/mobile-play.png" alt="Playing on a phone with the on-screen keyboard" width="32%">
</p>

## Try it

If a hosted URL was included with the submission, open your personal link
and you are signed in straight away: no form, no password. Press "Play a
random crossword". The admin panel is at `/admin`.

To run it locally:

```bash
npm install
npm run build      # frontend + server
npm start          # http://localhost:8787
```

For development with hot reload, run the API and Vite side by side:

```bash
npm run server     # API + built frontend on :8787
npm run dev        # Vite on :5173, proxies /api to :8787
```

Other scripts: `npm test` (43 unit tests), `npm run typecheck`, `npm run preview`.

The admin signs in at `/admin` with an email and password, or through a
personal link. Defaults: `admin@apollo.st` / `apollo`, link
`/admin?token=admin-apollo-crossword`. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`
and `ADMIN_LINK_TOKEN` in the environment to change them, `PORT` to change
the port and `DATA_DIR` to move the database file.

**Accounts.** There is no self-registration. Players are created in the
admin panel, and every player gets a personal sign-in link
(`/login?token=…`) plus an optional password. One account is seeded on
first boot for Matteo Natale, with a fixed link token so the link in the
submission keeps working even if the database is recreated:

```
http://<host>/login?token=matteo-natale-apollo
```

A fresh database also gets demo data (three more players and a week of
games) so the dashboard and the admin panel do not open empty; the reviewer
account has solved the six minis and still has the full-size Example
Crossword ahead. Set `SEED_DEMO=false` to start empty.

## What is in it

**Playing.** Click a square or a clue to start. Letters flow through the word,
skip filled squares and continue with the next unfinished clue. The clue you
are on sits in a bar above the grid with number, direction and enumeration;
the word is tinted, the crossing clue is marked in the list. Arrows, `Tab`,
`Space`, `Home`/`End`, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Ctrl+.` pencil
mode, `?` for the full list. Check and reveal at letter, word or puzzle level;
wrong letters get a red strike that disappears when retyped; revealed letters
are marked and locked. Word breaks from enumerations like `(5,2)` are drawn in
the grid. Completed words turn green. Filling the last square of a wrong grid
raises a toast with a one-click check. Solving shows the time, checks and
reveals, a line about how you did, and a "Copy result" button that puts a
shareable summary with an emoji map of the grid on the clipboard.

**Sign in.** A personal link signs you in with nothing to type; a username
and password work too. Sessions survive reloads and expire after 90 days.
Signing out invalidates the session on the server.

**Dashboard.** The app opens on a dashboard, not a grid. It greets you by name,
counts up your solved puzzles, best and average time and clean solves, draws
a column chart of your last ten solve times that grows in on first paint
(hover any column for the details, clean solves carry a check mark), offers
to continue an unfinished puzzle. The hero is **Today's crossword**, on the
same dark crossword backdrop as the sign-in page so nothing else competes
with it: one puzzle per day per language,
the same for every player, rotating through the library by date. The full
history (every game, grouped by month) has its own page, reached from the
account menu next to Settings. The admin can pin a puzzle as
today's (for example the assessment crossword before sending the link). An
"All puzzles" list under the history lets players pick or replay any puzzle,
with their best time.

**Admin.** Behind an email and password (or the admin's personal link),
with a sidebar of four sections. Dashboard: totals,
games per day for the last two weeks, today's puzzle per language, recent
games and top solvers. Players, Puzzles and Games each have their own page;
Puzzles is where you pin today's puzzle (or let it rotate) and Games has a
filter. Create players, copy
their sign-in link, set or remove a password, issue a new link (the old one
stops working) or remove the player. Paste or upload a crossword JSON and
choose its language; it is validated with the same parser the game uses and
the error names the exact problem ("4 down runs off the grid"). Puzzles can
be hidden from players or deleted.

**Phones.** The clue bar sticks under the header, the clue lists become tabs,
and a custom keyboard sits under the grid with the actions a phone has no keys
for: switch direction, pencil, undo, previous and next clue. The system
keyboard is suppressed so it never covers the grid.

**Two languages.** The whole player experience is available in English and
Italian, including the game itself ("1 Orizzontale", "Verticali", every toast
and dialog). Puzzles carry a language, and "Play a random crossword" only
offers puzzles in the player's language. The library ships with the Example
Crossword, six English minis and three Italian minis. Today's puzzle is
chosen per language. The admin panel is English only, as internal tooling.

**Settings page.** Account details (name, username, whether a password is
set, the personal sign-in link with a copy button), language, appearance
(system, light, dark) and sign out. In-game toggles stay in the game.

**Timer, pause, persistence, themes.** The timer starts with the first letter,
pauses when the tab is hidden, and pausing blurs the grid. Progress survives a
refresh.

## Design decisions

**One accent hue for "where you are", green only for correct, red only for
wrong.** The selected square and the current word are two steps of the same
amber, so the hierarchy reads at a glance. Green and red are never used for
anything else. The palette follows Apollo's own: warm amber on stone
neutrals, with a full dark-mode set of tokens, all measured against WCAG AA.

**Do not spoil the puzzle.** Wrong letters are never flagged unless you ask.
Auto-check exists as a setting, off by default. Word celebration can be turned
off for a purist solve.

**Plain-spoken feedback.** "1 wrong letter flagged in 9 Across", "Nothing to
check yet in 4 Down", "Every square is filled, but something is not right yet".
Impossible actions are disabled rather than hidden; destructive ones ask first.

**A dashboard before a grid.** Opening straight on a puzzle is fine for a demo;
a product needs a place that shows progress, offers the next thing to do and
never loses an unfinished game. The count-up numbers are the only decoration.

**The admin validates with the real parser.** There is exactly one definition
of a valid crossword, shared by the game, the offline store and the server.

## Architecture

```
src/
  model/        pure domain: parsing, enumeration, navigation helpers
  state/        reducer (all game logic incl. undo and pencil), selectors, local save
  services/     Api interface, remote and offline adapters, shared stats, identity
  game/         the game screen (composition of the components below)
  components/   Grid, ClueBar, Clues, Header, OnScreenKeyboard, Menu, Dialog, StatTile ...
  pages/        Home (dashboard), Play, Login, Settings, admin/ (layout + Dashboard, Players, Puzzles, Games)
  data/         seed puzzles (the provided crossword, six English and three Italian minis), accounts, demo data
  i18n/         English and Italian dictionaries, the t() hook, error-code mapping
server/         dependency-free Node HTTP server: JSON API, file-backed store, static files
```

- **Frontend:** React 19, TypeScript (strict), Vite, CSS Modules with design
  tokens, react-router. No UI library; every control is hand-built for
  behaviour and accessibility.
- **Translation** is a typed dictionary: the English object defines the keys
  and the Italian one must provide every one of them, so a missing string is
  a compile error. The reducer emits language-neutral events (a word is
  `{number, direction}`, not "1 Across") and the server returns error codes,
  so nothing user-facing is hard-coded in one language.
- **Game logic** lives in a pure reducer with one-shot events for the UI.
  Undo/redo is a snapshot stack inside that reducer. Thirty-nine unit tests
  cover the parser, navigation rules, check/reveal/clear, undo, pencil,
  completion and the seed puzzles.
- **Storage adapter.** Components only see the `Api` interface. At startup
  the app probes `/api/health`: with the server present it uses the remote
  adapter and everything is shared; without it (plain static hosting) it
  falls back to a localStorage adapter with the same seed puzzles, so the app
  works end to end either way. Both adapters compute stats with the same
  shared module, so the numbers cannot drift.
- **Server:** a single Node process, no dependencies, bundled with esbuild so
  it can import the client's parser and stats code. It stores a JSON file
  atomically (write temp, rename) and serves the Vite build with a
  history-API fallback. Uploads are size-capped and validated; names are
  trimmed and length-limited; admin requests carry a server-side session
  token, checked per request.
- **Accounts.** Sign-in checks a scrypt hash in constant time; sessions are
  random bearer tokens stored server-side and checked on every player
  request. By product decision the server also keeps a readable copy of each
  password so players can see it behind an eye toggle on their settings
  page (a trade-off worth revisiting for a production deployment). Link tokens are random per player and can be
  rotated from the admin panel. The admin signs in the same way (email + password, or a link);
  its sessions live server-side too. The seeded accounts are deliberately
  simple for an assessment; a production deployment would set
  `ADMIN_PASSWORD` and `ADMIN_LINK_TOKEN` and rotate Matteo's link after
  first use.

## Deploying

The server needs Node 20+, `npm run build` and `npm start`. It reads `PORT`
from the environment and stores its JSON database in `DATA_DIR`
(default `./data`). Any host that runs those two commands works.

**Railway** (`railway.json` is included): New Project > Deploy from GitHub
repo > pick this repository. Railway builds with `npm run build` and starts
with `npm start`, checking `/api/health`. Under Variables add
`ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_LINK_TOKEN` (optional:
`SEED_DEMO=false` to start without demo players). Under Settings >
Networking, "Generate Domain" gives the public URL. To keep the database
across deploys, add a Volume mounted at `/data` and set `DATA_DIR=/data`.
If the build ever fails with "vite: not found", add the variable
`NPM_CONFIG_PRODUCTION=false` so dev dependencies are installed for the build.

**Render** (`render.yaml` is included): New > Blueprint > this repository.
The free plan sleeps after 15 minutes without traffic, so the first visit
after a pause takes about half a minute to wake, and its disk is ephemeral.

A static host (Vercel, Netlify, GitHub Pages) serves `dist/` and gets the
offline mode: fully playable, with stats kept in the visitor's browser.

## With more time

- A real database (Postgres) behind the same `Api` interface, httpOnly
  cookie sessions, and rate limiting on the login endpoints.
- Testing the on-screen keyboard on more physical devices. It is verified in
  Chrome's device emulation; the `beforeinput` path for Android system
  keyboards is written but not device-tested.
- Component tests with Testing Library on top of the unit tests, and the
  Playwright audit that was used during development checked into the repo.
- Puzzle import from other formats (.puz, .ipuz) and a small in-browser
  editor for authors.
- A per-puzzle leaderboard and weekly puzzles, which the data model already
  supports.
