# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForgeLedger is an offline-first, single-page tracker for miniature wargaming: paints, tools, miniatures, army projects, a painting queue, painting-skill levels, and a wishlist. The app is plain HTML/CSS/JS with no framework, no runtime dependencies, no build step, and no backend. All data lives in the browser's `localStorage`. `package.json` holds development tools only.

Keep it runnable from `file://`. Browsers refuse to load ES module scripts from `file://`, and service workers don't work there, so don't introduce modules, a bundler, or a service worker unless the project moves to hosting.

## Bug and idea list

`ForgeLedger Bugs.txt`, at the repository root, is the owner's list of bugs and ideas found while using the app. It's grouped by section.

- **At the start of each phase,** read it and put any new items into `ROADMAP.md`, in a phase or under Later.
- **When a pull request fixes an item,** add `(done in PR #N)` to the end of that item's line, in the same pull request.
- **Don't reword, reorder or remove** the owner's lines.

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

| File            | Contents                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `util.js`       | helpers with no app state: `id()`, `esc()`, `safeColour()`, `safeUrl()`, `money()`, `toast()`, `download()`, `today()` |
| `schema.js`     | storage keys, `defaults`, `defs`, `column()`, link helpers, `projectStats()`                                           |
| `skillguide.js` | `LEVELS`, the `TECHNIQUES` library, `nextStep()`, `practiceNext()` and other skill helpers                             |
| `storage.js`    | load, validate, repair, migrate, `save()`, `commit()`, `commitWithUndo()`, backup age                                  |
| `photos.js`     | miniature photos in IndexedDB: open, store, shrink, show, tidy, and their part of backups                              |
| `render.js`     | nav and page switching, dashboard, tables, queue, skills, sorting, deadline markers                                    |
| `forms.js`      | `inputAttrs`, `fieldHtml()`, `openForm()`, `submit()`                                                                  |
| `actions.js`    | delete, add to wishlist, the queue completion prompt, JSON export/import, CSV                                          |
| `app.js`        | mutable state, `db = load()`, event wiring, start-up                                                                   |

- **Only `app.js` runs code at load.** The other files only declare functions and constants, so a function can call anything in any file. Top-level code must only use what earlier files define; for example, `defaults` in `schema.js` calls `id()` from `util.js`.
- **Every top-level name is global.**
  - Declaring a `let` or `const` name twice is a `SyntaxError` that stops the app loading.
  - A second `function` with a name already used is worse: it silently replaces the first.
  - `tests/code.spec.js` fails if two files declare the same top-level name.
- **Mutable state lives in `app.js`:** `db` (all user data), `section` (the current section), `editId` (the record open in the form), plus `undo`, `sort`, `recovered`, `memoryOnly`, `upgraded`, `completing`, `buying`, `editingStages`, `viewing`, `newRewards`, `photoDbOpen`, `photoCheck`, `photoUrls` and `toastTimer`.

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
- **Schema version.** `schemaVersion` is stored with the data. It's currently 5. When stored fields change shape, bump `SCHEMA_VERSION` and add a step to `migrate()`; each step checks the version it starts from. Backups from a newer version are refused.
  - 0 → 1: the version field was added.
  - 1 → 2: each paint's `stock` level is set from its old `remaining` percentage by `stockFromPercent()`. The old `remaining` field stays in the record but is no longer read.
  - 2 → 3: the paint type "Shade" becomes "Shade/Wash".
  - 3 → 4: queue stages became editable (`queueStages`, `queue.stages`). Nothing is converted. The version stops older copies of the app from loading custom stage names they don't know.
  - 4 → 5: miniatures gained `photos`, and backups carry the images in a top-level `photos`. Nothing is converted. The version stops older copies of the app from putting a backup's images into `localStorage`.
