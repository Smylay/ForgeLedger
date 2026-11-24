// Paint stock levels (Full / Good / Half / Low / Empty), including the
// one-time migration from the old Remaining % field.
const {
  test,
  expect,
  KEY,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  addItem,
  tableRows,
  importBackup,
} = require("./helpers");

const stockOf = async (page) =>
  Object.fromEntries((await stored(page)).paints.map((p) => [p.name, p.stock]));
const pressed = (page, row) =>
  tableRows(page).nth(row).locator('.scale [aria-pressed="true"]');

test.beforeEach(async ({ page }) => openApp(page));

test.describe("migration from Remaining %", () => {
  const old = [
    ["0", "Empty"],
    ["5", "Low"],
    ["19", "Low"],
    ["20", "Half"],
    ["49", "Half"],
    ["50", "Good"],
    ["79", "Good"],
    ["80", "Full"],
    ["100", "Full"],
    ["", ""],
    ["lots", ""],
  ];
  const paints = old.map(([remaining], i) => ({
    id: "p" + i,
    name: `${i}: "${remaining}"`,
    remaining,
  }));
  const expected = Object.fromEntries(
    old.map(([remaining, stock], i) => [`${i}: "${remaining}"`, stock]),
  );

  test("saved data converts each percentage to a level", async ({ page }) => {
    await seed(page, { paints: [...paints, { id: "n", name: "None" }] });
    expect(await stockOf(page)).toEqual({ ...expected, None: "" });
    const data = await stored(page);
    expect(data.schemaVersion).toBe(5);
    // The old field stays in the record so nothing is lost.
    expect(data.paints[1].remaining).toBe("5");
  });

  test("an old backup converts the same way on import", async ({
    page,
  }, testInfo) => {
    await importBackup(page, { schemaVersion: 1, paints }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect(await stockOf(page)).toEqual(expected);
  });

  test("a level that's already set is kept", async ({ page }) => {
    await seed(page, {
      schemaVersion: 1,
      paints: [{ id: "a", name: "Set", stock: "Good", remaining: "5" }],
    });
    expect(await stockOf(page)).toEqual({ Set: "Good" });
  });

  test("version 2 data isn't converted again", async ({ page }) => {
    await seed(page, {
      schemaVersion: 2,
      paints: [{ id: "a", name: "Cleared", stock: "", remaining: "5" }],
    });
    expect(await stockOf(page)).toEqual({ Cleared: "" });
  });
});

test.describe("paint types", () => {
  const typeOf = async (page) =>
    Object.fromEntries(
      (await stored(page)).paints.map((p) => [p.name, p.type]),
    );
  const paints = [
    { id: "a", name: "Old shade", type: "Shade" },
    { id: "b", name: "Layer", type: "Layer" },
    { id: "c", name: "Untyped" },
  ];

  test("Shade becomes Shade/Wash in saved data", async ({ page }) => {
    await seed(page, { schemaVersion: 2, paints });
    expect(await typeOf(page)).toEqual({
      "Old shade": "Shade/Wash",
      Layer: "Layer",
      Untyped: undefined,
    });
    expect((await stored(page)).schemaVersion).toBe(5);
  });

  test("and in an imported backup", async ({ page }, testInfo) => {
    await importBackup(page, { schemaVersion: 2, paints }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect((await typeOf(page))["Old shade"]).toBe("Shade/Wash");
  });

  test("Primer and Shade/Wash can be chosen and filtered", async ({ page }) => {
    await seed(page, { schemaVersion: 2, paints });
    await addItem(page, "paints", { name: "Grey", type: "Primer" });
    expect((await typeOf(page)).Grey).toBe("Primer");
    await page.selectOption("#filter", "Shade/Wash");
    await expect(tableRows(page)).toHaveCount(1);
    await expect(tableRows(page).first()).toContainText("Old shade");
  });
});

test.describe("one-tap levels", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      schemaVersion: 2,
      paints: [
        { id: "a", name: "Red", stock: "Full" },
        { id: "b", name: "Blue", stock: "" },
      ],
    });
    await nav(page, "paints");
  });

  test("tapping a level saves it and marks it", async ({ page }) => {
    await tableRows(page).nth(0).getByRole("button", { name: "Low" }).click();
    expect((await stockOf(page)).Red).toBe("Low");
    await expect(pressed(page, 0)).toHaveText("Low");
    await expect(pressed(page, 0)).toBeFocused();
    await nav(page, "dashboard");
    await expect(page.locator("#stockSummary")).toContainText("Red · Low");
  });

  test("each row's levels are a labelled group", async ({ page }) => {
    await expect(
      page.getByRole("group", { name: "Stock of Blue" }),
    ).toBeVisible();
    await expect(pressed(page, 1)).toHaveCount(0);
  });

  test("levels can be set from the keyboard", async ({ page }) => {
    await tableRows(page).nth(1).getByRole("button", { name: "Half" }).focus();
    await page.keyboard.press("Enter");
    expect((await stockOf(page)).Blue).toBe("Half");
    await page.keyboard.press("ArrowLeft"); // focus stays in the group
    await expect(pressed(page, 1)).toBeFocused();
  });

  test("a tap doesn't move the row in a sorted table", async ({ page }) => {
    await page.locator("#content thead button", { hasText: "Stock" }).click();
    // Ascending by amount: Full (Red) first, unknown (Blue) last.
    await tableRows(page).nth(0).getByRole("button", { name: "Empty" }).click();
    await expect(tableRows(page).nth(0)).toContainText("Red");
  });

  test("the form sets the level with a dropdown", async ({ page }) => {
    await page.locator("button[data-edit]").nth(1).click();
    await fillForm(page, { stock: "Good" });
    await submitForm(page);
    expect((await stockOf(page)).Blue).toBe("Good");
  });
});

