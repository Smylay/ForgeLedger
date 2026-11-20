const {
  test,
  expect,
  openApp,
  stored,
  nav,
  addItem,
  downloadText,
  importBackup,
} = require("./helpers");

test.beforeEach(async ({ page }) => openApp(page));

test("exported backup matches stored data", async ({ page }) => {
  await addItem(page, "paints", { name: "Red", remaining: "40" });
  await addItem(page, "tools", { name: "Knife" });
  const backup = JSON.parse(await downloadText(page, "#backupBtn"));
  expect(backup).toEqual(await stored(page));
});

test("export then import restores the same data", async ({
  page,
}, testInfo) => {
  await addItem(page, "miniatures", { name: "Squad", quantity: "5" });
  const backup = JSON.parse(await downloadText(page, "#backupBtn"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await importBackup(page, backup, testInfo);
  await expect(page.locator("#toast")).toHaveText("Backup imported");
  expect((await stored(page)).miniatures).toEqual(backup.miniatures);
});

test("invalid JSON is rejected and data is untouched", async ({
  page,
}, testInfo) => {
  await addItem(page, "paints", { name: "Keep" });
  await importBackup(page, "{not json", testInfo);
  await expect(page.locator("#toast")).toHaveText(/invalid/i);
  expect((await stored(page)).paints[0].name).toBe("Keep");
});

test("CSV export has a header row and one row per item", async ({ page }) => {
  await addItem(page, "paints", { name: "Red" });
  await addItem(page, "paints", { name: 'Say "hi"' });
  await nav(page, "paints");
  const lines = (await downloadText(page, "#csvBtn")).split("\n");
  expect(lines).toHaveLength(3);
  expect(lines[0]).toContain('"name"');
  expect(lines[2]).toContain('"Say ""hi"""');
});
