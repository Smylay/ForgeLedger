const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  addItem,
  modalOpen,
  tableRows,
} = require("./helpers");

test.beforeEach(async ({ page }) => openApp(page));

const field = (page, name) => page.locator(`#formFields [name="${name}"]`);
const isValid = (locator) => locator.evaluate((e) => e.checkValidity());

test.describe("search", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      paints: [
        { id: "zzid1", name: "Red", brand: "", notes: "for eyes" },
        { id: "zzid2", name: "Blue", brand: "", notes: "" },
      ],
      projects: [{ id: "proj1", name: "Ultras" }],
      miniatures: [{ id: "m1", name: "Squad", project: "proj1" }],
    });
  });

  test("field names and hidden ids don't match", async ({ page }) => {
    await nav(page, "paints");
    for (const q of ["brand", "notes", "zzid"]) {
      await page.fill("#search", q);
      await expect(tableRows(page), q).toHaveCount(0);
    }
  });

  test("any field value matches, including notes", async ({ page }) => {
    await nav(page, "paints");
    await page.fill("#search", "EYES");
    await expect(tableRows(page)).toHaveCount(1);
    await expect(tableRows(page).first()).toContainText("Red");
  });

  test("miniatures can be found by project name", async ({ page }) => {
    await nav(page, "miniatures");
    await page.fill("#search", "ultras");
    await expect(tableRows(page)).toHaveCount(1);
  });
});

test.describe("filter", () => {
  test("keeps its choice after saving an item", async ({ page }) => {
    await nav(page, "paints");
    await page.selectOption("#filter", "Base");
    await page.click("#addBtn");
    await fillForm(page, { name: "Green", type: "Base" });
    await submitForm(page);
    await expect(page.locator("#filter")).toHaveValue("Base");
    await expect(tableRows(page)).toHaveCount(1);
  });

  test("resets when switching sections", async ({ page }) => {
    await addItem(page, "paints", { name: "A", type: "Other" });
    await page.selectOption("#filter", "Other");
    await nav(page, "tools");
    await nav(page, "paints");
    await expect(page.locator("#filter")).toHaveValue("");
  });

  test("only matches its own field", async ({ page }) => {
    await addItem(page, "paints", { name: "Medium", type: "Layer" });
    await page.selectOption("#filter", "Medium");
    await expect(tableRows(page)).toHaveCount(0);
  });

  test("tools filter by category", async ({ page }) => {
    await addItem(page, "tools", { name: "Size 2", category: "Brush" });
    await addItem(page, "tools", { name: "Knife", category: "Cutting" });
    await expect(page.locator("#filter option").first()).toHaveText(
      "Category: all",
    );
    await page.selectOption("#filter", "Cutting");
    await expect(tableRows(page)).toHaveCount(1);
    await expect(tableRows(page).first()).toContainText("Knife");
  });

  test("projects filter offers the game systems in use", async ({ page }) => {
    await seed(page, {
      projects: [
        { id: "1", name: "A", system: "Skirmish" },
        { id: "2", name: "B", system: "Battle" },
        { id: "3", name: "C", system: "" },
      ],
    });
    await nav(page, "projects");
    await expect(page.locator("#filter option")).toHaveText([
      "Game system: all",
      "Battle",
      "Skirmish",
    ]);
  });

  test("every list section has a filter", async ({ page }) => {
    for (const section of [
      "paints",
      "tools",
      "miniatures",
      "projects",
      "wishlist",
    ]) {
      await nav(page, section);
      await expect(page.locator("#filter"), section).toBeVisible();
      await expect(page.locator("#filter option").first(), section).toHaveText(
        /^[A-Z][a-z ]+: all$/,
      );
    }
  });
});

test.describe("form limits", () => {
  test("painted count can't exceed the model count", async ({ page }) => {
    await nav(page, "miniatures");
    await page.click("#addBtn");
    await fillForm(page, { name: "Squad", quantity: "10", painted: "15" });
    await submitForm(page);
    expect(await modalOpen(page)).toBe(true);
    expect(
      await field(page, "painted").evaluate((e) => e.validationMessage),
    ).toBe("Can't be more than the model count.");

    await fillForm(page, { quantity: "15" });
    await submitForm(page);
    expect(await modalOpen(page)).toBe(false);
    expect((await stored(page)).miniatures[0]).toMatchObject({
      quantity: "15",
      painted: "15",
    });
  });

  test("painted count is free when no model count is given", async ({
    page,
  }) => {
    await addItem(page, "miniatures", { name: "Squad", painted: "3" });
    expect((await stored(page)).miniatures[0].painted).toBe("3");
  });

  const limits = [
    [
      "miniatures",
      "quantity",
      [
        ["2", true],
        ["2.5", false],
        ["-1", false],
      ],
    ],
    [
      "skills",
      "level",
      [
        ["7", true],
        ["12", false],
        ["4.5", false],
      ],
    ],
    [
      "tools",
      "price",
      [
        ["4.99", true],
        ["-1", false],
      ],
    ],
  ];
  for (const [section, name, cases] of limits) {
    test(`${section} ${name} limits`, async ({ page }) => {
      await nav(page, section);
      await page.click("#addBtn");
      for (const [value, valid] of cases) {
        await field(page, name).fill(value);
        expect(await isValid(field(page, name)), value).toBe(valid);
      }
    });
  }
});