test("paints open sorted by stock, least first, unknown last", async ({
  page,
}) => {
  await seed(page, {
    schemaVersion: 2,
    paints: ["Half", "", "Empty", "Full", "Low", "Good"].map((stock, i) => ({
      id: "p" + i,
      name: stock || "Unknown",
      stock,
    })),
  });
  await nav(page, "paints");
  const header = page.locator("#content thead button", { hasText: "Stock" });
  const names = () =>
    tableRows(page).evaluateAll((rows) =>
      rows.map((r) => r.cells[0].textContent),
    );
  expect(await names()).toEqual([
    "Empty",
    "Low",
    "Half",
    "Good",
    "Full",
    "Unknown",
  ]);
  await expect(header).toHaveText("Stock ▲");
  await header.click();
  expect(await names()).toEqual([
    "Full",
    "Good",
    "Half",
    "Low",
    "Empty",
    "Unknown",
  ]);
});

test("Low and Empty count as low stock; other levels don't", async ({
  page,
}) => {
  await seed(page, {
    schemaVersion: 2,
    paints: ["Full", "Good", "Half", "Low", "Empty", ""].map((stock, i) => ({
      id: "p" + i,
      name: "Paint " + (stock || "unknown"),
      stock,
    })),
  });
  const rows = page.locator("#stockSummary .stockrow");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Paint Low · Low");
  await expect(rows.nth(1)).toContainText("Paint Empty · Empty");
});

test("a new paint picks its level in the form", async ({ page }) => {
  await addItem(page, "paints", { name: "Fresh", stock: "Full" });
  expect((await stored(page)).paints[0]).toMatchObject({
    name: "Fresh",
    stock: "Full",
  });
  expect((await stored(page)).paints[0]).not.toHaveProperty("remaining");
  expect(KEY).toBe("forgeledger_v2_data"); // storage key is unchanged
});

test("damaged data is repaired but not saved until something changes", async ({
  page,
}) => {
  const damaged = { paints: null, tools: [{ id: "t", name: "Keep" }] };
  await seed(page, damaged);
  await expect(page.locator("#alerts")).toContainText("couldn't be read");
  // Storage still holds the damaged original, untouched by the upgrade.
  expect(await stored(page)).toEqual(damaged);
});
