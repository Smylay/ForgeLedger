// Editable queue stages: the default list, and an item's own list.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  importBackup,
} = require("./helpers");

const item = (page, i) => page.locator("#queueContent .qitem").nth(i);
const editor = (page) => page.locator("#stagesDialog");
const names = (page) =>
  page
    .locator("#stageList li[data-row] input")
    .evaluateAll((els) => els.map((e) => e.value));
const row = (page, n) => page.locator("#stageList li[data-row]").nth(n);
const save = (page) => page.click('#stagesDialog button[value="save"]');
const queued = async (page) => (await stored(page)).queue;

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 4,
    queue: [
      { id: "a", name: "Squad", models: "5", stage: "Priming", stageDone: 2 },
      { id: "b", name: "Hero", models: "1", stage: "Detailing" },
      {
        id: "c",
        name: "Tank",
        models: "1",
        stage: "Rust",
        stages: ["Building", "Rust", "Weathering"],
      },
      {
        id: "d",
        name: "Split",
        models: "4",
        stage: "Priming",
        split: { Priming: 1, Detailing: 3 },
      },
    ],
  });
  await nav(page, "queue");
});

test("the editor lists the default stages between the fixed ends", async ({
  page,
}) => {
  await page.click("#stagesBtn");
  await expect(editor(page)).toBeVisible();
  await expect(page.locator("#stagesTitle")).toHaveText("Default stages");
  expect(await names(page)).toEqual([
    "Building",
    "Priming",
    "Basecoating",
    "Detailing",
    "Basing",
  ]);
  await expect(page.locator("#stageList li.fixed")).toHaveText([
    "Not started",
    "Complete",
  ]);
  await expect(row(page, 0).locator("[data-sup]")).toBeDisabled();
  await expect(row(page, 4).locator("[data-sdown]")).toBeDisabled();
  await expect(row(page, 1).locator("input")).toHaveAccessibleName(
    "Name of stage 2",
  );
});

test("renaming a default stage renames it on every item that uses it", async ({
  page,
}) => {
  await page.click("#stagesBtn");
  await row(page, 1).locator("input").fill("Undercoat");
  await save(page);
  await expect(editor(page)).toBeHidden();
  const q = await queued(page);
  expect((await stored(page)).queueStages).toEqual([
    "Building",
    "Undercoat",
    "Basecoating",
    "Detailing",
    "Basing",
  ]);
  // The count in the renamed stage is kept.
  expect(q[0]).toMatchObject({ stage: "Undercoat", stageDone: 2 });
  expect(q[3].split).toEqual({ Undercoat: 1, Detailing: 3 });
  // An item with its own stages isn't touched.
  expect(q[2]).toMatchObject({ stage: "Rust" });
  await expect(item(page, 0)).toContainText("Undercoat: 2 of 5 done");
  await expect(page.locator("#toastText")).toHaveText(
    "Saved the default stages",
  );
  await expect(page.locator("#stagesBtn")).toBeFocused();
  await page.click("#toastAction");
  expect((await queued(page))[0].stage).toBe("Priming");
});

test("reordering, adding and deleting stages", async ({ page }) => {
  await page.click("#stagesBtn");
  // Basing up above Detailing; focus stays on the moved row's button.
  await row(page, 4).locator("[data-sup]").click();
  await expect(row(page, 3).locator("[data-sup]")).toBeFocused();
  // Delete Detailing (now last): items at it move to the stage before it,
  // as no stage is kept after it.
  await row(page, 4).locator("[data-sdel]").click();
  await page.click("#addStage");
  await expect(row(page, 4).locator("input")).toBeFocused();
  await row(page, 4).locator("input").fill("Varnish");
  await save(page);
  expect((await stored(page)).queueStages).toEqual([
    "Building",
    "Priming",
    "Basecoating",
    "Basing",
    "Varnish",
  ]);
  const q = await queued(page);
  expect(q[1]).toMatchObject({ stage: "Basing", stageDone: 0 });
  expect(q[3].split).toEqual({ Priming: 1, Basing: 3 });
  await expect(page.locator("#toastText")).toHaveText(
    "Saved the default stages; 2 item(s) moved on from a deleted stage",
  );
  // The progress bar has a step for each stage after Not started.
  await expect(item(page, 0).locator(".stages span")).toHaveCount(6);
});

test("a deleted stage's items move to the next stage kept", async ({
  page,
}) => {
  await page.click("#stagesBtn");
  await row(page, 1).locator("[data-sdel]").click(); // Priming
  await expect(row(page, 1).locator("[data-sdel]")).toBeFocused();
  await save(page);
  const q = await queued(page);
  expect(q[0]).toMatchObject({ stage: "Basecoating", stageDone: 0 });
  expect(q[3].split).toEqual({ Basecoating: 1, Detailing: 3 });
});

test("names are checked before saving", async ({ page }) => {
  await page.click("#stagesBtn");
  const input = (n) => row(page, n).locator("input");
  const message = (n) => input(n).evaluate((e) => e.validationMessage);
  await input(0).fill("   ");
  await save(page);
  expect(await message(0)).toBe("Give this stage a name.");
  // A repeated name is flagged where it appears the second time.
  await input(0).fill("priming");
  await save(page);
  expect(await message(1)).toBe("Another stage already has this name.");
  await input(0).fill("Complete");
  await save(page);
  expect(await message(0)).toBe(
    '"Complete" is always the first or last stage.',
  );
  await expect(editor(page)).toBeVisible();
  await page.click('#stagesDialog button[value="cancel"]');
  expect((await stored(page)).queueStages).toBeUndefined();
});

