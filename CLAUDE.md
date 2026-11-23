# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForgeLedger is an offline-first, single-page tracker for miniature wargaming: paints, tools, miniatures, army projects, a painting queue, painting-skill levels, and a wishlist. The app is plain HTML/CSS/JS with no framework, no runtime dependencies, no build step, and no backend. All data lives in the browser's `localStorage`. `package.json` holds development tools only.

Keep it runnable from `file://`. Browsers refuse to load ES module scripts from `file://`, and service workers don't work there, so don't introduce modules, a bundler, or a service worker unless the project moves to hosting.

## Running and verifying

- **Run:** open `index.html` in a browser. It forwards to `forgeledger_v2.html`, which is the app itself. It works over `file://`. You can also serve the folder with `python3 -m http.server` and open `/`.
- **localStorage is scoped to the origin.** Data saved under `file://` does not appear under `http://localhost:8000`, and data saved under one port does not appear under another. If saved data seems to be missing, check the origin first.
- **Setup:** `npm install`, then `npx playwright install chromium` once. Only the tests and formatter need this; the app doesn't.
- **Tests:** `npm test` runs the Playwright suite in `tests/` against the `file://` page.
  - One file: `npx playwright test tests/app.spec.js`. One test by name: `npx playwright test -g "low-stock"`.
  - Each test gets a fresh browser context, so `localStorage` starts empty.
  - The auto `pageErrors` fixture in `tests/helpers.js` fails any test where the page throws an uncaught error.
  - Most tests open the app from `file://`. `tests/hosted.spec.js` opens it over HTTP from `tests/serve.js`, a minimal static server that Playwright starts on port 4173.
  - `npm test` runs Chromium only. `npm run test:all` adds Firefox and WebKit; install them first with `npx playwright install firefox webkit`. CI runs all three.
  - Import `test` and `expect` from `./helpers`, not from `@playwright/test`, so the fixtures apply. `helpers.js` also has helpers for seeding data, filling forms, downloads, and imports.
- **Formatting:** Prettier, configured in `.prettierrc`: 2-space indent, 80-column lines, and 120 columns for HTML. Run `npm run format` to format or `npm run format:check` to check. Format before committing.

## Architecture (`js/`)

The code lives in plain `<script>` files that share the global scope. They aren't ES modules, which can't load from `file://`. `forgeledger_v2.html` loads them in this order:

| File         | Contents                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `util.js`    | helpers with no app state: `id()`, `esc()`, `safeColour()`, `safeUrl()`, `money()`, `toast()`, `download()` |
| `schema.js`  | storage keys, `defaults`, `defs`, `column()`, link helpers, `projectStats()`                                |
| `storage.js` | load, validate, repair, migrate, `save()`, `commit()`, `commitWithUndo()`, backup age                       |
| `render.js`  | nav and page switching, dashboard, tables, queue, skills, sorting, deadline markers                         |
| `forms.js`   | `inputAttrs`, `fieldHtml()`, `openForm()`, `submit()`                                                       |
| `actions.js` | delete, add to wishlist, the queue completion prompt, JSON export/import, CSV                               |
| `app.js`     | mutable state, `db = load()`, event wiring, start-up                                                        |

- **Only `app.js` runs code at load.** The other files only declare functions and constants, so a function can call anything in any file. Top-level code must only use what earlier files define; for example, `defaults` in `schema.js` calls `id()` from `util.js`.
- **Every top-level name is global,** so two files can't declare the same `let` or `const` name. Declaring one twice is a `SyntaxError` that stops the app loading.
- **Mutable state lives in `app.js`:** `db` (all user data), `section` (the current section), `editId` (the record open in the form), plus `undo`, `sort`, `recovered`, `memoryOnly`, `upgraded`, `completing` and `toastTimer`.

To add a file, add its `<script>` tag before `app.js` in `forgeledger_v2.html`.

**Pages and addresses.** Each section has an address: `#/dashboard`, `#/paints`, and so on.

