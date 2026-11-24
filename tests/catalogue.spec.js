// The paint catalogue: its data file, the paint form's Find box, quick add
// on the paints page, and planning a recipe with paints you don't own.
const fs = require("fs");
const {
  test,
  expect,
  openApp,
  openSite,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  tableRows,
} = require("./helpers");
const {
  build,
  render,
  readSource,
  OUT,
} = require("../scripts/make-catalogue.js");

test("data/paint-catalogue.js is up to date with its source", () => {
  // If this fails, run `npm run catalogue`.
  expect(fs.readFileSync(OUT, "utf8")).toBe(render(build(readSource())));
});

test("the catalogue is tidy", async ({ page }) => {
  const { brands, ranges, types, paints } = build(readSource());
  expect(brands).toHaveLength(15);
  expect(paints.length).toBeGreaterThan(5000);
  // Collect anything wrong, then check once: thousands of expect() calls
  // are slow.
  const problems = paints.filter(
    ([b, r, name, code, hex, t, gone]) =>
      !brands[b] ||
      !ranges[r] ||
      name !== name.trim() ||
      /\s{2}|\d\s*ml$/i.test(name) ||
      typeof code !== "string" ||
      !/^([0-9A-F]{6})?$/.test(hex) ||
      !types[t] ||
      ![0, 1].includes(gone),
  );
  expect(problems).toEqual([]);
  // One entry per paint in a range.
  const keys = paints.map(([b, r, n]) => `${b}|${r}|${n.toLowerCase()}`);
  expect(new Set(keys).size).toBe(keys.length);
  // Varnishes and mediums have no colour; colours called "Medium" keep one.
  const hexOf = (name) => paints.find((p) => p[2] === name)[4];
  expect(hexOf("Lahmian Medium")).toBe("");
  expect(hexOf("Munitorum Varnish")).toBe("");
  expect(hexOf("Oxide Brown Medium")).not.toBe("");
  // Every type is one of the app's paint types.
  await openApp(page);
  const appTypes = await page.evaluate(
    () => column(defs.paints, "type").options,
  );
  expect(appTypes).toEqual(expect.arrayContaining(types));
});