- **Saving an upgrade.** When `load()` upgrades saved data from an older schema, it sets `upgraded`, and `app.js` saves once at start-up so storage holds the current schema. Repaired data is not saved until the user changes something, so the damaged original is never replaced first.
- **Missing fields.** Existing records are never rewritten field by field, so every reader must tolerate missing or blank fields.
- **Untrusted values.** Field values in imported data are not checked. Treat them as untrusted.
- **Blocked storage.** If storage is blocked, `memoryOnly` is set: the app works in memory and says nothing is saved.
- **Two tabs.** A `storage` event listener reloads `db` when another tab saves, so two open tabs don't overwrite each other.
- **Photos live in IndexedDB,** not in `db` (see Photos). `localStorage` holds only each miniature's photo ids.
- **Settings outside the data.** The keyboard shortcuts setting is in `localStorage["forgeledger_v2_shortcuts"]`, not in `db` or backups.
- **Backup reminder.** The last export time is kept in `localStorage["forgeledger_v2_last_backup"]`, outside the data. The dashboard warns when there's no backup or the last one is `BACKUP_REMINDER_DAYS` (14) or more days old.

**Backward compatibility.** Users keep and move their data with Export backup and Import, which write and read JSON files. ForgeLedger is open source and runs from a local file, so old backups and existing `localStorage` data must keep loading after any change. Don't rename or repurpose stored fields. Add new fields as optional. A field that is no longer used can stay in old records, as long as nothing reads it.

**Config-driven sections.** `defs` has one entry per collection, in nav order. It drives the nav, page titles, the add/edit form, table columns, the filter dropdown and search. Each entry has:

- `title` and `sub` for the page heading, `nav` if the nav label differs from the title, and `noun` for the form title ("Add paint").
- `swatch` (optional): the key of a colour field to show as a dot beside each record's name in the table, e.g. paints' `colour`. No colour or an invalid one shows a hollow dot.
- `fields`: `{ key, label, type, required, options, atMost, doneWhen, stepper, tones, highFirst }` objects.

  - `atMost` names another field this one can't exceed; for example, painted count can't exceed model count. `submit()` checks it with `setCustomValidity`.
  - `doneWhen(record)` on a `date` field turns on deadline markers for that date (see below). Markers stop once `doneWhen` returns true.
  - `stepper: true` on a `count` field shows it in the table with − and + buttons (see Quick edits).
  - `tones` on a `scale` field colours each option's button when chosen: `good`, `mid`, `bad` or `none`, one per option. `highFirst: true` means the options run from most to least, like paint stock, so sorting reverses them.
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
- `computed`: read-only columns calculated from other data, such as `projectStats()` for projects. A computed column is `{ label, type, value(record), html(record) }`, and `column(d, key)` resolves keys from both `fields` and `computed`. `html` is optional: the table shows it instead of `value`, which search, sorting and CSV still use.
- `filter`: the key of the field the filter dropdown filters on.
  - The dropdown lists the field's `options`. A field without options gets the values currently in use, e.g. project game systems.
  - The choice survives saves and resets when you change section.
- `view`: the section element to show. Collections without one use the shared `#listView` with `renderList()` and `renderTable()`. `queue` and `skills` have their own views and renderers.

To add a field, add it to `fields`, and to `columns` if it should appear in the table.

Search (`searchText()`) matches each field and computed value as displayed, so field names and ids never match, and linked records match by name.

**Sorting.** Column headers are buttons (`data-sort`). Clicking one sorts the visible rows by that column, and clicking it again reverses the order. The sort resets when you change section.

- `sortValue()` compares numeric types (`count`, `money`, `percent`, `level`, and computed numbers) as numbers. `scale` fields sort in option order, reversed for `highFirst` fields, so paint stock's last option (Empty) is lowest. Everything else sorts by its displayed text, ignoring case.
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
- Turn numbers into numbers before printing them, e.g. skill levels go through `skillLevel()`.
- CSV export puts `'` in front of any cell that starts with `=`, `+`, `-` or `@` (plain numbers excepted), so spreadsheets don't run it as a formula.

`tests/security.spec.js` tries each known injection route. Add a case there when you render a new field.

**Accessibility and layout.**

