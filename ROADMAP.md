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

## Phase 11: Skills and paint types (in progress)

- **A level guide:** every level has a name and a meaning, shown on each skill as "4/9 · Competent", with a list of all ten.
- **A technique library** of 20 techniques to pick from, plus Other for your own. Each technique has a next step for your level, which changes as you improve.
- **A skill profile:** every skill's level as a bar, highest first. This replaces the planned radar chart. With 10 to 20 skills, a radar's labels overlap and its shape is hard to compare, while aligned bars with the level written beside them stay readable and work with screen readers.
- **Practice suggestions:** skills not updated in a month come first, then your lowest. Skills now record when their level last changed.
- **Paint types** include Primer, and Shade is now Shade/Wash. _(From the bug list.)_

## Phase 12: Queue models at different stages

_(From the bug list.)_

- **A Split option on each queue item.** It shows how many of the item's models are at each stage, such as "Priming 2 · Basecoating 3", with a button to move one model on.
- **Off by default,** so items work as they do now, with every model at the same stage.
- **The progress bar shows the mix,** and the item is complete when every model is.

## Phase 13: Wishlist "Bought" button

- **Paint, Tool and Miniature items** move into that list with their name, price and notes.
- **Restock items linked to a paint** set that paint back to Full instead of creating a duplicate.
- **Terrain, Book and Other items** ask where they should go.

## Later

- A currency setting (currently fixed to GBP).
- Optional automatic saving to a JSON file you choose (Chromium-based browsers only).
- Installing as an app when hosted over HTTPS.

## Considered, not planned

- Painting sessions and time tracking.
- Photos of miniatures. These would need IndexedDB, because local storage holds only about 5 MB.
- A light theme.
- A history of how each skill level changed over time.
- A login. It's only needed if data ever moves to a server.
