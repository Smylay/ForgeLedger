// Single-key shortcuts and the switch that turns them off.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  modalOpen,
} = require("./helpers");

const title = (page) => page.locator("#title");
const keys = (page) => page.locator("#keysDialog");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 2,
    paints: [{ id: "p", name: "Red" }],
  });
});

test("number keys jump between sections", async ({ page }) => {
  await page.keyboard.press("2");
  await expect(title(page)).toHaveText("Paints");
  await page.keyboard.press("6");
  await expect(title(page)).toHaveText("Painting queue");
  await page.keyboard.press("8");
  await expect(title(page)).toHaveText("Wishlist");
  await page.keyboard.press("1");
  await expect(title(page)).toHaveText("Dashboard");
});

test("N opens the add form, except on the dashboard", async ({ page }) => {
  await page.keyboard.press("n");
  expect(await modalOpen(page)).toBe(false);
  await nav(page, "tools");
  await page.keyboard.press("n");
  expect(await modalOpen(page)).toBe(true);
  await expect(page.locator("#modalTitle")).toHaveText("Add tool");
});

test("/ focuses search without typing a slash", async ({ page }) => {
  await nav(page, "paints");
  await page.keyboard.press("/");
  await expect(page.locator("#search")).toBeFocused();
  await expect(page.locator("#search")).toHaveValue("");
});

test("Q focuses the quick-add box", async ({ page }) => {
  await nav(page, "queue");
  await page.keyboard.press("q");
  await expect(page.locator("#queueView .quickadd input")).toBeFocused();
  await nav(page, "skills");
  await page.keyboard.press("q");
  await expect(page.locator("#skillAdd select")).toBeFocused();
});

test("? shows the list of shortcuts, and Esc closes it", async ({ page }) => {
  await page.keyboard.press("?");
  await expect(keys(page)).toBeVisible();
  await expect(keys(page)).toContainText("Search the current list");
  await page.keyboard.press("Escape");
  await expect(keys(page)).toBeHidden();
});

test("typing in a box isn't treated as a shortcut", async ({ page }) => {
  await nav(page, "paints");
  await page.locator("#search").fill("");
  await page.locator("#search").pressSequentially("n2q");
  await expect(page.locator("#search")).toHaveValue("n2q");
  await expect(title(page)).toHaveText("Paints");
  expect(await modalOpen(page)).toBe(false);
});

test("keys with Ctrl, Alt or Cmd are left alone", async ({ page }) => {
  await page.keyboard.press("Alt+2");
  await expect(title(page)).toHaveText("Dashboard");
});

test("shortcuts are ignored while a dialog is open", async ({ page }) => {
  await nav(page, "paints");
  await page.click("#addBtn");
  await page.locator("#cancelModal").focus();
  await page.keyboard.press("3");
  await expect(title(page)).toHaveText("Paints");
});

test("they can be turned off, and stay off after a reload", async ({
  page,
}) => {
  await page.keyboard.press("?");
  await page.locator("#keysOn").uncheck();
  await page.keyboard.press("Escape");
  await page.reload();
  await page.keyboard.press("2");
  await expect(title(page)).toHaveText("Dashboard");
  await page.keyboard.press("?");
  await expect(keys(page)).toBeHidden();

  // The sidebar button still opens the list, to turn them back on.
  await page.click("#keysBtn");
  await expect(page.locator("#keysOn")).not.toBeChecked();
  await page.locator("#keysOn").check();
  await page.keyboard.press("Escape");
  await page.keyboard.press("2");
  await expect(title(page)).toHaveText("Paints");
  // The setting isn't part of the data (or its backups).
  expect(await stored(page)).not.toHaveProperty("shortcuts");
});
