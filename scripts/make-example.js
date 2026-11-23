// Writes examples/forgeledger-example.json, the example data as a backup
// you can Import. Run with `npm run example` after changing js/demo.js;
// tests/demo.spec.js fails while the file is out of date.
//
// It opens the app in Chromium (Playwright, already a dev dependency) so
// the data and photos come from the app's own code.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const root = path.join(__dirname, "..");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.join(root, "forgeledger_v2.html"));
  const backup = await page.evaluate(async () => {
    const [y, m, d] = DEMO_FILE_DATE.split("-").map(Number);
    const photos = {};
    for (const p of demoPhotos())
      photos[p.id] = {
        type: p.type,
        full: toBase64(p.full),
        thumb: toBase64(p.thumb),
      };
    return { ...demoData(new Date(y, m - 1, d)), photos };
  });
  await browser.close();
  const out = path.join(root, "examples", "forgeledger-example.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // Formatted as the repository's Prettier check expects.
  const prettier = require("prettier");
  fs.writeFileSync(
    out,
    await prettier.format(JSON.stringify(backup), { filepath: out }),
  );
  console.log("Wrote " + path.relative(root, out));
})();
