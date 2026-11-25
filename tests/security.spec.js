const {
  test,
  expect,
  openApp,
  stored,
  seed,
  nav,
  fillForm,
  addItem,
  tableRows,
  downloadText,
  importBackup,
  importAndWait,
} = require("./helpers");

// Breaks out of an HTML attribute and sets window.xss_<flag> if it runs.
// The prefix keeps flags apart from the app's own global names.
const attack = (flag) => `x"><img src=x onerror="window.xss_${flag}=1">`;

test.beforeEach(async ({ page }) => openApp(page));

test("values from an imported backup can't run script", async ({
  page,
}, testInfo) => {
  await importBackup(
    page,
    {
      paints: [
        {
          id: attack("paintId"),
          name: attack("paintName"),
          stock: "Low", // low, so the dashboard and recipe chips show it
          colour: attack("colour"),
        },
        { id: "p2", name: "Odd stock", stock: attack("stock") },
      ],
      // The recipe and queue link point at the paint and miniature above,
      // so recipe chips and low-paint warnings render the hostile name.
      miniatures: [
        { id: attack("miniId"), name: "Mini", paints: [attack("paintId")] },
      ],
      projects: [{ id: attack("projectId"), name: "Project" }],
      queue: [
        { id: attack("queueId"), name: "Queued", miniature: attack("miniId") },
        {
          id: "split",
          name: "Split",
          models: "3",
          split: { [attack("splitKey")]: 1, Priming: attack("splitCount") },
        },
      ],
      // A level of 0 and no library match put this skill in the profile,
      // the practice suggestions (with its goal) and its card.
      skills: [
        {
          id: attack("skillId"),
          name: attack("skillName"),
          level: attack("level"),
          goal: attack("goal"),
          changed: attack("changed"),
        },
      ],
      wishlist: [{ id: "w", name: "Link", url: attack("url") }],
    },
    testInfo,
  );
  await expect(page.locator("#toast")).toHaveText("Backup imported");

  for (const section of [
    "dashboard",
    "paints",
    "miniatures",
    "queue",
    "skills",
    "wishlist",
  ])
    await nav(page, section);
  await nav(page, "miniatures");
  await page.click("#addBtn"); // the project <select> lists project ids
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200); // let any injected <img> fail to load

  const ran = await page.evaluate(() =>
    [
      "paintId",
      "paintName",
      "colour",
      "miniId",
      "projectId",
      "queueId",
      "splitKey",
      "splitCount",
      "skillId",
      "skillName",
      "level",
      "goal",
      "changed",
      "url",
      "stock",
    ].filter((f) => window["xss_" + f]),
  );
  expect(ran).toEqual([]);
});

test("records with unusual ids can still be edited and deleted", async ({
  page,
}, testInfo) => {
  const odd = `a"b'c<d>&e`;
  await importAndWait(page, { paints: [{ id: odd, name: "Odd" }] }, testInfo);
  await nav(page, "paints");
  await page.click("button[data-edit]");
  await fillForm(page, { name: "Renamed" });
  await page.click('#itemForm button[type="submit"]');
  expect((await stored(page)).paints).toEqual([
    expect.objectContaining({ id: odd, name: "Renamed" }),
  ]);
  await page.click("button[data-del]");
  expect((await stored(page)).paints).toEqual([]);
});

test("a skill level that isn't a number shows as 0", async ({
  page,
}, testInfo) => {
  await importAndWait(
    page,
    { skills: [{ id: "s", name: "Odd", level: "lots" }] },
    testInfo,
  );
  await nav(page, "skills");
  await expect(page.locator(".skilltop strong")).toHaveText("0/9 · Not tried");
});

