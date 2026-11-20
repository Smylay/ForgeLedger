# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForgeLedger is an offline-first, single-page tracker for miniature wargaming: paints, tools, miniatures, army projects, a painting queue, painting-skill levels, and a wishlist. The app is plain HTML/CSS/JS with no framework, no runtime dependencies, no build step, and no backend. All data lives in the browser's `localStorage`. `package.json` holds development tools only.

Keep it runnable from `file://`. Browsers refuse to load ES module scripts from `file://`, and service workers don't work there, so don't introduce modules, a bundler, or a service worker unless the project moves to hosting.

## Running and verifying

- **Run:** open `forgeledger_v2.html` in a browser. It works over `file://`. You can also serve it with `python3 -m http.server` and open `/forgeledger_v2.html`.
- **localStorage is scoped to the origin.** Data saved under `file://` does not appear under `http://localhost:8000`, and data saved under one port does not appear under another. If saved data seems to be missing, check the origin first.
- **Setup:** `npm install`, then `npx playwright install chromium` once. Only the tests and formatter need this; the app doesn't.
- **Tests:** `npm test` runs the Playwright suite in `tests/` against the `file://` page.
  - One file: `npx playwright test tests/app.spec.js`. One test by name: `npx playwright test -g "low-stock"`.
  - Each test gets a fresh browser context, so `localStorage` starts empty.
  - The auto `pageErrors` fixture in `tests/helpers.js` fails any test where the page throws an uncaught error.
  - Import `test` and `expect` from `./helpers`, not from `@playwright/test`, so the fixtures apply. `helpers.js` also has helpers for seeding data, filling forms, downloads, and imports.
- **Formatting:** Prettier, configured in `.prettierrc`: 2-space indent, 80-column lines, and 120 columns for HTML. Run `npm run format` to format or `npm run format:check` to check. Format before committing.

## Architecture (`main.js`)

All code is inside one IIFE. There are no modules and no exports. Mutable state is held in three variables: `db` (all user data), `section` (current nav key), and `editId` (the record open in the modal, if any).

**Persistence.** `save()` serializes the whole `db` to `localStorage["forgeledger_v2_data"]`.

- **Loading and importing.** Both go through `fromBackup()`: `fillIds()` gives every record a unique string id, `migrate()` upgrades the schema, then the data is shallow-merged onto `defaults`.
- **Adding a collection.** To add a top-level collection, add it to both `defaults` and `COLLECTIONS`.
- **Shape checks.** `problemWith()` checks the data's shape:
  - An import with a problem is rejected whole.
  - Saved data with a problem is repaired with `repair()`. The original string is copied to a `forgeledger_v2_recovered_<ISO time>` key first, and `#alerts` offers a download.
- **Replacing data on import.** When the app already has data, the user must confirm, and the current data is downloaded first.
- **Schema version.** `schemaVersion` is stored with the data. When stored fields change shape, bump `SCHEMA_VERSION` and add a step to `migrate()`. Backups from a newer version are refused.
- **Missing fields.** Existing records are never rewritten field by field, so every reader must tolerate missing or blank fields.
- **Untrusted values.** Field values in imported data are not checked. Treat them as untrusted.
- **Blocked storage.** If storage is blocked, `memoryOnly` is set: the app works in memory and says nothing is saved.
- **Two tabs.** A `storage` event listener reloads `db` when another tab saves, so two open tabs don't overwrite each other.
- **Backup reminder.** The last export time is kept in `localStorage["forgeledger_v2_last_backup"]`, outside the data. The dashboard warns when there's no backup or the last one is `BACKUP_REMINDER_DAYS` (14) or more days old.

**Backward compatibility.** Users keep and move their data with Export backup and Import, which write and read JSON files. ForgeLedger is open source and runs from a local file, so old backups and existing `localStorage` data must keep loading after any change. Don't rename or repurpose stored fields. Add new fields as optional. A field that is no longer used can stay in old records, as long as nothing reads it.

**Schema-driven CRUD.** `defs` maps the collections `paints`, `tools`, `miniatures`, `projects`, and `wishlist` to a title, a subtitle, and a `fields` array. Each field is a tuple: `[key, label, inputType, extra]`.

- `extra === 1` marks a text, number, or date field as required.
- For `select`, `extra` is the array of options, so a select can't currently be marked required.
- The `project` input type renders a `<select>` of `db.projects`, stores the project's `id`, and is shown by name in tables.

All five `defs` collections share the single `#listView` section and the generic `renderList()` and `renderTable()` renderers.

**Not everything is driven by `defs`.** Some per-collection configuration is hardcoded:

- `queue` and `skills` are not in `defs`. Their form fields are defined inline in `openForm()`, and they have their own views and renderers (`renderQueue()` and `renderSkills()`).
- Table columns per collection are hardcoded in `renderTable()`, so adding a field to `defs` does not add a column.
- Filter dropdown options per collection are hardcoded in `renderList()`.
- The nav order and labels live in `navItems`. View titles for the dashboard, queue, and skills are hardcoded in `go()`.

**Rendering.** Every renderer rebuilds its container with template-literal `innerHTML`. Imported backups can contain arbitrary strings, so:

- Escape every stored value with `esc()`, including ids in `data-*` attributes and `<option value>`.
- Put a colour into `style` only through `safeColour()`, which accepts hex codes only.
- Render a link only from `safeUrl()`, which accepts http(s) only.
- Turn numbers into numbers before printing them, e.g. skill levels are clamped with `Number()`.
- CSV export puts `'` in front of any cell that starts with `=`, `+`, `-` or `@` (plain numbers excepted), so spreadsheets don't run it as a formula.

`tests/security.spec.js` tries each known injection route. Add a case there when you render a new field.

**Events.** A single delegated `click` listener on `document` dispatches on `data-*` attributes of the clicked `<button>`: `sec`, `edit`, `del`, `queue`, `editq`, `delq`, `edits`, `dels`, `up`, and `down`. To add a new row action, render a button with a new `data-*` attribute and add a branch to this listener. Other controls are wired directly at the bottom of the IIFE.

**Mutation pattern.** Never change `db` and call `save()` directly. Use `commit(() => { /* change db */ })`: it snapshots `db`, applies the change, and saves. If saving fails, it restores the snapshot, shows an error, and returns `false`. Afterwards, call `renderNav()` (nav badges show item counts) and the renderer for the affected view.

The form handler `submit()` writes to `db[section]`, so `openForm(sec, obj)` sets `section` before the modal opens. If saving fails, the form stays open so nothing typed is lost.

Functions that `load()` calls must be function declarations, not `const` arrows: `load()` runs while `db` is being initialised, before later `const` lines have run.

**Data semantics:**

- `FormData` returns strings, so numbers are stored as strings. Consumers wrap them in `Number(...)`. Only `skills.level` is converted (and clamped to 0–9) on save.
- Editing a record replaces the whole object with the form's contents.
- `miniatures.project` and `queue.project` hold a project `id`. Deleting a project doesn't cascade to them; tables fall back to showing the raw id.
- `projectStats(p)` calculates a project's `models`, `painted`, and `spent` from the miniatures linked to it. Only `target` and `budget` are entered by hand. If `target` is blank, progress is measured against models owned. Older records may still contain hand-entered `complete` and `spent` fields; these are ignored.
- The dashboard's "Recorded spend" adds up `price` across paints, tools, and miniatures. Each `price` is added as entered; it is not multiplied by `quantity`.
- Currency is hardcoded to GBP (`money()` and the "(£)" field labels).