test("the last stage can't be deleted", async ({ page }) => {
  await page.click("#stagesBtn");
  for (let i = 0; i < 4; i++) await row(page, 0).locator("[data-sdel]").click();
  await expect(row(page, 0).locator("[data-sdel]")).toBeDisabled();
  await expect(row(page, 0).locator("input")).toBeFocused();
});

test("Cancel and Esc change nothing", async ({ page }) => {
  await page.click("#stagesBtn");
  await row(page, 0).locator("input").fill("Changed");
  await page.keyboard.press("Escape");
  await expect(editor(page)).toBeHidden();
  expect((await stored(page)).queueStages).toBeUndefined();
});

test.describe("an item's own stages", () => {
  test("start as a copy of the default, and only change that item", async ({
    page,
  }) => {
    await item(page, 0)
      .getByRole("button", { name: "Stages for Squad" })
      .click();
    await expect(page.locator("#stagesTitle")).toHaveText('Stages for "Squad"');
    await expect(page.locator("#resetStages")).toBeHidden();
    await row(page, 2).locator("[data-sdel]").click(); // Basecoating
    await save(page);
    const q = await queued(page);
    expect(q[0].stages).toEqual(["Building", "Priming", "Detailing", "Basing"]);
    expect((await stored(page)).queueStages).toBeUndefined();
    await expect(item(page, 0)).toContainText("own stages");
    await expect(item(page, 0).locator(".stages span")).toHaveCount(5);
    await expect(item(page, 1).locator(".stages span")).toHaveCount(6);
  });

  test("drive Next, the form and the progress bar", async ({ page }) => {
    // Tank: Building, Rust, Weathering, at Rust.
    await expect(item(page, 2).locator("button[data-next]")).toHaveText(
      "Next: Weathering",
    );
    await expect(item(page, 2).locator(".stages span")).toHaveCount(4);
    await item(page, 2).locator("button[data-edit]").click();
    const options = await page
      .locator('#formFields select[name="stage"] option')
      .evaluateAll((os) => os.map((o) => o.textContent));
    expect(options).toEqual([
      "Select...",
      "Not started",
      "Building",
      "Rust",
      "Weathering",
      "Complete",
    ]);
  });

  test("aren't changed by editing the default", async ({ page }) => {
    await page.click("#stagesBtn");
    await row(page, 0).locator("input").fill("Assembly");
    await save(page);
    expect((await queued(page))[2].stages).toEqual([
      "Building",
      "Rust",
      "Weathering",
    ]);
  });

  test("can go back to the default stages", async ({ page }) => {
    await item(page, 2)
      .getByRole("button", { name: "Stages for Tank" })
      .click();
    await page.click("#resetStages");
    await expect(editor(page)).toBeHidden();
    const tank = (await queued(page))[2];
    expect(tank.stages).toBeUndefined();
    // Rust was the 2nd of its stages: it becomes the default's 2nd.
    expect(tank.stage).toBe("Priming");
    await expect(page.locator("#toastText")).toHaveText(
      '"Tank" uses the default stages again',
    );
  });
});

test("stored stage lists are read safely", async ({ page }, testInfo) => {
  await importBackup(
    page,
    {
      schemaVersion: 4,
      queueStages: ["Build", " build ", "", 7, "Complete", "Paint"],
      queue: [
        { id: "x", name: "Odd", stage: "Paint", stages: "not a list" },
        { id: "y", name: "Empty", stage: "Paint", stages: [] },
      ],
    },
    testInfo,
  );
  await expect(page.locator("#toast")).toHaveText("Backup imported");
  await nav(page, "queue");
  // Duplicates, blanks, non-text and end stages are dropped; a list with
  // nothing usable means the default.
  await expect(item(page, 0).locator("[role=progressbar]")).toHaveAttribute(
    "aria-valuetext",
    "Paint: 0 of 1 done, step 2 of 3",
  );
  await expect(item(page, 1)).not.toContainText("own stages");
});

test("stage names can't run script", async ({ page }) => {
  const attack = `x"><img src=x onerror="window.stageRan=1">`;
  // Short enough to be kept whole, for the Back button that names it.
  const short = `"><img src=x onerror=window.stageRan=1>`;
  await seed(page, {
    schemaVersion: 4,
    queueStages: ["Build", attack, short, "Paint"],
    queue: [
      { id: "a", name: "Item", models: "2", stage: attack },
      { id: "b", name: "Later", models: "2", stage: "Paint" },
    ],
  });
  await expect(item(page, 1).locator("button[data-back]")).toHaveText(
    `Back: ${short}`,
  );
  await nav(page, "queue");
  await item(page, 0).locator("button[data-edit]").click();
  await page.keyboard.press("Escape");
  await page.click("#stagesBtn");
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.stageRan)).toBeUndefined();
  // Names are cut to 40 characters, and shown as typed, not as markup.
  await expect(row(page, 1).locator("input")).toHaveValue(attack.slice(0, 40));
});
