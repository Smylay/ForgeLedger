// Restocks: pots of a paint bought again, recorded on the paint by Bought or
// the paint form, and counted in Recorded spend.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
  submitForm,
} = require("./helpers");

const today = (page) => page.evaluate(() => today());
const spend = (page) =>
  page.locator("#metrics .metric", { hasText: "Recorded spend" }).locator(".v");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    paints: [
      { id: "red", name: "Red", stock: "Low", quantity: "1", price: "4" },
      {
        id: "plan",
        name: "Planned",
        stock: "Empty",
        quantity: "0",
      },
      {
        id: "old",
        name: "Old",
        price: "3",
        restocks: [
          { date: "2026-01-10", price: "3.5" },
          { date: "2026-03-02", price: "" },
        ],
      },
    ],
    wishlist: [
      { id: "w1", name: "Red", category: "Paint", paint: "red", price: "4.5" },
      {
        id: "w2",
        name: "Planned",
        category: "Paint",
        paint: "plan",
        price: "6",
      },
    ],
  });
});

test("Bought on a restock records it, and Recorded spend counts it", async ({
  page,
}) => {
  // 4 + 3 + 3.50 already.
  await expect(spend(page)).toHaveText("£10.50");
  await nav(page, "wishlist");
  await page.getByRole("button", { name: "Bought: Red" }).click();
  const red = (await stored(page)).paints.find((p) => p.id === "red");
  expect(red.restocks).toEqual([{ date: await today(page), price: "4.5" }]);
  expect(red.price).toBe("4"); // its own price is left alone
  await nav(page, "dashboard");
  await expect(spend(page)).toHaveText("£15.00");
  await expect(page.locator("#spendSummary")).toContainText(
    "including £8.00 on restocks",
  );
  // Undo takes the restock back off.
  await nav(page, "wishlist");
  await page.getByRole("button", { name: "Bought: Planned" }).click();
  await page.click("#toastAction");
  await nav(page, "dashboard");
  await expect(spend(page)).toHaveText("£15.00");
});

test("a planned paint's first pot is its price, not a restock", async ({
  page,
}) => {
  await nav(page, "wishlist");
  await page.getByRole("button", { name: "Bought: Planned" }).click();
  const plan = (await stored(page)).paints.find((p) => p.id === "plan");
  expect(plan).toMatchObject({ quantity: "1", stock: "Full", price: "6" });
  expect(plan.restocks).toBeUndefined();
});

test.describe("in the paint form", () => {
  const edit = async (page, name) => {
    await nav(page, "paints");
    await tableRows(page)
      .filter({ hasText: name })
      .locator("button[data-edit]")
      .click();
  };
  const section = (page) => page.locator("#formFields .restocks");

  test("lists them, with their total", async ({ page }) => {
    await edit(page, "Old");
    await expect(section(page).locator("li")).toHaveText([
      "2026-01-10 · £3.50 Remove",
      "2026-03-02 · no price Remove",
    ]);
    await expect(section(page)).toContainText(
      "£3.50 on 2 restock(s), counted in Recorded spend.",
    );
  });

  test("records one bought today, and removes others", async ({ page }) => {
    await edit(page, "Old");
    await page
      .getByRole("checkbox", { name: "Remove the restock of 2026-03-02" })
      .check();
    await page.fill('#formFields [name="restockPrice"]', "5");
    await submitForm(page);
    const old = (await stored(page)).paints.find((p) => p.id === "old");
    expect(old.restocks).toEqual([
      { date: "2026-01-10", price: "3.5" },
      { date: await today(page), price: "5" },
    ]);
    // The boxes themselves aren't saved.
    expect(old).not.toHaveProperty("restockPrice");
    expect(old).not.toHaveProperty("restockRemove");
  });

  test("saving without using it leaves them alone", async ({ page }) => {
    await edit(page, "Old");
    await submitForm(page);
    const old = (await stored(page)).paints.find((p) => p.id === "old");
    expect(old.restocks).toHaveLength(2);
    expect(Object.keys(old).filter((k) => k.startsWith("restock"))).toEqual([
      "restocks",
    ]);
  });

  test("a new paint has no restocks section", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await expect(section(page)).toHaveCount(0);
  });
});

test("junk restocks are ignored, and only kept as they are", async ({
  page,
}) => {
  const junk = [
    null,
    7,
    { date: 5, price: "abc" },
    { price: "-2" },
    { price: "2" },
  ];
  await seed(page, {
    paints: [
      { id: "a", name: "A", restocks: "lots" },
      { id: "b", name: "B", restocks: junk },
    ],
  });
  await expect(spend(page)).toHaveText("£2.00");
  const editB = async () => {
    await nav(page, "paints");
    await tableRows(page)
      .filter({ hasText: "B" })
      .locator("button[data-edit]")
      .click();
  };
  await editB();
  await expect(page.locator("#formFields .restocks li")).toHaveText([
    "5 · no price Remove",
    "no date · no price Remove",
    "no date · £2.00 Remove",
  ]);
  // Saving without using the section leaves the stored list as it was.
  await submitForm(page);
  expect((await stored(page)).paints[1].restocks).toEqual(junk);
  // Removing one keeps only the usable entries.
  await editB();
  await page.locator('#formFields [name="restockRemove"]').first().check();
  await submitForm(page);
  expect((await stored(page)).paints[1].restocks).toEqual([
    { price: "-2" },
    { price: "2" },
  ]);
});
