// Suggestions as you type: brand, range, faction and game system boxes offer
// what you've already entered, then common values, and still take anything.
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

const options = (page, key) =>
  page
    .locator(`#suggest-${key} option`)
    .evaluateAll((els) => els.map((o) => o.value));

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    paints: [
      { id: "a", name: "Red", brand: "Acme", range: "Core" },
      { id: "b", name: "Blue", brand: "Acme", range: "Core" },
      { id: "c", name: "Wash", brand: "acme", range: "Shades" },
      { id: "d", name: "Green", brand: "Citadel", range: "Base" },
    ],
    miniatures: [{ id: "m", name: "Squad", faction: "Iron Guard" }],
    projects: [
      { id: "p", name: "Army", faction: "Goblins", system: "Home Rules" },
    ],
  });
});

test("paint brand suggests your brands first, then common ones", async ({
  page,
}) => {
  await nav(page, "paints");
  await page.click("#addBtn");
  const input = page.locator('#formFields [name="brand"]');
  await expect(input).toHaveAttribute("list", "suggest-brand");
  const brands = await options(page, "brand");
  // Yours, most used first; "acme" and "Acme" count as one.
  expect(brands.slice(0, 2)).toEqual(["Acme", "Citadel"]);
  // Then the common brands you haven't used, without repeating Citadel.
  expect(brands).toContain("Vallejo");
  expect(brands).toContain("The Army Painter");
  expect(brands.filter((b) => b.toLowerCase() === "citadel")).toHaveLength(1);
});

test("range suggestions follow the brand", async ({ page }) => {
  await nav(page, "paints");
  await page.click("#addBtn");
  // No brand yet: every range you've used, most used first.
  expect(await options(page, "range")).toEqual(["Core", "Base", "Shades"]);
  // Citadel: yours first, then the paint catalogue's Citadel ranges.
  await fillForm(page, { brand: "Citadel" });
  await expect
    .poll(() => options(page, "range"))
    .toEqual(expect.arrayContaining(["Base", "Layer", "Contrast"]));
  expect((await options(page, "range"))[0]).toBe("Base");
  await fillForm(page, { brand: "ACME" });
  expect(await options(page, "range")).toEqual(["Core", "Shades"]);
  // A brand you haven't used: all your ranges again.
  await fillForm(page, { brand: "Somebody new" });
  expect(await options(page, "range")).toEqual(["Core", "Base", "Shades"]);
});

test("editing a paint suggests ranges for its own brand", async ({ page }) => {
  await nav(page, "paints");
  await tableRows(page)
    .filter({ hasText: "Green" })
    .getByRole("button", { name: "Edit" })
    .click();
  await expect
    .poll(() => options(page, "range"))
    .toEqual(expect.arrayContaining(["Base", "Shade"]));
  expect((await options(page, "range"))[0]).toBe("Base");
});

test("factions are shared by miniatures and projects", async ({ page }) => {
  await nav(page, "miniatures");
  await page.click("#addBtn");
  expect(await options(page, "faction")).toEqual(["Goblins", "Iron Guard"]);
  await page.click("#cancelModal");
  await nav(page, "projects");
  await page.click("#addBtn");
  expect(await options(page, "faction")).toEqual(["Goblins", "Iron Guard"]);
});

test("game systems: yours, then common ones", async ({ page }) => {
  await nav(page, "projects");
  await page.click("#addBtn");
  const systems = await options(page, "system");
  expect(systems[0]).toBe("Home Rules");
  expect(systems).toContain("Warhammer 40,000");
  expect(systems).toContain("Bolt Action");
});

test("tools and miniatures have a brand, with their own suggestions", async ({
  page,
}) => {
  await nav(page, "tools");
  await page.click("#addBtn");
  expect(await options(page, "brand")).toContain("Artis Opus");
  await fillForm(page, { name: "Detail brush", brand: "My Brush Co" });
  await submitForm(page);
  await nav(page, "miniatures");
  await page.click("#addBtn");
  expect(await options(page, "brand")).toContain("Games Workshop");
  // Paint brands aren't offered for miniatures.
  expect(await options(page, "brand")).not.toContain("Acme");
  await fillForm(page, { name: "Knights", brand: "Games Workshop" });
  await submitForm(page);
  const data = await stored(page);
  expect(data.tools.at(-1)).toMatchObject({
    name: "Detail brush",
    brand: "My Brush Co",
  });
  expect(data.miniatures.at(-1)).toMatchObject({
    name: "Knights",
    brand: "Games Workshop",
  });
  // The brand is searchable, though it isn't a column.
  await page.fill("#search", "games workshop");
  await expect(tableRows(page)).toHaveCount(1);
});

test("anything can still be typed", async ({ page }) => {
  await nav(page, "paints");
  await page.click("#addBtn");
  await fillForm(page, { name: "Odd", brand: "Not on any list" });
  await submitForm(page);
  expect((await stored(page)).paints.at(-1).brand).toBe("Not on any list");
});
