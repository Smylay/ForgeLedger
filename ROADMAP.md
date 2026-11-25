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
- **Version 1.0:** Settings (theme, currency, auto-save to a file, keyboard shortcuts, Erase all data), a light theme _(from the bug list)_, tables that fit a laptop screen, and version numbers in the app and its backups. See [CHANGELOG.md](CHANGELOG.md).
- **Tidier code (phase 19):** one file per feature, a table of button actions, and the longest drawing functions split up; plus how to update without losing data. _(From the bug list.)_
- **Quick wins (phase 20):** each list opens sorted with what needs attention first, "Used in" on paints, rewards on the projects page, and "Quick add". _(From the bug list.)_
- **Suggestions as you type (phase 21):** brand, range, faction and game system boxes suggest what you've used and common values; tools and miniatures have a brand. _(From the bug list.)_
- **Paint catalogue (phase 22):** about 5,300 paints from 15 brands to pick from in the paint form and quick add, planning recipes with paints you don't own, and more paint types. _(From the bug list.)_
- **Skills (phase 23):** each technique has a difficulty, and Practice next suggests easier ones first; techniques say which tools they need, with Bought and Add to wishlist; Two Thin Coats Dark Arts joins the catalogue. _(From the bug list, and chat.)_

- **Colour themes and going back (phase 24):** Forest, Ocean, Amethyst and Parchment themes; Back, −1 and Back 1 in the queue; Dirty Down in the catalogue. _(From the bug list, and chat.)_
- **Queueing from progress, and slimmer downloads (phase 25):** queueing a miniature starts from its status and painted count, and downloads hold just the app. _(Asked for in chat.)_
- **Version 1.1.0:** phases 19 to 25.
- **The queue keeps miniatures up to date, and restock spend (phase 26):** queue progress moves each miniature's status and painted count forward, and restocks count in Recorded spend. _(From Later.)_
- **Version 1.2.0:** phase 26.
- **The painting board (phase 27):** a card for every model in columns by phase, Add 1 and Add all, Edit board, and a simpler List. _(Asked for in chat.)_
- **Photos of each model (phase 28):** a photo on any model's card, kept with its miniature's photos. _(Asked for in chat.)_
- **Project pages and model names (phase 29):** a page for each project with its progress, miniatures, board status, photos, wishlist items and rewards; a Project field on wishlist items; and names for the models on the board. _(Asked for in chat.)_

## Version 2.0 (asked for in chat)

A painting board, with a card for every model, instead of stage buttons on each queue item; photos of each model; and a page for each project.

### Then: version 2.0.0

## Releases

Phases merge into `dev`; versions are released to `main`. Version 1.2.0 brought phase 26, and 1.1.0 phases 19 to 25. See [CHANGELOG.md](CHANGELOG.md).

## Later

Nothing yet. Ideas from the bug list land here or in a phase.

## Considered, not planned

- Painting sessions and time tracking.
- A history of how each skill level changed over time.
- A login. It's only needed if data ever moves to a server.
- Installing as an app. It only works when hosted over HTTPS, and ForgeLedger is mainly run from a file.
- Renaming `forgeledger_v2.html`. Browsers may keep a local file's saved data under its own name, so a renamed copy could open empty. `index.html` is the file to open.
