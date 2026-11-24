const {
  test,
  expect,
  openApp,
  stored,
  nav,
  fillForm,
  addItem,
  tableRows,
  downloadText,
  importBackup,
} = require("./helpers");

// Breaks out of an HTML attribute and sets window[flag] if it runs.
const attack = (flag) => `x"><img src=x onerror="window.${flag}=1">`;

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
    ].filter((f) => window[f]),
  );
  expect(ran).toEqual([]);
});

test("records with unusual ids can still be edited and deleted", async ({
  page,
}, testInfo) => {
  const odd = `a"b'c<d>&e`;
  await importBackup(page, { paints: [{ id: odd, name: "Odd" }] }, testInfo);
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
  await importBackup(
    page,
    { skills: [{ id: "s", name: "Odd", level: "lots" }] },
    testInfo,
  );
  await nav(page, "skills");
  await expect(page.locator(".skilltop strong")).toHaveText("0/9 · Not tried");
});

test.describe("wishlist links", () => {
  test("only http(s) addresses become links", async ({ page }, testInfo) => {
    await importBackup(
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
  await importBackup(
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
  await importBackup(
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
    ["boughtName", "boughtUrl", "boughtNotes"].filter((f) => window[f]),
  );
  expect(ran).toEqual([]);
  // The hostile "link" isn't http(s), so it isn't copied into the notes.
  expect((await stored(page)).paints[0].notes).toBe(attack("boughtNotes"));
});

test("photo ids and names can't run script", async ({ page }, testInfo) => {
  await importBackup(
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
    ["photoName", "photoId", "photoKey"].filter((f) => window[f]),
  );
  expect(ran).toEqual([]);
});

test("rewards can't run script", async ({ page }, testInfo) => {
  await importBackup(
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
  await page.click("#queueContent button[data-next]");
  await page.waitForTimeout(200);
  const ran = await page.evaluate(() =>
    ["rewardProject", "rewardName", "rewardAt", "rewardProjectId"].filter(
      (f) => window[f],
    ),
  );
  expect(ran).toEqual([]);
});

test("the Used in list can't run script", async ({ page }, testInfo) => {
  await importBackup(
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
    ].filter((f) => window[f]),
  );
  expect(ran).toEqual([]);
});
