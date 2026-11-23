# Roadmap

ForgeLedger keeps the base solid before adding features. Each phase ships as its own pull request.

## Principles

- **It runs by double-clicking a file.** No install, build step or server is needed. Hosting on a server is optional.
- **Data stays in the browser.** It's backed up and moved with JSON export and import.
- **Old backups keep loading.** Stored fields are never renamed or repurposed, and schema changes go through a migration.
- **Every change is tested** in Chromium, Firefox and WebKit.

## Done

- **Foundations:** a Playwright test suite, Prettier formatting, a config-driven structure for every section, and a fix for the original UI bugs.
- **Data safety:**
  - imports are validated, and the app asks before replacing data and downloads a copy first;
  - open tabs stay in sync;
  - failed saves are undone and reported;
  - damaged data is recovered;
  - the schema is versioned;
  - a backup reminder.
- **Security:** imported data can't run code, open `javascript:` links or inject spreadsheet formulas.
- **Lists:**
  - search matches what's shown;
  - filters and sortable columns;
  - form limits;
  - Undo for deletes;
  - optional paint colours.
- **Painting workflow:**
  - the queue links to miniatures and can mark them complete;
  - recipes are built from your own paints;
  - low stock can go to the wishlist in one click;
  - overdue and due-soon markers for deadlines.
- **Base (phase 6):**
  - a README, an MIT licence and this roadmap;
  - CI that runs the tests in Chromium, Firefox and WebKit, plus a format check;
  - `main.js` split into plain script files;
  - pages with their own addresses, so back, forward and bookmarks work;
  - a hosting guide, with tests that run the app over HTTP as well as from a local file;
  - a mobile and accessibility pass, with automated WCAG 2.2 AA checks on every page.

## Phase 7: Paint levels (in progress)

- **Paint stock as Full / Good / Half / Low / Empty,** set with one tap in the paints table.
- **Existing Remaining % values convert once:** 0% becomes Empty, under 20% Low, under 50% Half, under 80% Good, and anything higher Full.
- **Low and Empty count as low stock.**
- **The stored percentage is kept** so older backups still load, but it's no longer shown.

## Phase 8: Queue controls

- A next-stage button on each queue item.
- A progress bar across the seven stages.
- A "painted +1" button that updates the linked miniature, up to its model count.
- Drag to reorder (mouse and touch) and move-to-top, alongside the arrows.

## Later

These will be prioritised when we get there:

- A currency setting (currently fixed to GBP).
- A painting session log.
- Photos of miniatures. These need IndexedDB, because local storage holds only about 5 MB.
- Optional automatic saving to a JSON file you choose (Chromium-based browsers only).
- Installing as an app when hosted over HTTPS.
- A login, but only if data ever moves to a server.
