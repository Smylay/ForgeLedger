// Shared fixtures and helpers. Every test gets a fresh browser context, so
// localStorage starts empty, and fails if the page throws an uncaught error.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const base = require("@playwright/test");

const APP = pathToFileURL(
  path.join(__dirname, "..", "forgeledger_v2.html"),
).href;
// The same app served over HTTP by tests/serve.js (see playwright.config.js).
const SITE = "http://127.0.0.1:4173/";
const KEY = "forgeledger_v2_data";

const test = base.test.extend({
  // Messages of every alert/confirm shown. Dialogs are accepted unless a test
  // sets dialogs.accept = false. Auto, so every test handles dialogs the same
  // way whether or not it asks for this fixture.
  dialogs: [
    async ({ page }, use) => {
      const dialogs = { messages: [], accept: true };
      page.on("dialog", (d) => {
        dialogs.messages.push(d.message());
        dialogs.accept ? d.accept() : d.dismiss();
      });
      await use(dialogs);
    },
    { auto: true },
  ],
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await use(errors);
      base.expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

async function openApp(page) {
  await page.goto(APP);
}

// Replace stored data and reload the app with it.
async function seed(page, data) {
  await page.evaluate(
    ([k, d]) => localStorage.setItem(k, JSON.stringify(d)),
    [KEY, data],
  );
  await page.reload();
}

function stored(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
}

function nav(page, section) {
  return page.click(`#nav a[data-sec="${section}"]`);
}

async function fillForm(page, values) {
  for (const [name, value] of Object.entries(values)) {
    const field = page.locator(`#formFields [name="${name}"]`);
    const tag = await field.evaluate((e) => e.tagName);
    if (tag === "SELECT") await field.selectOption(String(value));
    else await field.fill(String(value));
  }
}

function submitForm(page) {
  return page.click('#itemForm button[type="submit"]');
}

async function addItem(page, section, values) {
  await nav(page, section);
  await page.click("#addBtn");
  await fillForm(page, values);
  await submitForm(page);
}

function modalOpen(page) {
  return page.evaluate(() => document.querySelector("#modal").open);
}

function tableRows(page) {
  return page.locator("#content tbody tr");
}

// Click a button that triggers a download and return the file's text.
async function downloadText(page, selector) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click(selector),
  ]);
  return fs.readFileSync(await download.path(), "utf8");
}

// Import a backup through the file input. `content` is an object (sent as
// JSON) or a raw string.
async function importBackup(page, content, testInfo, name = "backup.json") {
  const file = testInfo.outputPath(name);
  fs.writeFileSync(
    file,
    typeof content === "string" ? content : JSON.stringify(content),
  );
  await page.setInputFiles("#importFile", file);
}

module.exports = {
  test,
  expect: base.expect,
  APP,
  SITE,
  KEY,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  addItem,
  modalOpen,
  tableRows,
  downloadText,
  importBackup,
};
