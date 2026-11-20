# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ForgeLedger is an offline-first, single-page tracker for miniature wargaming: paints, tools, miniatures, army projects, a painting queue, painting-skill levels, and a wishlist. It is plain HTML/CSS/JS with no framework, no dependencies, no build step, and no backend. All data lives in the browser's `localStorage`.

## Running and verifying

- **Run:** open `forgeledger_v2.html` in a browser. It works over `file://`. You can also serve it with `python3 -m http.server` and open `/forgeledger_v2.html`.
- **localStorage is scoped to the origin.** Data saved under `file://` does not appear under `http://localhost:8000`, and data saved under one port does not appear under another. If saved data seems to be missing, check the origin first.
- **No package.json, linter, formatter config, or test suite exists.** To verify a change, drive the page with Playwright against the `file://` URL and listen for `pageerror`. Clear `localStorage` between runs, or use a fresh browser context.
- **Formatting:** the code is Prettier-style (double quotes, trailing commas, wide lines). The 8-space base indent in `main.js` and `styles.css` is left over from when both were inline in the HTML. Match the existing style in any file you edit.

## Architecture (`main.js`)

All code is inside one IIFE. There are no modules and no exports. Mutable state is held in three variables: `db` (all user data), `section` (current nav key), and `editId` (the record open in the modal, if any).

**Persistence.** `save()` serializes the whole `db` to `localStorage["forgeledger_v2_data"]`. `load()` and `importJSON()` shallow-merge stored data onto `defaults` with `Object.assign(structuredClone(defaults), stored)`. As a result:
- To add a new top-level collection, add it to `defaults`. Existing users pick it up automatically.
- Nothing migrates fields on existing records. Every reader must tolerate missing or blank fields.
- Imported JSON is not validated beyond "is an object". Treat imported data as untrusted.

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

**Rendering.** Every renderer rebuilds its container with template-literal `innerHTML`. Escape every user-supplied value with `esc()`, including values placed in attributes and `style`. Imported backups can contain arbitrary strings.

**Events.** A single delegated `click` listener on `document` dispatches on `data-*` attributes of the clicked `<button>`: `sec`, `edit`, `del`, `queue`, `editq`, `delq`, `edits`, `dels`, `up`, and `down`. To add a new row action, render a button with a new `data-*` attribute and add a branch to this listener. Other controls are wired directly at the bottom of the IIFE.

**Mutation pattern.** Change `db`, then call `save()`, then `renderNav()` (nav badges show item counts), then the renderer for the affected view. The form handler `submit()` writes to `db[section]`, so `openForm(sec, obj)` sets `section` before the modal opens.

**Data semantics:**
- `FormData` returns strings, so numbers are stored as strings. Consumers wrap them in `Number(...)`. Only `skills.level` is converted (and clamped to 0–9) on save.
- Editing a record replaces the whole object with the form's contents.
- `miniatures.project` and `queue.project` hold a project `id`. Deleting a project doesn't cascade to them; tables fall back to showing the raw id.
- Project progress (`complete` / `target`) and `spent` are entered by hand. They are not derived from linked miniatures.
- The dashboard's "Recorded spend" adds `price` across paints, tools, and miniatures, then adds `spent` across projects.
- Currency is hardcoded to GBP (`money()` and the "(£)" field labels).
