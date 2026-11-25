// The wishlist's Bought button: restock a paint, add the item to its list,
// or ask where it goes. The item always comes off the wishlist, with Undo.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
} = require("./helpers");

const buy = (page, name) =>
  page.getByRole("button", { name: `Bought: ${name}` });
const wished = async (page) => (await stored(page)).wishlist.map((w) => w.name);
const dialog = (page) => page.locator("#boughtDialog");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 3,
    paints: [{ id: "red", name: "Red", stock: "Low", quantity: "1" }],
    wishlist: [
      { id: "w1", name: "Red", category: "Paint", paint: "red", price: "4" },
      {
        id: "w2",
        name: "Blue",
        category: "Paint",
        price: "4.5",
        url: "https://example.com/blue",
        notes: "Matt",
      },
      { id: "w3", name: "Clippers", category: "Tool", price: "12" },
      { id: "w4", name: "Knights", category: "Miniature", price: "40" },
      { id: "w5", name: "Ruins", category: "Terrain", price: "25" },
      { id: "w6", name: "Rulebook", category: "Book" },
      // Its paint was deleted, so it's an ordinary Paint item.
      { id: "w7", name: "Green", category: "Paint", paint: "gone" },
    ],
  });
  await nav(page, "wishlist");
});

test("a restock sets its paint back to Full instead of adding another", async ({
  page,
}) => {
  await buy(page, "Red").click();
  const data = await stored(page);
  // The pot bought is recorded as a restock (tests/restocks.spec.js).
  expect(data.paints).toEqual([
    {
      id: "red",
      name: "Red",
      stock: "Full",
      quantity: "1",
      restocks: [{ date: await page.evaluate(() => today()), price: "4" }],
    },
  ]);
  expect(await wished(page)).not.toContain("Red");
  await expect(page.locator("#toastText")).toHaveText(
    'Bought "Red": "Red" is Full again, £4.00 recorded',
  );
  await page.click("#toastAction");
  expect((await stored(page)).paints[0].stock).toBe("Low");
  expect(await wished(page)).toContain("Red");
});

test("a paint is added to Paints with its price, notes and link", async ({
  page,
}) => {
  await buy(page, "Blue").click();
  expect((await stored(page)).paints[1]).toMatchObject({
    name: "Blue",
    price: "4.5",
    quantity: "1",
    stock: "Full",
    notes: "Matt\nBought from https://example.com/blue",
  });
  expect(await wished(page)).not.toContain("Blue");
  await expect(page.locator("#toastText")).toHaveText(
    'Bought "Blue": added to Paints',
  );
});

test("tools and miniatures go to their lists", async ({ page }) => {
  await buy(page, "Clippers").click();
  await buy(page, "Knights").click();
  const data = await stored(page);
  expect(data.tools[0]).toMatchObject({
    name: "Clippers",
    price: "12",
    quantity: "1",
    condition: "New",
  });
  expect(data.miniatures[0]).toMatchObject({
    name: "Knights",
    price: "40",
    status: "Unbuilt",
  });
});

test("a link to a deleted paint is treated as a new paint", async ({
  page,
}) => {
  await buy(page, "Green").click();
  expect((await stored(page)).paints.map((p) => p.name)).toEqual([
    "Red",
    "Green",
  ]);
});

test("focus moves to the next row's Bought button", async ({ page }) => {
  await buy(page, "Clippers").focus();
  await page.keyboard.press("Enter");
  await expect(buy(page, "Knights")).toBeFocused();
});

test.describe("other categories ask where they go", () => {
  test("Terrain suggests Miniatures", async ({ page }) => {
    await buy(page, "Ruins").click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("#boughtText")).toHaveText(
      'Where should "Ruins" go? It comes off the wishlist either way.',
    );
    await expect(
      page.getByRole("radio", { name: "Add it to Miniatures" }),
    ).toBeChecked();
    await page.click('#boughtDialog button[value="apply"]');
    await expect(dialog(page)).toBeHidden();
    expect((await stored(page)).miniatures[0]).toMatchObject({
      name: "Ruins",
      price: "25",
    });
    expect(await wished(page)).not.toContain("Ruins");
    // Focus goes to the Bought button now in its place.
    await expect(buy(page, "Rulebook")).toBeFocused();
  });

  test("anything can just come off the wishlist", async ({ page }) => {
    await buy(page, "Rulebook").click();
    await expect(
      page.getByRole("radio", { name: "Don't add it anywhere" }),
    ).toBeChecked();
    await page.click('#boughtDialog button[value="apply"]');
    expect(await wished(page)).not.toContain("Rulebook");
    const data = await stored(page);
    expect([...data.paints, ...data.tools, ...data.miniatures]).toHaveLength(1); // just the Red paint
    await expect(page.locator("#toastText")).toHaveText(
      'Bought "Rulebook": taken off the wishlist',
    );
  });

  test("another list can be chosen", async ({ page }) => {
    await buy(page, "Rulebook").click();
    await page.getByRole("radio", { name: "Add it to Tools" }).check();
    await page.click('#boughtDialog button[value="apply"]');
    expect((await stored(page)).tools[0].name).toBe("Rulebook");
  });

  test("Cancel and Esc change nothing", async ({ page }) => {
    await buy(page, "Ruins").click();
    await page.click('#boughtDialog button[value="cancel"]');
    await buy(page, "Ruins").click();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    expect((await stored(page)).miniatures ?? []).toEqual([]);
    expect(await wished(page)).toContain("Ruins");
    await expect(buy(page, "Ruins")).toBeFocused();
  });
});

test("only wishlist rows have Bought", async ({ page }) => {
  await nav(page, "paints");
  await expect(page.locator("[data-bought]")).toHaveCount(0);
  await nav(page, "wishlist");
  await expect(tableRows(page).first().locator("[data-bought]")).toHaveText(
    "Bought",
  );
});