test.describe("wishlist links", () => {
  test("only http(s) addresses become links", async ({ page }, testInfo) => {
    await importAndWait(
      page,
      {
        wishlist: [
          { id: "1", name: "Script", url: "javascript:alert(1)" },
          { id: "2", name: "Data", url: "data:text/html,<b>x</b>" },
          { id: "3", name: "Shop", url: "https://example.com/item" },
        ],
      },
      testInfo,
    );
    await nav(page, "wishlist");
    const links = page.locator("#content a");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", "https://example.com/item");
    await expect(links).toHaveAttribute("rel", "noopener noreferrer");
    await expect(tableRows(page).nth(0)).toContainText("javascript:alert(1)");
  });

  test("the URL field only accepts http(s) addresses", async ({ page }) => {
    await nav(page, "wishlist");
    await page.click("#addBtn");
    const url = page.locator('#formFields [name="url"]');
    for (const [value, valid] of [
      ["javascript:alert(1)", false],
      ["ftp://example.com", false],
      ["https://example.com", true],
      ["http://example.com/a?b=c", true],
    ]) {
      await url.fill(value);
      expect(await url.evaluate((e) => e.checkValidity()), value).toBe(valid);
    }
  });
});

test("an invalid colour can't style the stock warning", async ({
  page,
}, testInfo) => {
  await importBackup(
    page,
    {
      paints: [
        { id: "1", name: "Bad", remaining: "5", colour: "red; width:999px" },
        { id: "2", name: "Good", remaining: "5", colour: "#ff0000" },
      ],
    },
    testInfo,
  );
  const swatches = page.locator("#stockSummary .colour");
  await expect(swatches.nth(0)).toHaveCSS(
    "background-color",
    "rgb(119, 119, 119)",
  );
  await expect(swatches.nth(1)).toHaveCSS("background-color", "rgb(255, 0, 0)");
});

test("CSV export can't smuggle spreadsheet formulas", async ({ page }) => {
  for (const name of [
    '=HYPERLINK("http://evil.example","x")',
    "+cmd",
    "@SUM(A1)",
    "-2+3",
  ])
    await addItem(page, "tools", { name });
  await addItem(page, "tools", { name: "Plain", quantity: "5" });
  await nav(page, "tools");
  const csv = await downloadText(page, "#csvBtn");
  expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
  expect(csv).toContain(`"'+cmd"`);
  expect(csv).toContain(`"'@SUM(A1)"`);
  expect(csv).toContain(`"'-2+3"`);
  expect(csv).toContain(`"Plain"`);
  expect(csv).toContain(`"5"`);
});

test("CSV export leaves negative numbers alone", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    { tools: [{ id: "1", name: "Refund", price: "-4.50" }] },
    testInfo,
  );
  await nav(page, "tools");
  const csv = await downloadText(page, "#csvBtn");
  expect(csv).toContain(`"-4.50"`);
  expect(csv).not.toContain(`"'-4.50"`);
});

test("a bought wishlist item carries nothing that can run", async ({
  page,
}, testInfo) => {
  await importAndWait(
    page,
    {
      wishlist: [
        {
          id: "w",
          name: attack("boughtName"),
          category: "Book",
          url: attack("boughtUrl"),
          notes: attack("boughtNotes"),
        },
      ],
    },
    testInfo,
  );
  await nav(page, "wishlist");
  await page.click("button[data-bought]");
  await page.getByRole("radio", { name: "Add it to Paints" }).check();
  await page.click('#boughtDialog button[value="apply"]');
  await nav(page, "paints");
  await page.click("button[data-edit]"); // the notes render in the form
  await page.waitForTimeout(200); // let any injected <img> fail to load
  const ran = await page.evaluate(() =>
    ["boughtName", "boughtUrl", "boughtNotes"].filter(
      (f) => window["xss_" + f],
    ),
  );
  expect(ran).toEqual([]);
  // The hostile "link" isn't http(s), so it isn't copied into the notes.
  expect((await stored(page)).paints[0].notes).toBe(attack("boughtNotes"));
});