- **The nav** is `<a href="#/key" data-sec="key">` links, with `aria-current="page"` on the current one.
- **`go(k)`** moves to a section. It sets `location.hash`, which adds a history entry, then calls `show(k)`.
- **`show(k)`** draws a section. It closes open dialogs, resets search, filter and sort, and sets the page title.
- **Back, forward and typed addresses** fire `hashchange`, which calls `show()` for the section in `sectionFromHash()`.
  - Unknown names fall back to the dashboard. `Object.hasOwn` stops names like `toString` from matching.
  - The slash is optional: `#paints` works too.
- **Reloading** keeps the current section.
- **Clicks on nav links.** The click listener handles plain left-clicks itself. Ctrl, Cmd and Shift clicks are left to the browser, so they open a new tab or window.
- **`index.html` only forwards** to `forgeledger_v2.html`, keeping the hash. The app file keeps its old name, so data saved by earlier versions stays at the same `file://` location.

**Persistence.** `save()` serializes the whole `db` to `localStorage["forgeledger_v2_data"]`.

- **Loading and importing.** Both go through `fromBackup()`: `fillIds()` gives every record a unique string id, `migrate()` upgrades the schema, then the data is shallow-merged onto `defaults`.
- **Adding a collection.** To add a top-level collection, add it to both `defaults` and `COLLECTIONS`.
- **Shape checks.** `problemWith()` checks the data's shape:
  - An import with a problem is rejected whole.
  - Saved data with a problem is repaired with `repair()`. The original string is copied to a `forgeledger_v2_recovered_<ISO time>` key first, and `#alerts` offers a download.
- **Replacing data on import.** When the app already has data, the user must confirm, and the current data is downloaded first.
- **Schema version.** `schemaVersion` is stored with the data. It's currently 2. When stored fields change shape, bump `SCHEMA_VERSION` and add a step to `migrate()`; each step checks the version it starts from. Backups from a newer version are refused.
  - 0 → 1: the version field was added.
  - 1 → 2: each paint's `stock` level is set from its old `remaining` percentage by `stockFromPercent()`. The old `remaining` field stays in the record but is no longer read.
- **Saving an upgrade.** When `load()` upgrades saved data from an older schema, it sets `upgraded`, and `app.js` saves once at start-up so storage holds the current schema. Repaired data is not saved until the user changes something, so the damaged original is never replaced first.
- **Missing fields.** Existing records are never rewritten field by field, so every reader must tolerate missing or blank fields.
- **Untrusted values.** Field values in imported data are not checked. Treat them as untrusted.
- **Blocked storage.** If storage is blocked, `memoryOnly` is set: the app works in memory and says nothing is saved.
- **Two tabs.** A `storage` event listener reloads `db` when another tab saves, so two open tabs don't overwrite each other.
- **Backup reminder.** The last export time is kept in `localStorage["forgeledger_v2_last_backup"]`, outside the data. The dashboard warns when there's no backup or the last one is `BACKUP_REMINDER_DAYS` (14) or more days old.

**Backward compatibility.** Users keep and move their data with Export backup and Import, which write and read JSON files. ForgeLedger is open source and runs from a local file, so old backups and existing `localStorage` data must keep loading after any change. Don't rename or repurpose stored fields. Add new fields as optional. A field that is no longer used can stay in old records, as long as nothing reads it.

**Config-driven sections.** `defs` has one entry per collection, in nav order. It drives the nav, page titles, the add/edit form, table columns, the filter dropdown and search. Each entry has:

- `title` and `sub` for the page heading, `nav` if the nav label differs from the title, and `noun` for the form title ("Add paint").
- `fields`: `{ key, label, type, required, options, atMost, doneWhen }` objects.

  - `atMost` names another field this one can't exceed; for example, painted count can't exceed model count. `submit()` checks it with `setCustomValidity`.
  - `doneWhen(record)` on a `date` field turns on deadline markers for that date (see below). Markers stop once `doneWhen` returns true.
  - Each type maps to an input (`inputAttrs` for plain `<input>`s) and a display format (`cellText()` / `cellHtml()`). Blank values display as blank.

  | Type             | Input                       | Notes                                                 |
  | ---------------- | --------------------------- | ----------------------------------------------------- |
  | `text` (default) | text box                    |                                                       |
  | `textarea`       | multi-line box              |                                                       |
  | `select`         | dropdown                    | needs `options`                                       |
  | `link`           | dropdown of `db[f.to]`      | stores a record `id`; shown by name, blank if deleted |
  | `links`          | multi-select of `db[f.to]`  | stores an array of ids; read it with `asList()`       |
  | `date`, `url`    | matching browser input      |                                                       |
  | `color`          | colour picker + "No colour" | a picker can't be empty, so "No colour" saves `""`    |
  | `count`          | whole number ≥ 0            |                                                       |
  | `money`          | number ≥ 0, 2 decimals      | shown with `money()`                                  |
  | `percent`        | whole number 0–100          |                                                       |
  | `level`          | whole number 0–9            | stored as a number                                    |
  | `scale`          | dropdown of `options`       | in tables, one-tap buttons (`setScale()`)             |

