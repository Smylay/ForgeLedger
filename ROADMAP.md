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

## Phase 13: Wishlist "Bought" button (in progress)

- **Paint, Tool and Miniature items** move into that list with their name, price and notes.
- **Restock items linked to a paint** set that paint back to Full instead of creating a duplicate.
- **Terrain, Book and Other items** ask where they should go.

## Later

- A currency setting (currently fixed to GBP).
- Count restock purchases in Recorded spend. Bought on a restock sets the paint to Full but doesn't record what the new pot cost, because a paint holds one price.
- Optional automatic saving to a JSON file you choose (Chromium-based browsers only).
- Installing as an app when hosted over HTTPS.

## Considered, not planned

- Painting sessions and time tracking.
- Photos of miniatures. These would need IndexedDB, because local storage holds only about 5 MB.
- A light theme.
- A history of how each skill level changed over time.
- A login. It's only needed if data ever moves to a server.
