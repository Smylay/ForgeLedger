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

## Phase 9: Fixes (in progress)

- **Queue +1 counts per stage:** "Basecoating: 3 of 5 done". When every model is done, the item moves to the next stage automatically, with Undo.
- **Paint colours** show as a swatch beside each paint's name.
- **Editing keeps fields the form doesn't show,** such as the stage count.
- **The sidebar footer** no longer overlaps the nav in short windows.

## Phase 10: Fewer trips to the edit form

- **One-tap status fields,** like paint stock: miniature status, wishlist priority and tool condition.
- **+/− buttons** on paint quantity, model count and painted count. Painted can't go above the model count.
- **A quick-add row** at the top of each list: type a name and press Enter.
- **Keyboard shortcuts:** N to add, / to search, Esc to close, plus keys to jump between sections, and a list of them on "?". A setting turns them off, as WCAG 2.1.4 requires for single-key shortcuts.

## Phase 11: Skills

- **A level guide,** shown next to each skill, e.g. "4/9 · Competent":

  | Level | Meaning    |
  | ----- | ---------- |
  | 0     | Not tried  |
  | 1     | Tried once |
  | 2     | Learning   |
  | 3     | Basic      |
  | 4     | Competent  |
  | 5     | Confident  |
  | 6     | Skilled    |
  | 7     | Advanced   |
  | 8     | Expert     |
  | 9     | Mastery    |

- **A radar chart** of the whole skill profile, drawn in the page so it works offline, with a plain list for screen readers.
- **Practice suggestions:** the lowest skills, and skills not updated in a while. This needs a "last changed" date on each skill, which starts recording in this phase.

## Phase 12: Wishlist "Bought" button

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
