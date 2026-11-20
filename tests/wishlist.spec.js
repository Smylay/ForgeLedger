const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
} = require("./helpers");

const stock = (page) => page.locator("#stockSummary");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    paints: [
      {
        id: "black",
        name: "Black",
        brand: "Acme",
        remaining: "10",
        price: "3.50",
      },
      { id: "gold", name: "Gold", brand: "", remaining: "5" },
      { id: "white", name: "White", brand: "Acme", remaining: "15" },
      { id: "red", name: "Red", brand: "Acme", remaining: "90" },
    ],
    wishlist: [
      { id: "w1", name: "Old entry", category: "Paint", paint: "white" },
    ],
  });
});

test("a low paint can be added to the wishlist in one click", async ({
  page,
}) => {
  await stock(page).locator('button[data-wish="black"]').click();
  await expect(page.locator("#toastText")).toHaveText(
    'Added "Black (Acme)" to the wishlist',
  );
  expect((await stored(page)).wishlist.at(-1)).toMatchObject({
    name: "Black (Acme)",
    category: "Paint",
    priority: "High",
    paint: "black",
    price: "3.50",
    notes: "Restock",
  });
  await expect(stock(page).locator(".stockrow").first()).toContainText(
    "On wishlist",
  );
  await expect(stock(page).locator('button[data-wish="black"]')).toHaveCount(0);
});

test("paints already on the wishlist show as such", async ({ page }) => {
  const white = stock(page).locator(".stockrow", { hasText: "White" });
  await expect(white).toContainText("On wishlist");
  await expect(white.locator("button")).toHaveCount(0);
});

test("Add all adds only the low paints not already wanted, with Undo", async ({
  page,
}) => {
  await stock(page).locator("button[data-wishall]").click();
  await expect(page.locator("#toastText")).toHaveText(
    "Added 2 paints to the wishlist",
  );
  expect((await stored(page)).wishlist.map((w) => w.paint)).toEqual([
    "white",
    "black",
    "gold",
  ]);
  await expect(stock(page).locator("button")).toHaveCount(0);

  await page.click("#toastAction");
  expect((await stored(page)).wishlist.map((w) => w.paint)).toEqual(["white"]);
});

test("Add all only appears when more than one paint can be added", async ({
  page,
}) => {
  await stock(page).locator('button[data-wish="black"]').click();
  await expect(stock(page).locator("button[data-wishall]")).toHaveCount(0);
});

test("the wishlist form links an item to the paint it restocks", async ({
  page,
}) => {
  await nav(page, "wishlist");
  await page.click("#addBtn");
  await fillForm(page, { name: "Bigger pot", paint: "red" });
  await submitForm(page);
  expect((await stored(page)).wishlist.at(-1).paint).toBe("red");
});

test("deleting a paint keeps its wishlist item but clears the link", async ({
  page,
}) => {
  await nav(page, "paints");
  await page.locator("button[data-del]").nth(2).click(); // White
  const item = (await stored(page)).wishlist[0];
  expect(item).toMatchObject({ id: "w1", name: "Old entry", paint: "" });
});
