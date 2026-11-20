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
          remaining: "5",
          colour: attack("colour"),
        },
      ],
      // The recipe and queue link point at the paint and miniature above,
      // so recipe chips and low-paint warnings render the hostile name.
      miniatures: [
        { id: attack("miniId"), name: "Mini", paints: [attack("paintId")] },
      ],
      projects: [{ id: attack("projectId"), name: "Project" }],
      queue: [
        { id: attack("queueId"), name: "Queued", miniature: attack("miniId") },
      ],
      skills: [
        { id: attack("skillId"), name: "Skill", level: attack("level") },
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
      "skillId",
      "level",
      "url",
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
  await expect(page.locator(".skilltop strong")).toHaveText("0/9");
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
