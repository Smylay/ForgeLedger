# Changelog

What changed in each version of ForgeLedger. Backups from every earlier version still import.

## Unreleased

- **How to update** without losing data, in the README.
- **The code is reorganised by feature** (the queue, the stage editor, the wishlist, skills, Settings, backups), so each part is easier to find and change. Nothing changes in how the app works.

## 1.0.0 – 2026-11-23

The first numbered release. Earlier copies of the app had no version number; the `v2` in `forgeledger_v2.html` was never a version, and the file keeps that name so saved data stays where it is.

### New in 1.0

- **Settings**, from the sidebar: theme, currency, auto-save, keyboard shortcuts and Erase all data.
- **A light theme,** or one that matches your device's setting. Dark stays the default.
- **A currency setting.** Prices were always shown in pounds; you can now choose from 12 currencies. Amounts aren't converted.
- **Auto-save to a file** in Chrome, Edge and other Chromium-based browsers: choose a file once, and a full backup, photos included, is written to it after every change.
- **Erase all data,** which downloads a backup first.
- **Backups record the app version** that made them. Importing an older one says which version made it, and one from a newer version is refused with its version named.
- **The miniatures table fits a 1280px laptop screen** without scrolling sideways. Row buttons wrap when space is short, and the sidebar is narrower on laptops.

### Everything in 1.0

- **Paints** with brand, range, colour, type and a one-tap stock level. Low stock shows on the dashboard and goes to the wishlist in one click.
- **Miniatures** with model and painted counts, status, project, recipes from your own paints, and photos kept on your device.
- **Tools** with a condition.
- **Army projects** whose progress counts work in progress, with spend, budgets and deadline markers.
- **A painting queue** linked to miniatures: stage progress bars, Next stage, a +1 counter, items split by stage, editable stages (for the whole queue or one item), and drag to reorder.
- **Painting skills** rated 0–9, a library of 20 techniques with a next step for each level, a skill profile and practice suggestions.
- **A wishlist** with priorities, prices, links, a Bought button, and rewards that unlock at a project percentage.
- **Quick edits:** one-tap levels, +/− buttons, quick add on every page, and keyboard shortcuts with an off switch.
- **Search, filters, sortable columns and Undo** in every list.
- **Your data stays in your browser,** with JSON backups (photos included), CSV export, a backup reminder, checks on imports, recovery of damaged data, and two open tabs kept in step.
- **Example data** to try every feature, from the empty dashboard or `examples/forgeledger-example.json`.
- **Runs from a double-clicked file** or any static web server, in Chrome, Edge, Firefox and Safari, on desktops and phones. Tested in Chromium, Firefox and WebKit, including automated WCAG 2.2 AA accessibility checks.
