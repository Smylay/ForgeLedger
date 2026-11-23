// Editing without the form: one-tap status fields, +/- buttons on counts,
// and the quick-add row.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
} = require("./helpers");

const data = {
  schemaVersion: 2,
  paints: [{ id: "p", name: "Red", quantity: "2", stock: "Full" }],
  tools: [{ id: "t", name: "Brush", condition: "Good", quantity: "1" }],
  miniatures: [
    { id: "a", name: "Squad", quantity: "5", painted: "2", status: "Built" },
    { id: "b", name: "Hero", quantity: "", painted: "", status: "" },
  ],
  wishlist: [{ id: "w", name: "Pot", priority: "Low" }],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, data);
});

const pressed = (page, row) =>
  tableRows(page).nth(row).locator('.scale [aria-pressed="true"]');

test.describe("one-tap status fields", () => {
  const cases = [
    ["miniatures", "status", "Complete", "Squad"],
    ["tools", "condition", "Replace soon", "Brush"],
    ["wishlist", "priority", "High", "Pot"],
  ];
  for (const [section, key, value, name] of cases) {
    test(`${section} ${key} is set with one tap`, async ({ page }) => {
      await nav(page, section);
      await tableRows(page).nth(0).getByRole("button", { name: value }).click();
      expect((await stored(page))[section][0][key]).toBe(value);
      await expect(pressed(page, 0)).toHaveText(value);
      await expect(pressed(page, 0)).toBeFocused();
      await expect(
        page.getByRole("group", {
          name: `${key[0].toUpperCase() + key.slice(1)} of ${name}`,
        }),
      ).toBeVisible();
    });
  }

  test("the chosen option is coloured by meaning", async ({ page }) => {
    await nav(page, "miniatures");
    await tableRows(page)
      .nth(0)
      .getByRole("button", { name: "Complete" })
      .click();
    await expect(pressed(page, 0)).toHaveClass(/tone-good/);
    await nav(page, "wishlist");
    await tableRows(page).nth(0).getByRole("button", { name: "High" }).click();
    await expect(pressed(page, 0)).toHaveClass(/tone-bad/);
  });

  test("status sorts in its natural order", async ({ page }) => {
    await nav(page, "miniatures");
    await tableRows(page)
      .nth(1)
      .getByRole("button", { name: "Primed" })
      .click();
    await page.locator("#content thead button", { hasText: "Status" }).click();
    const names = await tableRows(page).evaluateAll((rows) =>
      rows.map((r) => r.cells[0].textContent),
    );
    expect(names).toEqual(["Squad", "Hero"]); // Built before Primed
  });

  test("the status filter still works", async ({ page }) => {
    await nav(page, "miniatures");
    await page.selectOption("#filter", "Built");
    await expect(tableRows(page)).toHaveCount(1);
    await expect(tableRows(page).first()).toContainText("Squad");
  });
});
