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

## Phase 21: Suggestions as you type (in progress)

_(From the bug list.)_

- **Brand, range, game system and faction boxes suggest values:** what you've already entered, then common brands and game systems. You can still type anything, so there's no separate "Other". Tools and miniatures gain a Brand. (Tool and wishlist categories already have fixed lists.)

## Phase 22: Paint catalogue

_(From the bug list.)_

- **Pick a paint from a catalogue** of about 5,000 paints from 15 brands, and its brand, range, colour and type fill in. Built from `miniature_paints.json`, after a clean-up: varnishes and mediums get no colour, duplicate entries are merged, and a few names and colours are fixed.
- **The recipe picker on miniatures offers catalogue paints too,** marking ones you don't own, with Add to wishlist.
- **Paint types gain Standard, Air, Dry, Glaze and Effect,** to match the catalogue.
- **Range is the product line,** such as Vallejo Model Color or Game Color. The example data's ranges, which only repeated the type, are fixed.

## Phase 23: Skills

_(From the bug list.)_

- **Each technique has a difficulty,** Easy, Medium, Hard or Expert, and Practice next suggests easier ones first.
- **Techniques that need a tool,** such as airbrushing, say so, with Bought and Add to wishlist buttons when you don't have one.

## Phase 24: Colour themes

_(From the bug list.)_

- **More colour choices** on top of dark and light, each checked for contrast.

## Later

- Count restock purchases in Recorded spend. Bought on a restock sets the paint to Full but doesn't record what the new pot cost, because a paint holds one price.

## Considered, not planned

- Painting sessions and time tracking.
- A history of how each skill level changed over time.
- A login. It's only needed if data ever moves to a server.
- Installing as an app. It only works when hosted over HTTPS, and ForgeLedger is mainly run from a file.
- Renaming `forgeledger_v2.html`. Browsers may keep a local file's saved data under its own name, so a renamed copy could open empty. `index.html` is the file to open.