test.describe("paint colour", () => {
  test("a new paint has no colour unless one is picked", async ({ page }) => {
    await addItem(page, "paints", { name: "Plain", stock: "Low" });
    expect((await stored(page)).paints[0].colour).toBe("");
    await nav(page, "dashboard");
    await expect(page.locator("#stockSummary .colour")).toHaveCSS(
      "background-color",
      "rgb(119, 119, 119)",
    );
  });

  test("picking a colour saves it; No colour clears it", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await fillForm(page, { name: "Red", colour: "#ff0000" });
    await expect(page.locator('[data-nocolour="colour"]')).not.toBeChecked();
    await submitForm(page);
    expect((await stored(page)).paints[0].colour).toBe("#ff0000");

    await page.click("button[data-edit]");
    await expect(field(page, "colour")).toHaveValue("#ff0000");
    await page.check('[data-nocolour="colour"]');
    await submitForm(page);
    expect((await stored(page)).paints[0].colour).toBe("");
  });
});

test.describe("deleting a project", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      projects: [{ id: "P1", name: "Ultras" }],
      miniatures: [{ id: "m1", name: "Squad", project: "P1" }],
      queue: [{ id: "q1", name: "Squad", project: "P1" }],
    });
  });

  test("unlinks its miniatures and queue items, and Undo relinks", async ({
    page,
  }) => {
    await nav(page, "projects");
    await page.click("button[data-del]");
    await expect(page.locator("#toastText")).toHaveText(
      'Deleted "Ultras" and unlinked 2 item(s) from it',
    );
    let data = await stored(page);
    expect(data.miniatures[0].project).toBe("");
    expect(data.queue[0].project).toBe("");

    await page.click("#toastAction");
    data = await stored(page);
    expect(data.projects).toHaveLength(1);
    expect(data.miniatures[0].project).toBe("P1");
    expect(data.queue[0].project).toBe("P1");
  });

  test("a link to a project that no longer exists shows blank", async ({
    page,
  }) => {
    await seed(page, {
      miniatures: [{ id: "m1", name: "Squad", project: "gone" }],
    });
    await nav(page, "miniatures");
    await expect(tableRows(page).first().locator("td").nth(2)).toHaveText("");
  });
});

test("blank prices show blank, and unknown stock has no level", async ({
  page,
}) => {
  await addItem(page, "paints", { name: "Red" });
  await addItem(page, "tools", { name: "Knife" });
  await expect(tableRows(page).first().locator("td").nth(4)).toHaveText("");
  await nav(page, "paints");
  await expect(
    tableRows(page).first().locator('[aria-pressed="true"]'),
  ).toHaveCount(0);
});

test("the Dashboard nav item has no count badge", async ({ page }) => {
  await expect(page.locator('#nav a[data-sec="dashboard"] .count')).toHaveCount(
    0,
  );
});

test("visible controls all have accessible names", async ({ page }) => {
  for (const section of ["paints", "skills"]) {
    await nav(page, section);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("input, select")]
        .filter((e) => e.checkVisibility())
        .filter((e) => !e.labels?.length && !e.getAttribute("aria-label"))
        .map((e) => e.id || e.name || e.type),
    );
    expect(unnamed, section).toEqual([]);
  }
});

test.describe("paint swatches", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      schemaVersion: 2,
      paints: [
        { id: "a", name: "Red", colour: "#cc0000" },
        { id: "b", name: "Plain", colour: "" },
        { id: "c", name: "Odd", colour: "red; width:999px" },
      ],
    });
    await nav(page, "paints");
  });

  test("each paint's colour shows beside its name", async ({ page }) => {
    const dots = page.locator("#content tbody td:first-child .colour");
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveCSS("background-color", "rgb(204, 0, 0)");
    await expect(tableRows(page).nth(0).locator("td").first()).toHaveText(
      "Red",
    );
  });

  test("no colour, or an invalid one, shows a hollow dot", async ({ page }) => {
    const dots = page.locator("#content tbody td:first-child .colour");
    for (const i of [1, 2]) {
      await expect(dots.nth(i)).toHaveClass(/none/);
      await expect(dots.nth(i)).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
    }
  });
});

test("editing keeps fields the form doesn't show", async ({ page }) => {
  await seed(page, {
    schemaVersion: 2,
    paints: [{ id: "a", name: "Old", remaining: "40", stock: "Half" }],
  });
  await nav(page, "paints");
  await page.click("button[data-edit]");
  await fillForm(page, { name: "Renamed" });
  await submitForm(page);
  expect((await stored(page)).paints[0]).toMatchObject({
    name: "Renamed",
    remaining: "40",
    stock: "Half",
  });
});