- **Automated accessibility checks.** `tests/accessibility.spec.js` runs axe-core against WCAG 2.1 and 2.2, levels A and AA. It covers every section, the add/edit form, the completion prompt, the Bought prompt, the reward notice, the stage editor, the photo viewer and the keyboard shortcuts list, at desktop and phone sizes. New UI must pass it; seed its data so the new elements appear. It opens the app over HTTP (`SITE` in `tests/helpers.js`), because axe reads the stylesheet, and WebKit blocks a page opened from `file://` from reading other local files.
- **Red backgrounds.** Text on a red background uses `--accent-strong`, not `--accent`. White on `--accent` is under the 4.5:1 contrast minimum.
- **Icon-only buttons** need an `aria-label`, like the queue's "Move … up" arrows.
- **Button sizes.** Row buttons are at least 32px, and 44px on touch screens (`pointer: coarse`). A `pointer: coarse` rule must come after the rule it overrides in `styles.css`: the two selectors are usually equally specific, so the later one wins.
- **Focus.** `:focus-visible` gives every control one blue focus ring. Don't remove outlines.
- **Narrow screens (≤850px):** the sidebar footer's text is hidden, but the "Keyboard shortcuts" button stays, top right beside the brand, so the off switch can be reached with a tablet keyboard.
- **Phones (≤520px):**
  - The nav is a single scrolling row, and `show()` scrolls the current link into view.
  - The page grid uses `minmax(0, 1fr)`, so wide content can't widen the page.
  - `tests/layout.spec.js` checks that every section fits a 375px screen.

**Events.** A single delegated `click` listener on `document` handles nav links (`a[data-sec]`), then dispatches on `data-*` attributes of the clicked `<button>`: `edit`, `del`, `queue`, `next`, `plus`, `top`, `up`, `down`, `recovery`, `wish`, `wishall`, `bought`, `unreward`, `stages`, `photos`, `sort`, `scale`, `step`, `split` and `adv`.

- `edit` and `del` work in every section because they act on the current section.
- To add a new row action, render a button with a new `data-*` attribute and add a branch to this listener.
- Other controls are wired directly in `app.js`.

**Quick edits.** These change a record without opening the form.

- **One-tap buttons (`scale`).** A tap saves the value with `commit()`, then `setScale()` redraws the row and moves focus back to the chosen button.
- **+/− buttons (`stepper`).** `stepCount()` adds or takes 1 with `commit()` and stores the result as a string, like the form does.
  - `stepRange()` sets the limits: never below 0, nor below any field whose `atMost` names this one, nor above this field's own `atMost`. So painted count stays between 0 and model count, and model count can't drop below painted.
  - A button at its limit is disabled. When a press reaches the limit, focus moves to the other button.
  - A blank count shows "–", and + starts it at 1.
- **Redrawing one row.** Both use `redrawRow(record, ...selectors)`. Table rows carry `data-row="<id>"`; `redrawRow` replaces that row and focuses the first selector that matches an enabled control in it. The row doesn't move in a sorted table, and keyboard users keep their place.
- **Quick add.** Each list and the queue have a `.quickadd` form above them: type a name and press Enter. Skills use a picker instead (see Skills). `quickAdd()` clears search and filter so the new record is visible, adds `{ id, name }` with `commitWithUndo`, and keeps focus in the box. `show()` sets the box's placeholder and `aria-label` from the section's `noun`.

**Keyboard shortcuts.** A `keydown` listener in `app.js` handles single keys: N opens the add form, Q focuses quick add (the picker on the skills page), / focuses search, 1 to 8 go to the sections in nav order (`SECTION_KEYS`), and ? opens `#keysDialog`, which lists them.

- They're ignored while a box has focus, with Ctrl, Alt or Cmd, or while any dialog is open.
- WCAG 2.1.4 requires a way to turn single-key shortcuts off. The checkbox in `#keysDialog` does that; the sidebar's "Keyboard shortcuts" button opens the dialog even while they're off.
- The setting is kept in `localStorage["forgeledger_v2_shortcuts"]` (`SHORTCUTS_KEY`), outside the data, so it isn't in backups. Missing means on.

**Skills.** The skills view has its own renderer, `renderSkills()`. Its data and rules are in `skillguide.js`.

- **Levels.** Each level from 0 to 9 has a name and a meaning in `LEVELS`, e.g. 4 is "Competent". Cards show "4/9 · Competent", and the slider's `aria-valuetext` says the same. "What the levels mean" lists them all.
- **Reading levels.** Read a level with `skillLevel()`, which clamps it to 0–9 and treats junk as 0.
- **The technique library.** `TECHNIQUES` has 20 entries. Each has a `name`, an `about` line, and four `next` steps, one per level band: 0–2, 3–4, 5–6 and 7–9.
  - The first ten match the skills a new install starts with.
  - A skill gets its technique by name, ignoring case and outer spaces (`technique()`). Nothing is stored, so renaming a skill unlinks it.
  - `nextStep(skill)` returns the step for the skill's level, or `""` for a skill of your own.