test("photo ids and names can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      schemaVersion: 5,
      miniatures: [
        {
          id: "m",
          name: attack("photoName"),
          photos: [attack("photoId"), "ok"],
        },
      ],
      photos: {
        [attack("photoKey")]: { type: "image/png", full: "AAAA" },
      },
    },
    testInfo,
  );
  await nav(page, "miniatures");
  await page.click("button[data-photos]");
  await page.click('#photoStrip [data-pick="1"]');
  await page.waitForTimeout(200); // let any injected <img> fail to load
  const ran = await page.evaluate(() =>
    ["photoName", "photoId", "photoKey"].filter((f) => window["xss_" + f]),
  );
  expect(ran).toEqual([]);
});

test("rewards can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      schemaVersion: 5,
      projects: [
        { id: "p", name: attack("rewardProject"), target: "1" },
        { id: attack("rewardProjectId"), name: "Other" },
      ],
      queue: [{ id: "q", name: "Q", project: "p", stage: "Basing" }],
      wishlist: [
        {
          id: "w",
          name: attack("rewardName"),
          rewardFor: "p",
          rewardAt: attack("rewardAt"),
        },
        { id: "w2", name: "Two", rewardFor: "p", rewardAt: "0" },
        { id: "w3", name: "Three", rewardFor: attack("rewardProjectId") },
      ],
    },
    testInfo,
  );
  // The dashboard's Rewards card, the wishlist's Reward column, and the
  // rewards under each project, with Add reward's form.
  await nav(page, "wishlist");
  await nav(page, "projects");
  await page.getByRole("button", { name: "Add reward for Other" }).click();
  await page.keyboard.press("Escape");
  // Finishing the queue item unlocks the first reward and shows the notice.
  await nav(page, "queue");
  await page.getByRole("button", { name: "Move Q on to Done" }).click();
  await page.waitForTimeout(200);
  const ran = await page.evaluate(() =>
    ["rewardProject", "rewardName", "rewardAt", "rewardProjectId"].filter(
      (f) => window["xss_" + f],
    ),
  );
  expect(ran).toEqual([]);
});

test("the Used in list can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      paints: [{ id: attack("usedPaintId"), name: attack("usedPaint") }],
      projects: [{ id: "p", name: attack("usedProject") }],
      miniatures: [
        {
          id: "m",
          name: attack("usedMini"),
          project: "p",
          status: attack("usedStatus"),
          paints: [attack("usedPaintId")],
        },
      ],
    },
    testInfo,
  );
  await nav(page, "paints");
  await tableRows(page).first().locator("button[data-usedin]").click();
  await expect(page.locator("#usedInDialog li")).toHaveCount(1);
  const ran = await page.evaluate(() =>
    [
      "usedPaintId",
      "usedPaint",
      "usedProject",
      "usedMini",
      "usedStatus",
    ].filter((f) => window["xss_" + f]),
  );
  expect(ran).toEqual([]);
});

test("suggestions can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      paints: [
        {
          id: "p",
          name: "Paint",
          brand: attack("suggestBrand"),
          range: attack("suggestRange"),
        },
      ],
      projects: [
        {
          id: "j",
          name: "Project",
          faction: attack("suggestFaction"),
          system: attack("suggestSystem"),
        },
      ],
    },
    testInfo,
  );
  await nav(page, "paints");
  await page.click("#addBtn");
  // Typing the brand redraws the range suggestions from the stored value.
  await fillForm(page, { brand: attack("suggestBrand") });
  await page.click("#cancelModal");
  await nav(page, "projects");
  await page.click("#addBtn");
  await expect(page.locator("#suggest-system option").first()).toHaveAttribute(
    "value",
    attack("suggestSystem"),
  );
  const ran = await page.evaluate(() =>
    ["suggestBrand", "suggestRange", "suggestFaction", "suggestSystem"].filter(
      (f) => window["xss_" + f],
    ),
  );
  expect(ran).toEqual([]);
});

