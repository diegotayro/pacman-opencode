# AGENTS.md

Pac-Man MVP: vanilla JS/HTML/CSS, no framework, no build step.

## Run / verify

- Open `src/index.html` directly in a browser (macOS: `open src/index.html`). There is no bundler, dev server, or build.
- There is **no test, lint, typecheck, or formatter tooling** and no `package.json`. Do not invent `npm`/`pnpm` commands. Verify changes by loading the page and playing.
- The only JSON at the root, `skills-lock.json`, is managed by an external skills installer — do not hand-edit it.

## Script loading contract (easy to break)

- `src/index.html` loads **classic scripts, not ES modules**, in a required order: `maze.js` -> `game.js` -> `render.js` -> `main.js`. Preserve this order; do not add `type="module"`, `import`/`export`, or a bundler.
- Files communicate through `window.*` globals. `maze.js` sets `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`; `game.js` sets `createGame`, `update`, `DIRS`, `FRIGHT_BLINK` and depends on the maze globals; `render.js` reads `DIRS` and `FRIGHT_BLINK`; `main.js` drives the loop with `createGame`/`update`/`draw`.

## Maze and rendering model

- `MAZE` in `src/js/maze.js` is **pristine and must not be mutated**. `createGame()` copies it into `game.grid`; dots are eaten from `game.grid`, so rendering must read `game.grid`, never `MAZE`.
- Grid is 28x31, `(x, y)` with origin top-left. Tile codes: `1` wall, `2` dot, `3` pen door, `4` power pellet, `0` empty/walkable. `TUNNEL_ROW = 14`.
- Tile size is `TILE = 20` in `render.js`; the canvas is `560x620` = 28x31 tiles. If the maze dimensions change, update the canvas `width`/`height` in `index.html` to match.

## Spec-driven workflow

- Development follows the `spec` / `spec-impl` skills, installed in `.agents/skills` (an OpenCode compatibility path) and tracked by `skills-lock.json`. Use them by ID (`spec`, `spec-impl`). Don't relocate them to `.opencode/skills` by hand, or the installer's lock tracking breaks.
- `/spec` designs one feature and writes `specs/NN-slug.md` (the `specs/` folder does not exist yet; it is created on first use). It never writes code, and its output starts as `Draft`.
- `/spec-impl NN-slug` only proceeds when the spec's status line means `Approved` (the human flips it, not the agent). It then creates branch `spec-NN-slug` and implements the plan step by step with pauses. Never commit automatically.
- Keep the current scope: don't implement changes outside the active spec.

## Conventions

- All comments, UI text, and specs are in **Spanish**. Match that language.
- Code style uses space-padded parentheses, e.g. `isWall( grid, x, y, actor )` and `for ( ... )`, with 2-space indentation. Match existing style; don't reformat files.
