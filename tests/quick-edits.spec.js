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

test.describe("+/- on counts", () => {
  const stepper = (page, row, key) =>
    tableRows(page).nth(row).locator(`.stepper:has([data-key="${key}"])`);
  const plus = (page, row, key) =>
    tableRows(page).nth(row).locator(`[data-key="${key}"][data-step="1"]`);
  const minus = (page, row, key) =>
    tableRows(page).nth(row).locator(`[data-key="${key}"][data-step="-1"]`);

  test("paint quantity goes up and down, stopping at 0", async ({ page }) => {
    await nav(page, "paints");
    await plus(page, 0, "quantity").click();
    expect((await stored(page)).paints[0].quantity).toBe("3");
    for (let i = 0; i < 3; i++) await minus(page, 0, "quantity").click();
    expect((await stored(page)).paints[0].quantity).toBe("0");
    await expect(minus(page, 0, "quantity")).toBeDisabled();
    // Focus moved to + once - hit its limit.
    await expect(plus(page, 0, "quantity")).toBeFocused();
    await expect(stepper(page, 0, "quantity")).toHaveAttribute(
      "aria-label",
      "Quantity of Red",
    );
  });

  test("painted can't go above the model count, nor the model count below painted", async ({
    page,
  }) => {
    await nav(page, "miniatures");
    for (let i = 0; i < 3; i++) await plus(page, 0, "painted").click();
    expect((await stored(page)).miniatures[0].painted).toBe("5");
    await expect(plus(page, 0, "painted")).toBeDisabled();
    await expect(minus(page, 0, "quantity")).toBeDisabled();
    await plus(page, 0, "quantity").click();
    await expect(plus(page, 0, "painted")).toBeEnabled();
    expect((await stored(page)).miniatures[0]).toMatchObject({
      quantity: "6",
      painted: "5",
    });
  });

  test("a blank count shows a dash and + starts it at 1", async ({ page }) => {
    await nav(page, "miniatures");
    await expect(stepper(page, 1, "quantity").locator(".stepval")).toHaveText(
      "–not set",
    );
    await expect(minus(page, 1, "quantity")).toBeDisabled();
    await plus(page, 1, "quantity").click();
    await plus(page, 1, "painted").click();
    expect((await stored(page)).miniatures[1]).toMatchObject({
      quantity: "1",
      painted: "1",
    });
    await expect(plus(page, 1, "painted")).toBeDisabled();
  });

  test("works from the keyboard and keeps focus", async ({ page }) => {
    await nav(page, "paints");
    await plus(page, 0, "quantity").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    expect((await stored(page)).paints[0].quantity).toBe("4");
    await expect(plus(page, 0, "quantity")).toBeFocused();
  });

  test("the buttons have names that include the record", async ({ page }) => {
    await nav(page, "paints");
    await expect(
      page.getByRole("button", { name: "Increase Quantity of Red" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Decrease Quantity of Red" }),
    ).toBeVisible();
  });
});