test("planning recipe paints can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      wishlist: [
        {
          id: attack("planWishId"),
          name: attack("planWish"),
          category: "Paint",
        },
      ],
    },
    testInfo,
  );
  await nav(page, "miniatures");
  await page.click("#addBtn");
  await fillForm(page, { name: "Mini" });
  await page.fill("#planPaint", "x");
  await expect(page.locator("#planList option").first()).toBeAttached();
  const label = await page
    .locator("#planList option")
    .first()
    .getAttribute("value");
  await page.fill("#planPaint", label);
  await page.click('#itemForm button[type="submit"]');
  await page.waitForTimeout(200);
  const ran = await page.evaluate(() =>
    ["planWishId", "planWish"].filter((f) => window["xss_" + f]),
  );
  expect(ran).toEqual([]);
  // The paint it became is named like the wishlist item, as text.
  expect((await stored(page)).paints[0].name).toBe(attack("planWish"));
});

test("tool names on skill cards can't run script", async ({
  page,
}, testInfo) => {
  await importAndWait(
    page,
    {
      skills: [{ id: "s", name: "Airbrushing", level: 1 }],
      tools: [{ id: "t", name: attack("hostileToolName") + " airbrush" }],
      wishlist: [
        {
          id: "w",
          name: attack("hostileWishName") + " compressor",
          category: "Tool",
        },
      ],
    },
    testInfo,
  );
  await nav(page, "skills");
  await expect(page.locator(".needs li")).toHaveCount(2);
  await page.getByRole("button", { name: "Bought: Compressor" }).click();
  await page.waitForTimeout(200);
  const ran = await page.evaluate(() =>
    ["hostileToolName", "hostileWishName"].filter((f) => window["xss_" + f]),
  );
  expect(ran).toEqual([]);
});

test("restocks can't run script", async ({ page }, testInfo) => {
  await importAndWait(
    page,
    {
      paints: [
        {
          id: "p",
          name: "Red",
          restocks: [
            { date: attack("hostileRestockDate"), price: attack("x") },
            { date: { toString: 1 }, price: "1" },
          ],
        },
      ],
    },
    testInfo,
  );
  await nav(page, "paints");
  await page.locator("button[data-edit]").first().click();
  await expect(page.locator("#formFields .restocks li")).toHaveText([
    /£0|no price/,
    "no date · £1.00 Remove",
  ]);
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => window.xss_hostileRestockDate),
  ).toBeUndefined();
});

// JSON can hold an object with its own toString or valueOf key, which would
// make String() or Number() throw. Parsing drops those keys (parseData).
test("values that can't become text don't stop a page drawing", async ({
  page,
}, testInfo) => {
  const odd = { toString: 1, valueOf: 2 };
  await importAndWait(
    page,
    { paints: [{ id: "p", name: odd, brand: odd, price: odd }] },
    testInfo,
  );
  await nav(page, "paints");
  await expect(tableRows(page)).toHaveCount(1);
  await nav(page, "dashboard");
  // Saved data is read the same way.
  await seed(page, { paints: [{ id: "q", name: "Q", brand: odd }] });
  await nav(page, "paints");
  await expect(tableRows(page)).toHaveCount(1);
});

test("unit and phase names on the board can't run script", async ({
  page,
}, testInfo) => {
  // Short enough to be kept whole as a phase name (40 characters).
  const phase = `"><img src=x onerror=xss_phase=1>`;
  await importAndWait(
    page,
    {
      queueStages: ["Build", phase],
      queue: [
        {
          id: attack("hostileUnitId"),
          name: attack("hostileUnitName"),
          cards: [
            { id: attack("hostileCardId"), phase },
            { id: "c2", phase },
          ],
        },
      ],
    },
    testInfo,
  );
  await nav(page, "queue");
  await expect(page.locator("#queueContent .phase h3").nth(2)).toHaveText(
    `${phase} 2`,
  );
  await page.locator("#queueContent button.unitname").click();
  await expect(page.locator("#queueContent .mcard")).toHaveCount(2);
  await page.click('[data-qview="list"]');
  await page.click("#editBoard");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const ran = await page.evaluate(() =>
    ["phase", "hostileUnitId", "hostileUnitName", "hostileCardId"].filter(
      (f) => window["xss_" + f],
    ),
  );
  expect(ran).toEqual([]);
});