- **Adding skills.** The skills view's quick add is a picker (`#skillAdd`, `addSkill()`). It lists the library techniques you haven't added, plus "Other", which shows a name box.
  - A name you already have, compared like `technique()`, is refused with a toast.
- **The changed date.** `changed` holds the date the level last changed, as `YYYY-MM-DD`.
  - It's set when the slider moves, when the form saves a different level, and when a skill is added.
  - Older skills have no date. Imported dates may be junk. `daysSinceChanged()` returns `NaN` for both, and cards show no date.
- **Moving a slider** commits on every `input` event, then `updateSkillCard()` updates that card's label, next step and date in place. Replacing the card would interrupt the drag.
- **Skill profile.** A meter list: each skill's name, a bar, and its level as text, highest first.
  - The bar is decorative (`aria-hidden`); the text carries the value.
  - The fill is `--blue` on a darker blue track, at 4.9:1.
  - On phones, the bar moves under the name.
- **Practice next.** `practiceNext()` picks up to three skills:
  - skills unchanged for `STALE_DAYS` (30) come first, oldest first;
  - then the lowest levels, in list order;
  - skills at 9 are left out.
  - Each pick shows its reason, plus its next step or, for a skill of your own, your goal.

**Bought.** Each wishlist row has a Bought button (`data-bought`, `bought()`). Whatever happens, the item comes off the wishlist, in one `commitWithUndo` with the rest (`buy()`).

- **Restocks.** An item whose `paint` link points at a paint that still exists sets that paint's `stock` to Full. Quantity and price aren't changed.
- **Paint, Tool and Miniature items** are added to that list (`BOUGHT_TO`), built by `boughtRecord()`:
  - they keep the item's `name`, `price` and `notes`, and an http(s) `url` is added to the notes as "Bought from …";
  - new paints start with quantity 1 and stock Full, tools with quantity 1 and condition New, and miniatures with status Unbuilt.
- **Other categories,** or none, open `#boughtDialog` to ask where the item goes: Paints, Tools, Miniatures, or nowhere.
  - Terrain suggests Miniatures; anything else suggests nowhere.
  - Apply runs on the form's `submit`, like the completion prompt. `buying` holds the item's id and row while the dialog is open.
- **Focus** moves to the Bought button now in the item's place, or the last one, else the quick-add box (`focusBought()`). After the dialog, this happens in its `close` handler, since closing would otherwise return focus to the removed button.

**Photos.** Miniatures can have photos (`photos: true` in `defs.miniatures`). The code is in `photos.js`.

- **Storage.** The images live in IndexedDB: database `forgeledger_photos`, store `photos`, keyed by `id`.
  - Each record is `{ id, type, full, thumb, width, height, added }`. `full` and `thumb` are ArrayBuffers, not Blobs.
  - The miniature's `photos` field holds the ids, in order; the first is the cover. Read it with `photoIds()`, which drops anything that isn't a non-empty string.
- **Where it works.** `photosWork()` checks once, by writing and reading back a tiny record.
  - It works from `file://` and over HTTP in Chromium, Firefox and WebKit. `tests/photos.spec.js` requires it to, and `tests/hosted.spec.js` checks the served copy.
  - Images are ArrayBuffers because WebKit can't store Blobs in IndexedDB from `file://`. A CI probe showed that.
  - Where it fails anyway, for example in a private window or with site data blocked, the viewer shows `#photosUnavailable` and disables Add.
- **Adding.** `photoFromFile()` decodes the file through an `<img>`, which applies EXIF rotation.
  - It shrinks the image to `PHOTO_SIZE` (1600) and `THUMB_SIZE` (320) pixels on the long edge, as JPEG on white.
  - `addPhotoFiles()` stores the images first, then adds the ids with `commitWithUndo`.
  - Files that can't be read (e.g. HEIC on some computers) are named in `#photoStatus`.
