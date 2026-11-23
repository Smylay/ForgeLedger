// Split by stage: a queue item's models at different stages.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  importBackup,
} = require("./helpers");

const item = (page, i) => page.locator("#queueContent .qitem").nth(i);
const toggle = (page, i) => item(page, i).locator("button[data-split]");
const move = (page, i, stage) =>
  item(page, i).getByRole("button", { name: `Move 1 to ${stage} from` });
const queued = async (page, i) => (await stored(page)).queue[i];

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 3,
    miniatures: [{ id: "m", name: "Squad", quantity: "5" }],
    queue: [
      // 5 models (from the miniature), 2 already done with Basecoating.
      {
        id: "a",
        name: "Squad",
        miniature: "m",
        stage: "Basecoating",
        stageDone: 2,
      },
      { id: "b", name: "Hero", stage: "Priming" }, // 1 model: no split
      {
        id: "c",
        name: "Mixed",
        models: "5",
        stage: "Priming",
        stageDone: 3,
        split: { Priming: 2, Basecoating: 3 },
      },
    ],
  });
  await nav(page, "queue");
});

test("the toggle shows on unfinished items with more than one model", async ({
  page,
}) => {
  await expect(toggle(page, 0)).toHaveAttribute("aria-pressed", "false");
  await expect(toggle(page, 0)).toHaveAccessibleName("Split by stage: Squad");
  await expect(toggle(page, 1)).toHaveCount(0);
  await expect(toggle(page, 2)).toHaveAttribute("aria-pressed", "true");
});

test("splitting keeps the progress so far, with Undo", async ({ page }) => {
  await toggle(page, 0).click();
  expect(await queued(page, 0)).toMatchObject({
    split: { Basecoating: 3, Detailing: 2 },
    stage: "Basecoating",
    stageDone: 2,
  });
  await expect(item(page, 0).locator(".splitrow")).toHaveText(
    "Basecoating 3Move 1 to DetailingDetailing 2Move 1 to Basing",
  );
  await expect(toggle(page, 0)).toBeFocused();
  // Next and +1 make way for the per-stage buttons.
  await expect(item(page, 0).locator("[data-next], [data-plus]")).toHaveCount(
    0,
  );
  await expect(page.locator("#toastText")).toHaveText('Split "Squad" by stage');
  await page.click("#toastAction");
  expect((await queued(page, 0)).split).toBeUndefined();
});

test("Move 1 moves a model on and keeps the stage in step", async ({
  page,
}) => {
  await move(page, 2, "Basecoating").click();
  expect(await queued(page, 2)).toMatchObject({
    split: { Priming: 1, Basecoating: 4 },
    stage: "Priming",
    stageDone: 4,
  });
  await expect(page.locator("#toastText")).toHaveText(
    '"Mixed": 1 moved to Basecoating (Priming 1 · Basecoating 4)',
  );
  await expect(move(page, 2, "Basecoating")).toBeFocused();
  // The last model leaves Priming: focus follows it to the next stage.
  await page.keyboard.press("Enter");
  expect(await queued(page, 2)).toMatchObject({
    split: { Basecoating: 5 },
    stage: "Basecoating",
    stageDone: 0,
  });
  await expect(move(page, 2, "Detailing")).toBeFocused();
  await page.click("#toastAction");
  expect((await queued(page, 2)).split).toEqual({
    Priming: 1,
    Basecoating: 4,
  });
});

test("the progress bar shows the mix", async ({ page }) => {
  const bar = item(page, 2).locator("[role=progressbar]");
  // Priming 2, Basecoating 3: the average model is at step 2.6 of 6.
  await expect(bar).toHaveAttribute("aria-valuenow", "2.6");
  await expect(bar).toHaveAttribute(
    "aria-valuetext",
    "Priming 2 · Basecoating 3",
  );
  const widths = await bar
    .locator("i")
    .evaluateAll((els) => els.map((e) => e.style.width));
  // Each step fills with the share of models past it: all 5 are past
  // Building, the 3 at Basecoating are past Priming, none are further on.
  expect(widths).toEqual(["100%", "60%", "0%", "0%", "0%", "0%"]);
  await expect(item(page, 2)).toContainText("Split by stage · 5 model(s)");
});

