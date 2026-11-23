# ForgeLedger

ForgeLedger is an offline-first tracker for miniature wargaming. It keeps your paints, tools, miniatures, army projects, painting queue, painting skills and wishlist in one place. It runs entirely in your browser, with no account, no install and no server required.

## Features

- **Paints** with brand, range, colour and type (including Primer and Shade/Wash), and a stock level (Full, Good, Half, Low or Empty) that you set with one tap. Low stock shows on the dashboard, with one-click restock to the wishlist.
- **Miniatures** with model and painted counts, status, army project, and recipes built from your own paints.
- **Tools** with a condition, from New to Replace soon.
- **Army projects** whose progress and spend are calculated from their miniatures, with overdue and due-soon markers.
- **A painting queue** linked to your miniatures. Each item has a stage progress bar, a one-tap Next stage button, and a +1 counter for the current stage that moves the item on once every model is done. Reorder it by dragging, or with the Top and arrow buttons. Completing an item can mark its miniature complete.
- **Painting skills** rated 0–9, with a name for each level (4 is Competent). Pick from a library of 20 techniques, each with a next step for your level, or add your own. A skill profile shows every level at a glance, and Practice next suggests what to work on: skills you haven't updated in a month, then your lowest.
- **A wishlist** with priorities, prices and product links.
- **Quick edits without the form:** one-tap stock, status, condition and priority; + and − buttons on paint quantities, model counts and painted counts; and a quick-add box on every page: type a name and press Enter.
- **Keyboard shortcuts:** N to add, Q to quick-add, / to search, and 1 to 8 to change page. Press ? for the list, which also turns them off.
- **Search, filters and sortable columns** in every list, and Undo for deletes.
- **JSON backup and restore**, and CSV export of any list.

## Quick start

1. Download this repository (**Code > Download ZIP**) and unzip it, or clone it.
2. Double-click `index.html` to open it in your browser.

You don't need to install anything, build anything, or be online.

## Your data

ForgeLedger saves your data automatically in your browser's local storage. Nothing is sent anywhere.

- **Data belongs to one browser on one device.** A different browser, a different device, a private window, or the same app opened from a different address (for example, from your home server instead of a double-clicked file) starts empty.
- **Clearing your browser's site data deletes it.**
- **Back up regularly with Export backup.** It downloads a JSON file that you can restore with **Import** in any browser. The dashboard reminds you when your last backup is more than 14 days old.
- **Importing replaces everything.** ForgeLedger asks first and downloads a copy of your current data before replacing it.

## Hosting on your own server

ForgeLedger is a set of static files, so any web server can host it. The server stores nothing. Each visitor's data stays in their own browser, as described in [Your data](#your-data).

The app needs only `index.html`, `forgeledger_v2.html`, `styles.css` and the `js` folder. You can serve the whole repository folder, or just those files. Use any one of the options below, then open `http://<server-address>:8080/`.

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

- **Make the tests and the format check pass**, and add tests for what you change.
- **Keep the app runnable by double-clicking `index.html`.** Browsers block ES modules and service workers from local files, so don't introduce modules, a bundler or a service worker.
- **Keep old data loading.** People restore backups made by older versions, so don't rename or repurpose stored fields. Add new fields as optional.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Licence

ForgeLedger is released under the MIT licence. See [LICENSE](LICENSE).