- **Showing.** Pages render `<img data-photo="id">` with no `src`; `fillPhotos()` fills them in from IndexedDB.
  - Thumbnail object URLs are cached in `photoUrls`.
  - The viewer's full-size URL is revoked when it changes or the viewer closes.
  - A missing image gets the class `missing`.
- **In the table.** The cover shows beside the name (`coverHtml()`, in `.withthumb`). The row's Photos button shows the count.
- **The viewer** is `#photosDialog`, state `viewing`. It has a large view, a thumbnail strip (`data-pick`), Add photos (`#photoFile`, `accept="image/*"`, which offers the camera on phones), Make cover photo and Remove photo.
- **Removing never deletes the image straight away,** so Undo can restore it. At start-up, `tidyPhotos()` deletes images that no miniature uses and that were added more than `PHOTO_KEEP_MS` (a day) ago.
- **Backups.** Export backup (`backupJson()`) adds a top-level `photos` object: `{ id: { type, full, thumb } }`, with base64 bytes, for the photos the data uses.
  - Import takes `photos` out before `fromBackup()`, so it never reaches `localStorage`, and stores the images first.
  - `photosFromBackup()` skips entries with a type outside `PHOTO_TYPES` or bad base64.
  - If IndexedDB can't be used, the data still imports, and the toast says how many photos couldn't be stored.
- **Toasts in dialogs.** A modal dialog makes the rest of the page inert. So `toast()` moves `#toast` into the open dialog, and a capturing `close` listener in `app.js` moves it back. That's how the viewer's Undo stays clickable.

**Mutation pattern.** Never change `db` and call `save()` directly. Use `commit(() => { /* change db */ })`: it snapshots `db`, applies the change, and saves. If saving fails, it restores the snapshot, shows an error, and returns `false`. Afterwards, call `renderNav()` (nav badges show item counts) and the renderer for the affected view.

**Undo.** `commitWithUndo(change, message)` commits a change and shows `message()` with an Undo button, which restores a copy of `db` from just before the change.

- **Deletes** go through `remove(section, id)`, which uses `commitWithUndo`. There is no confirmation dialog.
- **Unlinking on delete.** Deleting a record clears every `link` field and removes the id from every `links` array that points at it. For example: miniatures in a deleted project, queue items for a deleted miniature, or recipes that used a deleted paint.
- **Undo never reverts later work.** Every `commit()` clears the copy, and so does a change from another tab.

**Queue controls.** `queueItemHtml()` draws each queue item.

- **Next stage.** "Next: <stage>" (`data-next`, `nextStage()`) moves the item to the next of `queueStages()`, with Undo. Reaching Complete opens the completion prompt below.
- **Progress bar.** `role="progressbar"` with one segment per step after "Not started". `stageIndex()` treats blank or unknown stages as Not started.
- **+1 done** (`data-plus`, `plusOneDone()`) counts models done in the item's current stage, with Undo.
  - The count is stored in `stageDone`, and `stageDoneCount()` keeps it between 0 and `queueTotal()`.
  - `queueTotal()` is the item's own model count, else its miniature's, else 1.
  - When the count reaches the total, the item moves to the next stage and the count starts again at 0. Reaching Complete opens the completion prompt.
  - From "Not started", +1 starts the first stage.
  - Next stage and changing the stage in the form also reset the count.
  - +1 doesn't change the miniature's own `painted` count. The completion prompt sets that.
- **Progress bar fill.** Finished stages are full, the current stage is filled as far as its count, and later stages are empty.
- **Reordering.** Top, ↑ and ↓ (`data-top`, `data-up`, `data-down`) go through `moveQueueItem(from, to)`. Dragging the handle (pointer events, in `app.js`) does too.
  - While dragging, the list doesn't change; a `drop-before` or `drop-after` line shows where the item will land, and the move is saved on release. Moving the dragged element would release its pointer capture.
  - The handle has `touch-action: none`, so a finger can drag it without scrolling the page.
- **Focus.** After each action, `refocus()` puts keyboard focus back on the same control of the same item.

**Queue stages.** "Not started" and "Complete" are always the first and last stages, because +1, the completion prompt and due markers depend on them. The stages between them can be edited.

