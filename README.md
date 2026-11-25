# ForgeLedger

ForgeLedger is an offline-first tracker for miniature wargaming. It keeps your paints, tools, miniatures, army projects, painting queue, painting skills and wishlist in one place. It runs entirely in your browser, with no account, no install and no server required.

## Features

- **A paint catalogue** of about 5,300 paints from 16 brands: find one by name or code, and its brand, range, type and colour fill in. Quick add on the paints page picks from it too.
- **Paints** with brand, range, colour and type (including Primer and Shade/Wash), and a stock level (Full, Good, Half, Low or Empty) that you set with one tap. Low stock shows on the dashboard, with one-click restock to the wishlist. "Used in" lists the miniatures whose recipe uses a paint.
- **Miniatures** with model and painted counts, status, army project, recipes built from your paints, and photos from your computer or phone camera. Plan a recipe with paints you don't own yet, from your wishlist or the catalogue, and they go on your wishlist.
- **Tools** with a condition, from New to Replace soon.
- **Army projects** whose progress and spend are calculated from their miniatures, with overdue and due-soon markers. Progress counts work in progress: a model halfway through its painting stages counts as half done. Each project shows its rewards, and you can add one from there.
- **A painting queue** linked to your miniatures. Each item has a stage progress bar, a one-tap Next stage button, and a +1 counter for the current stage that moves the item on once every model is done. Split an item by stage when its models are at different points, such as 2 priming and 3 basecoating. Rename, reorder, add or remove the stages for the whole queue, or give one item stages of its own. Reorder it by dragging, or with the Top and arrow buttons. Completing an item can mark its miniature complete.
- **Painting skills** rated 0–9, with a name for each level (4 is Competent). Pick from a library of 20 techniques, each with a difficulty (Easy to Expert), the tools it needs and a next step for your level, or add your own. A technique's card says whether you have its tools, with Add to wishlist and Bought. A skill profile shows every level at a glance, and Practice next suggests what to work on: skills you haven't updated in a month, then easier and lower ones.
- **A wishlist** with priorities, prices and product links. Make an item a reward that unlocks when a project reaches a percentage you choose. Tap Bought to restock a paint, or to move the item into your paints, tools or miniatures.
- **Suggestions as you type** for brands, paint ranges, factions and game systems: the ones you've used, then common ones. You can still type anything.
- **Quick edits without the form:** one-tap stock, status, condition and priority; + and − buttons on paint quantities, model counts and painted counts; and a quick-add box on every page: type a name and press Enter.
- **Keyboard shortcuts:** N to add, Q to quick-add, / to search, and 1 to 8 to change page. Press ? for the list, which also turns them off.
- **Search, filters and sortable columns** in every list, and Undo for deletes. Each list opens with what needs attention first: lowest paint stock, worst tool condition, least finished miniatures, soonest project deadline, highest wishlist priority.
- **JSON backup and restore**, CSV export of any list, and auto-save to a backup file in Chrome and Edge.
- **Settings** for a dark or light theme (or match your device), the currency prices are shown in, auto-save, keyboard shortcuts, and erasing all your data.

## Quick start

1. Download this repository (**Code > Download ZIP**) and unzip it, or clone it.
2. Double-click `index.html` to open it in your browser.

You don't need to install anything, build anything, or be online.

**Want a tour first?** On the empty dashboard, choose **Load example data**. It fills every section with made-up paints, miniatures, projects, a painting queue, skills and a wishlist, so you can try every feature. Clear it with **Clear it and start fresh** when you're ready to add your own. The same data is in `examples/forgeledger-example.json`, which you can load with **Import** at any time.

## Your data

ForgeLedger saves your data automatically in your browser's local storage. Nothing is sent anywhere.

- **Data belongs to one browser on one device.** A different browser, a different device, a private window, or the same app opened from a different address (for example, from your home server instead of a double-clicked file) starts empty.
- **Clearing your browser's site data deletes it.**
- **Back up regularly with Export backup.** It downloads a JSON file that you can restore with **Import** in any browser. The dashboard reminds you when your last backup is more than 14 days old.
- **Importing replaces everything.** ForgeLedger asks first and downloads a copy of your current data before replacing it.
- **Photos stay on your device too.** They're shrunk to about 1600 pixels and kept in the browser's own storage (IndexedDB), and Export backup includes them, so backups grow by roughly 0.3MB a photo.
- **Photos work in Chrome, Edge, Firefox and Safari,** whether you double-click the file or host it. They're tested in each browser's engine; a private window may not keep them.
- **Auto-save to a file (Chrome, Edge and other Chromium-based browsers).** In **Settings**, choose a file once, for example in a folder your cloud storage syncs. After every change, ForgeLedger writes a full backup to it, photos included, and that counts as your latest backup. After you restart the browser it asks for permission again: open Settings and choose **Resume auto-saving**. Firefox and Safari can't save to a file you picked, so use Export backup there.
- **Erase all data** in Settings deletes everything in this browser, photos included. It downloads a backup first and stops auto-saving, so the auto-save file keeps your data.

