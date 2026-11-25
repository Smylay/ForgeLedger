# Changelog

What changed in each version of ForgeLedger. Backups from every earlier version still import.

## Unreleased

- **The painting queue keeps each miniature's status up to date:** Built once its models are past building, Primed once they're past priming, and In progress once painting has started. Models reaching Complete raise its painted count. It only ever moves forward, and Undo puts both back.
- **Restocks count in Recorded spend.** Bought on a wishlist item that restocks a paint records the pot's price with the paint, and the paint's form lists its restocks, records one you bought elsewhere, or removes one. The dashboard says how much went on restocks. A paint you'd planned but never owned takes the price as its own instead.
- **A damaged or hostile backup can't stop a page drawing:** values ForgeLedger can't turn into text are dropped when data is read.

## 1.1.0 – 2026-11-25

A paint catalogue, colour themes, a painting queue you can step back through and that starts from each miniature's progress, and skills that know their difficulty and tools. Backups from 1.0.0 import as before, and nothing you've saved changes.

### Paints

- **A paint catalogue** of about 5,300 paints from 16 brands. In the paint form, find a paint by name or code, and its brand, range, type and colour fill in. Quick add on the paints page picks from it too.
- **Two Thin Coats Dark Arts** in the paint catalogue (30 paints, names only; no colours have been published).
- **Dirty Down** in the paint catalogue: 6 effects, such as Rust, Moss and Gore, and 10 ageing sprays (names only; no colours have been published).
- **Plan a recipe with paints you don't own yet,** from your wishlist or the catalogue. Saving adds them to your paints as Empty, with a quantity of 0, and to your wishlist, so Bought restocks them.
- **More paint types:** Standard, Glaze, Dry, Air and Effect, to match the catalogue.
- **"Used in" on paints:** how many miniatures' recipes use each paint, and which ones.

### Painting queue

- **Queueing a miniature starts where it is:** a Built miniature starts after Building, a Primed or In progress one after Priming, and painted models count as Complete, so a part-painted unit is split by stage. Undo takes it off again.
- **Go back in the painting queue** when an item's been taken too far: Back returns to the previous stage, −1 takes back a +1, and split items have Back 1 for each stage. Complete items can go back too.
- **Queue buttons sit under each item's progress bar,** so the details have room.

### Skills

- **Skills have a difficulty,** Easy, Medium, Hard or Expert, and Practice next suggests easier techniques first.
- **Techniques show the tools they need,** whether you have them, and Add to wishlist and Bought buttons for ones you don't.

### Everywhere

- **Colour themes:** Forest, Ocean and Amethyst (dark green, blue and purple) and Parchment (light and warm), in Settings alongside Dark and Light. Each is checked for contrast.
- **Each list opens sorted** so what needs attention comes first: paints by lowest stock, tools by worst condition, miniatures by least finished, projects by soonest target date, the wishlist by highest priority. Click a column header to sort another way.
- **Suggestions as you type** in the brand, range, faction and game system boxes: what you've entered before, most used first, then common brands and game systems. Range suggestions follow the brand. You can still type anything.
- **Tools and miniatures have a Brand,** with their own suggestions.
- **Rewards on the projects page:** each project shows its rewards under its name, with an Add reward button.
- **"Quick add"** is now the name of the button beside each quick-add box, so it's clearly different from "Add item".
- **The example data's paint ranges** are now product lines, instead of repeating the type.

### Downloads and code

- **Downloads hold just the app:** a release's Source code zip, and Code > Download ZIP, leave out the tests, build tools and developer notes.
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