- **The default list** is `db.queueStages`, an optional array of names. Without it, the list is `DEFAULT_STAGES`.
- **An item's own list** is `queue.stages`. An item without one uses the default, and follows later changes to it.
- **Reading stages:**
  - Read an item's stages with `queueStages(q)`; with no item, it gives the default.
  - `ownStages(q)` says whether the item has its own list.
  - `cleanStages()` cleans any stored list. It trims names, cuts them to `MAX_STAGE_NAME` (40) characters, and drops blanks, repeats ignoring case, non-text and the two end names. It keeps at most `MAX_STAGES` (20). A list with nothing usable counts as missing.
- **Items store stage names,** in `stage` and `split`, so stages are matched by name. A name the item's list doesn't have counts as Not started.
- **The stage editor** (`#stagesDialog`, `openStages(qid)`) opens from "Edit default stages" (`#stagesBtn`, `qid` null) or an item's Stages button (`data-stages`).
  - Each row is a name box plus ↑, ↓ and Delete. Each row keeps the name it started with in `data-orig`, so Save can tell a rename from a delete.
  - Moves shift the neighbouring row, so the pressed button stays on the page and keeps focus.
  - The last stage can't be deleted.
- **Saving** (`saveStages()`) checks the names with `setCustomValidity`: not blank, not repeated, not an end name. Any edit clears every row's message, since a repeat involves two rows.
- **`applyStages()`** saves the list, and updates every affected item in one `commitWithUndo`. For the default list, that's every item without its own; otherwise it's the one item.
  - `stageMap()` maps each old stage to its new name. A deleted stage maps to the next stage kept, else the one before, so items move on but never straight to Complete.
  - `remapStages()` applies the map to `stage` and `split`. It resets `stageDone` for items whose stage was deleted, then re-stores split counts in the new order.
- **"Use the default stages"** (`useDefaultStages()`) removes an item's own list. A stage the default lacks maps to the default stage in the same position.
- **Display.** The progress bar has one step per stage after Not started (`grid-auto-flow: column`). The form's Stage dropdown lists the item's stages through the field's `optionsFor`.

**Split by stage.** A queue item's models can be at different stages. The "Split by stage" toggle (`data-split`, `toggleSplit()`) shows on unfinished items with two or more models. It has `aria-pressed`.

- **Stored as `split`:** an optional count per stage name, e.g. `{ Priming: 2, Basecoating: 3 }`. No `split`, or anything that isn't a plain object, means not split.
- **`stage` and `stageDone` stay in step** whenever `storeSplit()` saves: the least advanced stage, and how many models are past it. Code that reads only `stage`, like the dashboard, deadline markers and older versions, still works.
- **Read counts with `splitCounts()`.** It returns one count per stage, adding up to `queueTotal()`.
  - Junk, negative and unknown-stage counts are ignored.
  - If the total has grown, the extra models start at Not started. If it has shrunk, models come off the least advanced stages first.
- **Splitting** (`splitFrom()`) keeps progress: the models done in the current stage start at the next one.
- **Joining** puts every model at the least advanced stage, and counts the rest as done there.
- **Move 1** (`data-adv` and `data-from`, `moveOneOn()`) moves one model to the next stage, with Undo. It's shown for each stage that has models. When the last model reaches Complete, the completion prompt opens.
- **Next and +1 are hidden** while an item is split.
- **The progress bar** fills each step with the share of models past it. For Complete, it's the share at Complete. `aria-valuenow` is the models' average step, and `aria-valuetext` is `splitText()`, e.g. "Priming 2 · Basecoating 3".
- **In the form,** choosing another stage puts every model there, and removes `split`. Otherwise saving re-stores the counts, since the model count may have changed.

**Completing queue items.** When a queue item's stage has just become "Complete" (from the form or the Next button) and the item links to a miniature, `askComplete()` opens `#completeDialog`. It offers two choices:

- mark the miniature complete, with painted count equal to its model count;
- remove the item from the queue.

Apply runs on the dialog form's `submit`, not its `close`, so the change happens during the click.

The form handler `submit()` writes to `db[section]`, so `openForm(sec, obj)` sets `section` before the modal opens. If saving fails, the form stays open so nothing typed is lost.
**Data semantics:**

