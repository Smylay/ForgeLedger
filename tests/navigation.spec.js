const path = require("path");
const { pathToFileURL } = require("url");
const {
  test,
  expect,
  APP,
  openApp,
  seed,
  nav,
  modalOpen,
} = require("./helpers");

const INDEX = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

test("each section has its own address and page title", async ({ page }) => {
  await openApp(page);
  await nav(page, "paints");
  expect(new URL(page.url()).hash).toBe("#/paints");
  await expect(page).toHaveTitle("Paints · ForgeLedger");
  await expect(page.locator('#nav a[data-sec="paints"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.locator('#nav a[data-sec="dashboard"]'),
  ).not.toHaveAttribute("aria-current", "page");
});

test("opening an address shows that section", async ({ page }) => {
  await page.goto(APP + "#/queue");
  await expect(page.locator("#title")).toHaveText("Painting queue");
  await expect(page.locator("#queueView")).toBeVisible();
});

test("back and forward move between sections", async ({ page }) => {
  await openApp(page);
  await nav(page, "paints");
  await nav(page, "skills");
  await page.goBack();
  await expect(page.locator("#title")).toHaveText("Paints");
  await page.goBack();
  await expect(page.locator("#title")).toHaveText("Dashboard");
  await page.goForward();
  await expect(page.locator("#title")).toHaveText("Paints");
});

test("going back closes an open form without saving", async ({ page }) => {
  await openApp(page);
  await nav(page, "paints");
  await nav(page, "tools");
  await page.click("#addBtn");
  await page.goBack();
  await expect(page.locator("#title")).toHaveText("Paints");
  expect(await modalOpen(page)).toBe(false);
});

test("unknown addresses show the dashboard", async ({ page }) => {
  for (const hash of ["#/nope", "#/toString", "#/__proto__", "#/"]) {
    await page.goto(APP + hash);
    await expect(page.locator("#title"), hash).toHaveText("Dashboard");
  }
});

test("an address without the slash still works", async ({ page }) => {
  await page.goto(APP + "#paints");
  await expect(page.locator("#title")).toHaveText("Paints");
});

test("a modified click on a nav link is left to the browser", async ({
  page,
}) => {
  await openApp(page);
  // Ctrl/Cmd-click opens a new tab; the current page must not navigate.
  await page.evaluate(() =>
    document.querySelector('#nav a[data-sec="paints"]').dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    ),
  );
  await expect(page.locator("#title")).toHaveText("Dashboard");
});

test("index.html opens the app, keeping the address and saved data", async ({
  page,
}) => {
  await openApp(page);
  await seed(page, { paints: [{ id: "p", name: "Saved paint" }] });
  await page.goto(INDEX + "#/paints");
  await expect(page).toHaveURL(/forgeledger_v2\.html#\/paints$/);
  await expect(page.locator("#content")).toContainText("Saved paint");
});