test.describe("in the app", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  const pick = async (page, box, list, text) => {
    await page.fill(box, text);
    await expect(page.locator(`${list} option`).first()).toBeAttached();
    const label = await page
      .locator(`${list} option`)
      .first()
      .getAttribute("value");
    await page.fill(box, label);
    return label;
  };

  test("Find fills in the paint form", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await fillForm(page, { stock: "Half", quantity: "2" });
    const label = await pick(
      page,
      "#catalogueFind",
      "#catalogueList",
      "mephiston red base",
    );
    expect(label).toBe("Mephiston Red · Citadel Base");
    await expect(page.locator("#catalogueHint")).toHaveText(
      "Filled in from the catalogue: Mephiston Red · Citadel Base.",
    );
    await expect(page.locator("#catalogueFind")).toHaveValue("");
    await submitForm(page);
    expect((await stored(page)).paints[0]).toMatchObject({
      name: "Mephiston Red",
      brand: "Citadel",
      range: "Base",
      type: "Base",
      colour: "#960c09",
      // What you'd set yourself is left alone.
      stock: "Half",
      quantity: "2",
    });
  });

  test("a product with no colour fills in No colour", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await pick(page, "#catalogueFind", "#catalogueList", "lahmian");
    await expect(page.locator('[data-nocolour="colour"]')).toBeChecked();
    await submitForm(page);
    expect((await stored(page)).paints[0]).toMatchObject({
      name: "Lahmian Medium",
      type: "Technical",
      colour: "",
    });
  });

  test("Two Thin Coats Dark Arts paints are there, without colours", async ({
    page,
  }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    const label = await pick(
      page,
      "#catalogueFind",
      "#catalogueList",
      "flayer",
    );
    expect(label).toBe("Flayer Red · Two Thin Coats (Duncan Rhodes) Dark Arts");
    await expect(page.locator('[data-nocolour="colour"]')).toBeChecked();
    await expect(page.locator('#formFields [name="type"]')).toHaveValue(
      "Standard",
    );
  });

  test("codes find paints too", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await page.fill("#catalogueFind", "70.950");
    await expect(page.locator("#catalogueList option").first()).toHaveAttribute(
      "value",
      "Black · Vallejo Model Color",
    );
  });

  test("quick add picks from the catalogue", async ({ page }) => {
    await nav(page, "paints");
    const box = page.locator("#listView .quickadd input");
    await expect(box).toHaveAttribute("list", "quickCatalogue");
    // Picking a suggestion adds it straight away.
    await pick(
      page,
      "#listView .quickadd input",
      "#quickCatalogue",
      "nuln oil",
    );
    await expect(page.locator("#toastText")).toHaveText(
      'Added "Nuln Oil" (Citadel Shade)',
    );
    await expect(box).toHaveValue("");
    expect((await stored(page)).paints).toHaveLength(1);
    expect((await stored(page)).paints[0]).toMatchObject({
      name: "Nuln Oil",
      brand: "Citadel",
      range: "Shade",
      type: "Shade/Wash",
      colour: "#101010",
      stock: "Full",
      quantity: "1",
    });
    // Anything else is added by name, as before.
    await box.fill("My own mix");
    await page.click("#listView .quickadd button");
    expect((await stored(page)).paints[1]).toEqual({
      id: expect.any(String),
      name: "My own mix",
    });
    // Other pages' quick add doesn't suggest paints.
    await nav(page, "tools");
    await expect(box).not.toHaveAttribute("list", /./);
  });

  test("Enter in the Find box doesn't save the form", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await fillForm(page, { name: "Half done" });
    await page.locator("#catalogueFind").press("Enter");
    await expect(page.locator("#modal")).toBeVisible();
    expect((await stored(page))?.paints ?? []).toHaveLength(0);
  });

  test.describe("planning a recipe with paints you don't own", () => {
    test.beforeEach(async ({ page }) => {
      await seed(page, {
        paints: [{ id: "own", name: "Abaddon Black", brand: "Citadel" }],
        wishlist: [
          { id: "w", name: "Dragon Green", category: "Paint" },
          { id: "w2", name: "Big brush", category: "Tool" },
        ],
      });
      await nav(page, "miniatures");
      await page.click("#addBtn");
      await fillForm(page, { name: "Knights" });
    });

    test("a catalogue paint becomes a paint to buy, on the wishlist", async ({
      page,
    }) => {
      await pick(page, "#planPaint", "#planList", "retributor armour base");
      await expect(page.locator("#planHint")).toContainText(
        "Added Retributor Armour (Citadel)",
      );
      await expect(
        page.locator('#formFields [name="paints"] option:checked'),
      ).toHaveText(["Retributor Armour (Citadel), not owned yet"]);
      await submitForm(page);
      const data = await stored(page);
      const paint = data.paints.find((p) => p.name === "Retributor Armour");
      expect(paint).toMatchObject({
        brand: "Citadel",
        range: "Base",
        stock: "Empty",
        quantity: "0",
      });
      expect(data.miniatures[0].paints).toEqual([paint.id]);
      expect(data.wishlist.at(-1)).toMatchObject({
        name: "Retributor Armour (Citadel)",
        category: "Paint",
        paint: paint.id,
      });

      // Bought restocks it: Full, and one pot.
      await nav(page, "wishlist");
      await page
        .getByRole("button", { name: "Bought: Retributor Armour (Citadel)" })
        .click();
      const bought = (await stored(page)).paints.find((p) => p.id === paint.id);
      expect(bought).toMatchObject({ stock: "Full", quantity: "1" });
    });

    test("a wishlist paint becomes a paint, and the wishlist item restocks it", async ({
      page,
    }) => {
      await page.fill("#planPaint", "drag");
      await expect(page.locator("#planList option").first()).toHaveAttribute(
        "value",
        "Dragon Green · on your wishlist",
      );
      // Only paints from the wishlist are offered.
      await expect(
        page.locator('#planList option[value="Big brush · on your wishlist"]'),
      ).toHaveCount(0);
      await page.fill("#planPaint", "Dragon Green · on your wishlist");
      await submitForm(page);
      const data = await stored(page);
      const paint = data.paints.find((p) => p.name === "Dragon Green");
      expect(paint).toMatchObject({ stock: "Empty", quantity: "0" });
      expect(data.miniatures[0].paints).toEqual([paint.id]);
      expect(data.wishlist.find((w) => w.id === "w").paint).toBe(paint.id);
      expect(data.wishlist).toHaveLength(2); // no new wishlist item
    });

    test("a paint you already have is used, not added again", async ({
      page,
    }) => {
      await pick(page, "#planPaint", "#planList", "abaddon black base");
      await submitForm(page);
      const data = await stored(page);
      expect(data.paints).toHaveLength(1);
      expect(data.miniatures[0].paints).toEqual(["own"]);
      expect(data.wishlist).toHaveLength(2);
    });

    test("cancelling adds nothing", async ({ page }) => {
      await pick(page, "#planPaint", "#planList", "retributor armour base");
      await page.click("#cancelModal");
      const data = await stored(page);
      expect(data.paints).toHaveLength(1);
      expect(data.miniatures).toHaveLength(0);
      expect(data.wishlist).toHaveLength(2);
    });
  });
});

test("when the catalogue can't load, the form says so and still works", async ({
  page,
}) => {
  await page.route("**/data/paint-catalogue.js", (route) => route.abort());
  await openSite(page, "#/paints");
  await page.click("#addBtn");
  await page.fill("#catalogueFind", "red");
  await expect(page.locator("#catalogueHint")).toHaveText(
    "The paint catalogue couldn't be loaded.",
  );
  await fillForm(page, { name: "Red" });
  await submitForm(page);
  expect((await stored(page)).paints[0].name).toBe("Red");
});