- `FormData` returns strings, so numbers are stored as strings. Consumers wrap them in `Number(...)`. Only `level` fields are converted (and clamped to 0–9) on save.
- Editing a record merges the form's fields into it (`{ ...record, ...form }`). Fields the form doesn't show are kept, such as a queue item's `stageDone` or fields from older versions.
- Link fields hold a record `id`:

  - `miniatures.project` and `queue.project` point at projects.
  - `queue.miniature` points at a miniature. It's set when a miniature is queued from its row; items queued before this field existed have none.
  - `queue.stageDone` is not a link: it's the number of models done in the item's current stage (see Queue controls). It's optional, and missing means 0.
  - `queue.split` is not a link: it's a count of models per stage name, for an item split by stage (see Split by stage). It's optional.
  - `queue.stages` is not a link: it's an item's own list of stages between Not started and Complete (see Queue stages). It's optional. The default list is the top-level `queueStages`.
  - `miniatures.photos` is not a link: it's an array of photo ids in IndexedDB, cover first (see Photos). It's optional.
  - `miniatures.paints` is a `links` array of the paints in its recipe. The older free-text `recipe` field is still there, labelled "Recipe steps".
  - `skills.changed` is not a link: it's the date the skill's level last changed (see Skills). It's optional.
  - `wishlist.rewardFor` points at the project a reward belongs to, and `wishlist.rewardAt` is the percent it unlocks at (see Rewards).
  - `wishlist.paint` points at the paint a wishlist item restocks. `addToWishlist()` sets it when a low paint is added from the dashboard, and the dashboard uses it to show "On wishlist".

  Older data can still hold links to deleted records; these display blank, and saving the record clears them. Imported `links` values may not be arrays; `asList()` treats anything else as empty.

- Paint stock is `stock`, one of `STOCK_LEVELS`: Full, Good, Half, Low or Empty, or `""` if unknown. A paint is low (`isLow()`) when its stock is Low or Empty. Low recipe paints are flagged in three places:

  - the miniatures table;
  - queue items that aren't complete;
  - the dashboard's stock warnings, which say how many queued miniatures need each low paint.

- `projectStats(p)` calculates a project's `models`, `painted`, `spent`, `goal`, `progress` and `percent` from the miniatures and queue items linked to it. Only `target` and `budget` are entered by hand. Older records may still contain hand-entered `complete` and `spent` fields; these are ignored.
  - `goal` is `target`, or the models owned when `target` is blank.
  - `progress` is counted in models, and includes work in progress:
    - `queueWork(q)` gives a queue item's models each their stage's share of the item's own stages. Not started is 0 and Complete is 1. Models done in the current stage count at the next one, and split items count each model at its stage.
    - A miniature counts the larger of its painted count and its queue items' work, up to its model count, so nothing is counted twice.
    - Queue items linked to the project but to no existing miniature add their work.
  - `percent` is `progress` out of `goal`, rounded down and capped at 100, so 100% means done. The projects table's Progress column and the dashboard bar show it.
  - `projectDone()` is `progress` reaching `goal`.
- **Rewards.** A wishlist item with `rewardFor` (a project link) is a reward. It unlocks when that project's progress reaches `rewardAt` percent; a blank `rewardAt` means 100.
  - `reward(w)` gives `{ project, at, percent, unlocked }`, or null for an item that isn't a reward or whose project is gone. Unlocking compares the exact progress, not the rounded `percent`.
  - The wishlist's Reward column is computed: `rewardText()` for search and sorting, and `rewardHtml()` for the Locked or Unlocked pill.
  - `commit()` notes which rewards are unlocked before a change and after it (`noteRewards()`). Newly unlocked ones join `newRewards`; ones locked again (for example by Undo) leave it.
  - `#rewardNotice` shows `newRewards` on every page, each with Bought (the wishlist's `data-bought`) and Dismiss (`data-unreward`). The list lasts for the session only. Import clears it, since a backup's rewards weren't unlocked just now.
  - The dashboard's Rewards card lists every reward, unlocked first, with Bought on unlocked ones.
- The dashboard's "Recorded spend" adds up `price` across paints, tools, and miniatures. Each `price` is added as entered; it is not multiplied by `quantity`.
- Currency is hardcoded to GBP (`money()` and the "(£)" field labels).
