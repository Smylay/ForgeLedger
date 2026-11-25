// What a download holds. Release "Source code" downloads and Code > Download
// ZIP are built by `git archive`, which leaves out what .gitattributes marks
// export-ignore. These tests build the same archive from HEAD, with the
// working copy's .gitattributes, and check it holds just the app, and that
// the app runs from it.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { pathToFileURL } = require("url");
const { test, expect } = require("./helpers");

const ROOT = path.join(__dirname, "..");

// Everything a download may hold: the app, its example backup, and the
// user docs and licences. Anything else needs a reason to be here.
const ALLOWED = [
  /^index\.html$/,
  /^forgeledger_v2\.html$/,
  /^styles\.css$/,
  /^js\/[\w-]+\.js$/,
  /^data\/paint-catalogue\.js$/,
  /^data\/sources\/(README\.md|LICENSE-miniature-paints\.txt)$/,
  /^examples\/forgeledger-example\.json$/,
  /^(README|CHANGELOG)\.md$/,
  /^LICENSE$/,
];

let dir, files;
test.beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgeledger-download-"));
  execSync(`git archive --worktree-attributes HEAD | tar -x -C "${dir}"`, {
    cwd: ROOT,
  });
  const walk = (d) =>
    fs
      .readdirSync(path.join(dir, d), { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory()
          ? walk(path.join(d, e.name))
          : [path.join(d, e.name).split(path.sep).join("/")],
      );
  files = walk("");
});
test.afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test("a download holds only the app, its docs and licences", () => {
  expect(files.filter((f) => !ALLOWED.some((r) => r.test(f)))).toEqual([]);
  // And none of the developer files.
  for (const f of ["tests/helpers.js", "package.json", "CLAUDE.md"])
    expect(files).not.toContain(f);
  expect(files).not.toContain("ForgeLedger Bugs.txt");
});

test("every file the app loads is in a download", () => {
  const html = fs.readFileSync(path.join(ROOT, "forgeledger_v2.html"), "utf8");
  const local = [
    ...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter((u) => !/^(https?:|data:|#)/.test(u));
  expect(local.length).toBeGreaterThan(10);
  // The paint catalogue is loaded when it's first needed (catalogue.js).
  for (const f of [...local, "data/paint-catalogue.js", "index.html"])
    expect(files, f).toContain(f);
  // Every script in js/ is a file the page loads.
  for (const f of files.filter((f) => f.startsWith("js/")))
    expect(local, f).toContain(f);
});

test("the app runs from a download", async ({ page }) => {
  await page.goto(pathToFileURL(path.join(dir, "index.html")).href);
  await page.waitForURL(/forgeledger_v2\.html/);
  await page.getByRole("button", { name: "Load example data" }).click();
  await expect(page.locator("#toastText")).toHaveText("Example data loaded");
  // The catalogue, loaded on first use, is there too.
  await page.click('a[data-sec="paints"]');
  await page.click("#addBtn");
  await page.fill("#catalogueFind", "nuln oil");
  await expect(page.locator("#catalogueList option").first()).toHaveAttribute(
    "value",
    "Nuln Oil · Citadel Shade",
  );
});
