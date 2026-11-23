# Roadmap

ForgeLedger keeps the base solid before adding features. Each phase ships as its own pull request. Bugs and ideas found while using the app are collected in `ForgeLedger Bugs.txt` and added here.

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
- **Lists:** search matches what's shown, filters and sortable columns, form limits, Undo for deletes, and optional paint colours.
- **Painting workflow:** the queue links to miniatures and can mark them complete, recipes use your own paints, low stock goes to the wishlist in one click, and deadlines get overdue and due-soon markers.
- **Base (phase 6):**
  - a README, an MIT licence and this roadmap;
  - CI in Chromium, Firefox and WebKit;
  - plain script files;
  - page addresses;
  - a hosting guide;
  - an accessibility and phone layout pass.
- **Paint levels (phase 7):** stock is Full / Good / Half / Low / Empty, set with one tap.
- **Queue controls (phase 8):** next stage, a progress bar, a +1 counter, Top, and drag to reorder.
- **Fixes (phase 9):** the queue +1 counts models per stage and moves the item on when they're all done, paint colours show as a swatch, editing keeps fields the form doesn't show, and the sidebar footer no longer overlaps the nav in short windows.
- **Fewer trips to the edit form (phase 10):** one-tap status fields, +/− buttons on counts, a quick-add row, and keyboard shortcuts with an off switch.
- **Skills and paint types (phase 11):** a level guide, a library of 20 techniques with a next step for each level, a skill profile, practice suggestions, and Primer and Shade/Wash paint types.
- **Queue models at different stages (phase 12):** split a queue item by stage, with a count and a Move 1 button for each stage. _(From the bug list.)_
- **Wishlist Bought button (phase 13):** restocks set the paint back to Full; paints, tools and miniatures move into their lists; anything else asks where it goes.
- **Editable queue stages (phase 14):** edit the default stages, or give one queue item its own; items follow renames and move on from deleted stages. _(From the bug list.)_
- **Miniature photos (phase 15):** add photos from files or a phone camera, kept on your device in the browser's own storage and included in backups. _(From the bug list.)_
- **Progress and rewards (phase 16):** work in progress counts toward a project's percentage, and wishlist items can unlock as rewards at a project %. _(From the bug list.)_
- **Example data (phase 17):** a Load example data button on an empty dashboard, and the same data as a backup file in the repository. _(From the bug list.)_

## Version 1.0 (in progress)

The first numbered release. See [CHANGELOG.md](CHANGELOG.md).

- **Settings:** theme, currency, auto-save, keyboard shortcuts and Erase all data in one place.
- **A light theme,** or one that matches your device. _(From the bug list.)_
- **A currency setting.** Prices were fixed to GBP.
- **Auto-save to a JSON file you choose,** in Chromium-based browsers.
- **Tables fit a laptop screen:** the miniatures table no longer scrolls sideways at 1280px wide.
- **Version numbers:** the app shows 1.0.0, and backups record the version that made them.

## Later

- Count restock purchases in Recorded spend. Bought on a restock sets the paint to Full but doesn't record what the new pot cost, because a paint holds one price.
- Installing as an app when hosted over HTTPS.

## Considered, not planned

- Painting sessions and time tracking.
- A history of how each skill level changed over time.
- A login. It's only needed if data ever moves to a server.
- Renaming `forgeledger_v2.html`. Browsers may keep a local file's saved data under its own name, so a renamed copy could open empty. `index.html` is the file to open.