## Updating ForgeLedger

Your data is kept by your browser, not in ForgeLedger's files, so replacing the files doesn't touch it. To update:

1. **Export a backup first** (**Export backup**, top right). It's your safety net.
2. **Download the new version** from [Releases](https://github.com/Smylay/ForgeLedger/releases) (**Source code (zip)**).
3. **Unzip it over your current copy, in the same folder,** replacing the old files. Then open `index.html` as before.

Keep it in the same folder. Chrome and Edge find your data wherever the files are, but Firefox and Safari may keep a local file's data with its folder, so a copy somewhere else can open empty. If that happens, **Import** the backup from step 1. A hosted copy keeps its data as long as its address stays the same.

Backups from older versions always import into newer ones. A backup made by a newer version won't import into an older one, so update before importing it.

## Settings

Open **Settings** at the bottom of the sidebar (top right on phones and tablets).

- **Theme:** Dark, Light, or Match my device. It's kept in this browser only, not in backups.
- **Currency:** how prices are shown, for example €4.50 or 4,50 kr. Amounts aren't converted. The currency is saved with your data, so it's in your backups.
- **Auto-save to a file,** **keyboard shortcuts** and **Erase all data,** as described above.

The version (1.0.0) is shown in the sidebar and in Settings. Backups record the version that made them. A backup made by a newer version than yours is refused, so update first. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

## Hosting on your own server

ForgeLedger is a set of static files, so any web server can host it. The server stores nothing. Each visitor's data stays in their own browser, as described in [Your data](#your-data).

The app needs only `index.html`, `forgeledger_v2.html`, `styles.css`, the `js` folder and `data/paint-catalogue.js`. You can serve the whole repository folder, or just those files. Use any one of the options below, then open `http://<server-address>:8080/`.

- **Python**, for quick use on your home network:

  ```sh
  cd ForgeLedger
  python3 -m http.server 8080
  ```

  Python's built-in server is meant for local use. Don't expose it to the internet.

- **Docker with nginx:**

  ```sh
  docker run -d --name forgeledger --restart unless-stopped \
    -p 8080:80 -v /path/to/ForgeLedger:/usr/share/nginx/html:ro nginx:alpine
  ```

- **Caddy**, with this `Caddyfile`:

  ```
  :8080 {
  	root * /path/to/ForgeLedger
  	file_server
  }
  ```

Things to know:

- **The hosted copy has its own data,** separate from any copy you open by double-clicking. To move data between them, use **Export backup** in one and **Import** in the other.
- **To reach it from outside your home network,** put it behind HTTPS, for example with a reverse proxy such as Caddy, which obtains certificates automatically. The app has no login. It doesn't need one to protect your data, because the server holds none. However, anyone who has the address can use the app.

## Development

ForgeLedger is plain HTML, CSS and JavaScript, with no framework and no build step. `package.json` lists development tools only: Playwright for tests and Prettier for formatting. You need [Node.js](https://nodejs.org/); CI uses version 22.

```sh
npm install
npx playwright install chromium
npm test
```

- `npm test` runs the test suite in Chromium.
- `npm run test:all` runs it in Chromium, Firefox and WebKit. First run `npx playwright install firefox webkit`.
- `npm run format` formats the code with Prettier, and `npm run format:check` checks it.

GitHub Actions runs the tests in all three browsers, plus the format check, on every push and pull request.

[CLAUDE.md](CLAUDE.md) describes the architecture: how data is stored and migrated, how sections are configured, and the rules for rendering untrusted data.

## Contributing

Pull requests are welcome. Before you open one:

- **Open it against the `dev` branch.** `main` only gets releases, merged from `dev`.
- **Make the tests and the format check pass**, and add tests for what you change.
- **Keep the app runnable by double-clicking `index.html`.** Browsers block ES modules and service workers from local files, so don't introduce modules, a bundler or a service worker.
- **Keep old data loading.** People restore backups made by older versions, so don't rename or repurpose stored fields. Add new fields as optional.
- **Add your change to [CHANGELOG.md](CHANGELOG.md)** under Unreleased.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Credits

The paint catalogue comes from [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints) (MIT licence) and, for Citadel, [SimoGecko/CitadelColours](https://github.com/SimoGecko/CitadelColours). See [data/sources/README.md](data/sources/README.md). Its colours are approximations.

## Licence

ForgeLedger is released under the MIT licence. See [LICENSE](LICENSE).