test("the last model reaching Complete asks about the miniature", async ({
  page,
}) => {
  await toggle(page, 0).click();
  // Basecoating 3, Detailing 2: move everything through to Complete.
  for (const [stage, times] of [
    ["Detailing", 3],
    ["Basing", 5],
    ["Complete", 5],
  ])
    for (let t = 0; t < times; t++) await move(page, 0, stage).click();
  expect(await queued(page, 0)).toMatchObject({
    split: { Complete: 5 },
    stage: "Complete",
  });
  await expect(page.locator("#completeDialog")).toBeVisible();
  await page.click('#completeDialog button[value="skip"]');
  await expect(item(page, 0).locator("button[data-split]")).toHaveCount(0);
  await expect(item(page, 0).locator(".splitrow")).toHaveCount(0);
});

test("joining puts every model at the least advanced stage", async ({
  page,
}) => {
  await toggle(page, 2).click();
  const q = await queued(page, 2);
  expect(q.split).toBeUndefined();
  expect(q).toMatchObject({ stage: "Priming", stageDone: 3 });
  await expect(page.locator("#toastText")).toHaveText(
    'Joined "Mixed": Priming, 3 of 5 done',
  );
  await expect(item(page, 2)).toContainText("Priming: 3 of 5 done");
  await page.click("#toastAction");
  expect((await queued(page, 2)).split).toEqual({
    Priming: 2,
    Basecoating: 3,
  });
});

test.describe("editing a split item", () => {
  test("more models start at Not started; fewer come off the least advanced", async ({
    page,
  }) => {
    await item(page, 2).locator("button[data-edit]").click();
    await fillForm(page, { models: "7" });
    await submitForm(page);
    expect(await queued(page, 2)).toMatchObject({
      split: { "Not started": 2, Priming: 2, Basecoating: 3 },
      stage: "Not started",
      stageDone: 5,
    });
    await item(page, 2).locator("button[data-edit]").click();
    await fillForm(page, { models: "4" });
    await submitForm(page);
    expect(await queued(page, 2)).toMatchObject({
      split: { Priming: 1, Basecoating: 3 },
      stage: "Priming",
    });
  });

  test("choosing another stage puts every model there", async ({ page }) => {
    await item(page, 2).locator("button[data-edit]").click();
    await fillForm(page, { stage: "Basing" });
    await submitForm(page);
    const q = await queued(page, 2);
    expect(q.split).toBeUndefined();
    expect(q).toMatchObject({ stage: "Basing", stageDone: 0 });
  });
});

test("the dashboard shows where the models are", async ({ page }) => {
  await nav(page, "dashboard");
  await expect(page.locator("#queueSummary")).toContainText(
    "Mixed Priming 2 · Basecoating 3",
  );
});

test("odd stored counts are read safely", async ({ page }, testInfo) => {
  await importBackup(
    page,
    {
      schemaVersion: 3,
      queue: [
        {
          id: "x",
          name: "Odd",
          models: "4",
          split: {
            Priming: "lots",
            Basecoating: -2,
            Basing: 2.7,
            Nowhere: 9,
            constructor: 1,
          },
        },
        { id: "y", name: "Not an object", models: "3", split: [1, 2] },
      ],
    },
    testInfo,
  );
  await expect(page.locator("#toast")).toHaveText("Backup imported");
  await nav(page, "queue");
  // Basing 2 (2.7 rounded down); the 2 missing models start at Not started.
  await expect(item(page, 0).locator("[role=progressbar]")).toHaveAttribute(
    "aria-valuetext",
    "Not started 2 · Basing 2",
  );
  // An array isn't a split.
  await expect(toggle(page, 1)).toHaveAttribute("aria-pressed", "false");
});

test.describe("on a touch screen", () => {
  // Firefox can't emulate a phone; Chromium and WebKit cover the CSS.
  test.skip(({ browserName }) => browserName === "firefox", "no isMobile");
  test.use({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 412, height: 915 },
  });

  test("queue buttons are at least 44px tall", async ({ page }) => {
    const heights = await page
      .locator("#queueContent .qactions .btn, #queueContent .splitstage .btn")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(3);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});