- `columns`: the field keys the table shows.
- `computed`: read-only columns calculated from other data, such as `projectStats()` for projects. A computed column is `{ label, type, value(record) }`, and `column(d, key)` resolves keys from both `fields` and `computed`.
- `filter`: the key of the field the filter dropdown filters on.
  - The dropdown lists the field's `options`. A field without options gets the values currently in use, e.g. project game systems.
  - The choice survives saves and resets when you change section.
- `view`: the section element to show. Collections without one use the shared `#listView` with `renderList()` and `renderTable()`. `queue` and `skills` have their own views and renderers.

To add a field, add it to `fields`, and to `columns` if it should appear in the table.

Search (`searchText()`) matches each field and computed value as displayed, so field names and ids never match, and linked records match by name.

**Sorting.** Column headers are buttons (`data-sort`). Clicking one sorts the visible rows by that column, and clicking it again reverses the order. The sort resets when you change section.

- `sortValue()` compares numeric types (`count`, `money`, `percent`, `level`, and computed numbers) as numbers. `scale` fields sort by amount, so the last option (Empty) is lowest. Everything else sorts by its displayed text, ignoring case.
- Blanks always sort last.
- Sorting only changes the display; `db` keeps its order.

**Deadline markers.** `dueBadge(date, done)` shows "Overdue", "Due today" or "Due in N days" (up to `DUE_SOON_DAYS`, 14) for a date that isn't done yet. It's used for:

- project target dates (done when `projectDone()`), in the projects table and on the dashboard;
- queue due dates (done when the stage is Complete).

`daysUntil()` reads `YYYY-MM-DD` as a local date, and ignores anything else.

`COLLECTIONS` (used by loading and validation) repeats the collection keys that are in `defs`, so storage code doesn't depend on UI config. Keep the two in step.

**Rendering.** Every renderer rebuilds its container with template-literal `innerHTML`. Imported backups can contain arbitrary strings, so:

- Escape every stored value with `esc()`, including ids in `data-*` attributes and `<option value>`.
- Put a colour into `style` only through `safeColour()`, which accepts hex codes only.
- Render a link only from `safeUrl()`, which accepts http(s) only.
- Turn numbers into numbers before printing them, e.g. skill levels are clamped with `Number()`.
- CSV export puts `'` in front of any cell that starts with `=`, `+`, `-` or `@` (plain numbers excepted), so spreadsheets don't run it as a formula.

`tests/security.spec.js` tries each known injection route. Add a case there when you render a new field.

**Accessibility and layout.**

- **Automated accessibility checks.** `tests/accessibility.spec.js` runs axe-core against WCAG 2.1 and 2.2, levels A and AA. It covers every section, the add/edit form and the completion prompt, at desktop and phone sizes. New UI must pass it; seed its data so the new elements appear. It opens the app over HTTP (`SITE` in `tests/helpers.js`), because axe reads the stylesheet, and WebKit blocks a page opened from `file://` from reading other local files.
- **Red backgrounds.** Text on a red background uses `--accent-strong`, not `--accent`. White on `--accent` is under the 4.5:1 contrast minimum.
- **Icon-only buttons** need an `aria-label`, like the queue's "Move … up" arrows.
- **Button sizes.** Row buttons are at least 32px, and 44px on touch screens (`pointer: coarse`).
- **Focus.** `:focus-visible` gives every control one blue focus ring. Don't remove outlines.
- **Phones (≤520px):**
  - The nav is a single scrolling row, and `show()` scrolls the current link into view.
  - The page grid uses `minmax(0, 1fr)`, so wide content can't widen the page.
  - `tests/layout.spec.js` checks that every section fits a 375px screen.

