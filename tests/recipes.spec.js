const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  tableRows,
} = require("./helpers");

const data = {
  paints: [
    {
      id: "red",
      name: "Red",
      brand: "Acme",
      remaining: "80",
      colour: "#cc0000",
    },
    { id: "black", name: "Black", brand: "Acme", remaining: "10" },
    { id: "gold", name: "Gold", brand: "Other", remaining: "5" },
  ],
  miniatures: [
    { id: "m1", name: "Squad", paints: ["red", "black"] },
    { id: "m2", name: "Hero", paints: ["gold"] },
  ],
  queue: [
    { id: "q1", name: "Squad", miniature: "m1", stage: "Basing" },
    { id: "q2", name: "Hero", miniature: "m2", stage: "Complete" },
  ],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, data);
});

const recipeCell = (page, row) => tableRows(page).nth(row).locator("td").nth(6);

test("picking recipe paints saves their ids", async ({ page }) => {
  await nav(page, "miniatures");
  await page.click("#addBtn");
  await fillForm(page, { name: "New unit" });
  await page
    .locator('#formFields [name="paints"]')
    .selectOption(["red", "gold"]);
  await submitForm(page);
  expect((await stored(page)).miniatures.at(-1).paints).toEqual([
    "red",
    "gold",
  ]);
});

test("the picker names paints with their brand and keeps the selection", async ({
  page,
}) => {
  await nav(page, "miniatures");
  await page.locator("button[data-edit]").first().click();
  const picker = page.locator('#formFields [name="paints"]');
  await expect(picker.locator("option")).toHaveText([
    "Red (Acme)",
    "Black (Acme)",
    "Gold (Other)",
  ]);
  expect(
    await picker.evaluate((s) => [...s.selectedOptions].map((o) => o.value)),
  ).toEqual(["red", "black"]);
  await submitForm(page); // saving unchanged keeps the recipe
  expect((await stored(page)).miniatures[0].paints).toEqual(["red", "black"]);
});

test("the table lists recipe paints and flags low ones", async ({ page }) => {
  await nav(page, "miniatures");
  await expect(recipeCell(page, 0)).toHaveText("Red Black 10%");
  await expect(recipeCell(page, 0).locator(".pill.warn")).toHaveText("10%");
});

test("miniatures can be found by a recipe paint's name", async ({ page }) => {
  await nav(page, "miniatures");
  await page.fill("#search", "gold");
  await expect(tableRows(page)).toHaveCount(1);
  await expect(tableRows(page).first()).toContainText("Hero");
});

test("queue items warn about low recipe paints until complete", async ({
  page,
}) => {
  await nav(page, "queue");
  await expect(page.locator(".qitem").nth(0).locator(".warnline")).toHaveText(
    "Low paint: Black (10%)",
  );
  await expect(page.locator(".qitem").nth(1).locator(".warnline")).toHaveCount(
    0,
  );
});

test("low-stock warnings count queued miniatures that need the paint", async ({
  page,
}) => {
  const stock = page.locator("#stockSummary");
  await expect(stock).toContainText("Acme Black · 10% · needed for 1 queued");
  // Gold is only used by a queue item that is already complete.
  await expect(stock).toContainText("Other Gold · 5%");
  await expect(stock).not.toContainText("Gold · 5% · needed");
});

test("deleting a paint removes it from recipes, and Undo puts it back", async ({
  page,
}) => {
  await nav(page, "paints");
  await page.locator("button[data-del]").nth(1).click(); // Black
  await expect(page.locator("#toastText")).toHaveText(
    'Deleted "Black" and unlinked 1 item(s) from it',
  );
  expect((await stored(page)).miniatures[0].paints).toEqual(["red"]);
  await page.click("#toastAction");
  expect((await stored(page)).miniatures[0].paints).toEqual(["red", "black"]);
});

test("a malformed recipe in imported data is ignored", async ({ page }) => {
  await seed(page, {
    paints: data.paints,
    miniatures: [
      { id: "a", name: "String", paints: "red" },
      { id: "b", name: "Mixed", paints: ["red", 7, null, "gone"] },
    ],
  });
  await nav(page, "miniatures");
  await expect(recipeCell(page, 0)).toHaveText("");
  await expect(recipeCell(page, 1)).toHaveText("Red");
});