**Events.** A single delegated `click` listener on `document` handles nav links (`a[data-sec]`), then dispatches on `data-*` attributes of the clicked `<button>`: `edit`, `del`, `queue`, `up`, `down`, `recovery`, `wish`, `wishall`, `sort` and `scale`.

- **Level buttons (`scale`).** A tap saves the value with `commit()`, then `setScale()` redraws only that table cell and moves focus back to the chosen button. The row doesn't move in a sorted table, and keyboard users keep their place.

- `edit` and `del` work in every section because they act on the current section.
- To add a new row action, render a button with a new `data-*` attribute and add a branch to this listener.
- Other controls are wired directly in `app.js`.

**Mutation pattern.** Never change `db` and call `save()` directly. Use `commit(() => { /* change db */ })`: it snapshots `db`, applies the change, and saves. If saving fails, it restores the snapshot, shows an error, and returns `false`. Afterwards, call `renderNav()` (nav badges show item counts) and the renderer for the affected view.

**Undo.** `commitWithUndo(change, message)` commits a change and shows `message()` with an Undo button, which restores a copy of `db` from just before the change.

- **Deletes** go through `remove(section, id)`, which uses `commitWithUndo`. There is no confirmation dialog.
- **Unlinking on delete.** Deleting a record clears every `link` field and removes the id from every `links` array that points at it. For example: miniatures in a deleted project, queue items for a deleted miniature, or recipes that used a deleted paint.
- **Undo never reverts later work.** Every `commit()` clears the copy, and so does a change from another tab.

**Completing queue items.** When `submit()` saves a queue item whose stage has just become "Complete" and that links to a miniature, `askComplete()` opens `#completeDialog`. It offers two choices:

- mark the miniature complete, with painted count equal to its model count;
- remove the item from the queue.

Apply runs on the dialog form's `submit`, not its `close`, so the change happens during the click.

The form handler `submit()` writes to `db[section]`, so `openForm(sec, obj)` sets `section` before the modal opens. If saving fails, the form stays open so nothing typed is lost.
**Data semantics:**

- `FormData` returns strings, so numbers are stored as strings. Consumers wrap them in `Number(...)`. Only `level` fields are converted (and clamped to 0–9) on save.
- Editing a record replaces the whole object with the form's contents.
- Link fields hold a record `id`:

  - `miniatures.project` and `queue.project` point at projects.
  - `queue.miniature` points at a miniature. It's set when a miniature is queued from its row; items queued before this field existed have none.
  - `miniatures.paints` is a `links` array of the paints in its recipe. The older free-text `recipe` field is still there, labelled "Recipe steps".
  - `wishlist.paint` points at the paint a wishlist item restocks. `addToWishlist()` sets it when a low paint is added from the dashboard, and the dashboard uses it to show "On wishlist".

  Older data can still hold links to deleted records; these display blank, and saving the record clears them. Imported `links` values may not be arrays; `asList()` treats anything else as empty.

- Paint stock is `stock`, one of `STOCK_LEVELS`: Full, Good, Half, Low or Empty, or `""` if unknown. A paint is low (`isLow()`) when its stock is Low or Empty. Low recipe paints are flagged in three places:

  - the miniatures table;
  - queue items that aren't complete;
  - the dashboard's stock warnings, which say how many queued miniatures need each low paint.

- `projectStats(p)` calculates a project's `models`, `painted`, and `spent` from the miniatures linked to it. Only `target` and `budget` are entered by hand. If `target` is blank, progress is measured against models owned. Older records may still contain hand-entered `complete` and `spent` fields; these are ignored.
- The dashboard's "Recorded spend" adds up `price` across paints, tools, and miniatures. Each `price` is added as entered; it is not multiplied by `quantity`.
- Currency is hardcoded to GBP (`money()` and the "(£)" field labels).
