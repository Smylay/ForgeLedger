// Project progress counts work in progress (each model by its queue
// stage), and wishlist items can be rewards that unlock at a project %.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
  fillForm,
  submitForm,
  importBackup,
} = require("./helpers");

const progressCell = async (page, name) => {
  await nav(page, "projects");
  const row = tableRows(page).filter({ hasText: name });
  return row.locator("td").nth(3).textContent();
};
const dashboardPercent = (page, name) =>
  page
    .locator("#projectSummary .project", { hasText: name })
    .locator(".projectfoot span");

test.beforeEach(async ({ page }) => openApp(page));

test.describe("progress counts work in progress", () => {
  const army = (queue, extra = {}) => ({
    schemaVersion: 5,
    projects: [{ id: "p", name: "Army", target: "10" }],
    miniatures: [
      { id: "m", name: "Squad", project: "p", quantity: "10", ...extra },
    ],
    queue,
  });

  test("each model counts its stage's share", async ({ page }) => {
    // Basecoating is step 3 of 6: half done.
    await seed(
      page,
      army([{ id: "q", name: "Squad", miniature: "m", stage: "Basecoating" }]),
    );
    await expect(dashboardPercent(page, "Army")).toHaveText("50%");
    expect(await progressCell(page, "Army")).toBe("50%");
  });

  test("models done in a stage count at the next one", async ({ page }) => {
    // 6 at step 3, 4 at step 4: (18 + 16) / 6 = 5.67 models, 56%.
    await seed(
      page,
      army([
        {
          id: "q",
          name: "Squad",
          miniature: "m",
          stage: "Basecoating",
          stageDone: 4,
        },
      ]),
    );
    expect(await progressCell(page, "Army")).toBe("56%");
  });

  test("a split item counts each model at its own stage", async ({ page }) => {
    // 2 at step 2, 3 at step 4, 5 at step 6: 46 / 6 = 7.67 models, 76%.
    await seed(
      page,
      army([
        {
          id: "q",
          name: "Squad",
          miniature: "m",
          stage: "Priming",
          split: { Priming: 2, Detailing: 3, Complete: 5 },
        },
      ]),
    );
    expect(await progressCell(page, "Army")).toBe("76%");
  });

  test("an item's own stages set its steps", async ({ page }) => {
    // Middle stages A, B, C: B is step 2 of 4.
    await seed(
      page,
      army([
        {
          id: "q",
          name: "Squad",
          miniature: "m",
          stage: "B",
          stages: ["A", "B", "C"],
        },
      ]),
    );
    expect(await progressCell(page, "Army")).toBe("50%");
  });

  test("painted models count fully, and the larger count wins", async ({
    page,
  }) => {
    await seed(
      page,
      army([{ id: "q", name: "Squad", miniature: "m", stage: "Building" }], {
        painted: "8",
      }),
    );
    expect(await progressCell(page, "Army")).toBe("80%");
  });

  test("queue items linked only to the project count too", async ({ page }) => {
    await seed(page, {
      schemaVersion: 5,
      projects: [{ id: "p", name: "Army", target: "8" }],
      queue: [
        {
          id: "q",
          name: "Loose",
          project: "p",
          models: "4",
          stage: "Complete",
        },
      ],
    });
    expect(await progressCell(page, "Army")).toBe("50%");
  });

  test("a project whose work is all complete is done", async ({ page }) => {
    const past = new Date(Date.now() - 3 * 864e5).toLocaleDateString("en-CA");
    await seed(page, {
      ...army([{ id: "q", name: "Squad", miniature: "m", stage: "Complete" }]),
      projects: [{ id: "p", name: "Army", target: "10", deadline: past }],
    });
    await expect(dashboardPercent(page, "Army")).toHaveText("100%");
    // Done, so its past target date isn't marked overdue.
    await expect(
      page.locator("#projectSummary .project", { hasText: "Army" }),
    ).not.toContainText("Overdue");
  });
});

test.describe("rewards", () => {
  const data = {
    schemaVersion: 5,
    projects: [{ id: "p", name: "Army", target: "10" }],
    miniatures: [{ id: "m", name: "Squad", project: "p", quantity: "10" }],
    queue: [
      // Step 3 of 6 with 5 of 10 done: (15 + 20) / 6 = 5.83, 58%.
      {
        id: "q",
        name: "Squad",
        miniature: "m",
        stage: "Basecoating",
        stageDone: 5,
      },
    ],
    wishlist: [
      {
        id: "w",
        name: "Big knight",
        category: "Miniature",
        rewardFor: "p",
        rewardAt: "60",
      },
      { id: "w2", name: "Full set", rewardFor: "p", rewardAt: "" },
      { id: "w3", name: "Brush" },
    ],
  };
  const notice = (page) => page.locator("#rewardNotice");
  const plusOne = (page) => page.locator("#queueContent button[data-plus]");

  test.beforeEach(async ({ page }) => seed(page, data));

  test("the wishlist shows each reward locked or unlocked", async ({
    page,
  }) => {
    await nav(page, "wishlist");
    const rewards = await tableRows(page).evaluateAll((rows) =>
      rows.map((r) => r.cells[3].textContent),
    );
    // A blank % means the whole project.
    expect(rewards).toEqual([
      "Locked Army: 58% of 60%",
      "Locked Army: 58% of 100%",
      "",
    ]);
  });

  test("the form sets a reward", async ({ page }) => {
    await nav(page, "wishlist");
    await tableRows(page).nth(2).locator("button[data-edit]").click();
    await fillForm(page, { rewardFor: "p", rewardAt: "50" });
    await submitForm(page);
    expect((await stored(page)).wishlist[2]).toMatchObject({
      rewardFor: "p",
      rewardAt: "50",
    });
    await expect(tableRows(page).nth(2)).toContainText(
      "Unlocked Army reached 50%",
    );
  });

  test("a change that crosses the line announces the reward", async ({
    page,
  }) => {
    await nav(page, "queue");
    await expect(notice(page)).toBeEmpty();
    await plusOne(page).click(); // 6 of 10 done: 60%
    await expect(notice(page)).toContainText(
      "Reward unlocked: Big knight. Army reached 60%.",
    );
    // It stays on other pages until dismissed.
    await nav(page, "paints");
    await expect(notice(page)).toContainText("Big knight");
    await page.getByRole("button", { name: "Dismiss: Big knight" }).click();
    await expect(notice(page)).toBeEmpty();
    // The dashboard still lists it, ready to buy.
    await nav(page, "dashboard");
    await expect(
      page.locator("#rewardSummary .rewardline").first(),
    ).toContainText("Big knight Unlocked Army reached 60%");
    await expect(
      page.locator("#rewardSummary").getByRole("button", {
        name: "Bought: Big knight",
      }),
    ).toBeVisible();
  });

  test("Undo locks it again and takes the notice away", async ({ page }) => {
    await nav(page, "queue");
    await plusOne(page).click();
    await expect(notice(page)).toContainText("Big knight");
    await page.click("#toastAction");
    await expect(notice(page)).toBeEmpty();
  });

  test("Bought from the notice uses the wishlist's Bought", async ({
    page,
  }) => {
    await nav(page, "queue");
    await plusOne(page).click();
    await page.getByRole("button", { name: "Bought: Big knight" }).click();
    const after = await stored(page);
    expect(after.wishlist.map((w) => w.name)).toEqual(["Full set", "Brush"]);
    expect(after.miniatures.map((m) => m.name)).toContain("Big knight");
    await expect(notice(page)).toBeEmpty();
  });

  test("importing a backup doesn't announce its rewards", async ({
    page,
  }, testInfo) => {
    await importBackup(
      page,
      { ...data, wishlist: [{ ...data.wishlist[0], rewardAt: "10" }] },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    await expect(notice(page)).toBeEmpty();
  });

  test("deleting the project ends the reward", async ({ page }) => {
    await nav(page, "projects");
    await page.click("button[data-del]");
    expect((await stored(page)).wishlist[0].rewardFor).toBe("");
    await nav(page, "wishlist");
    await expect(tableRows(page).first().locator("td").nth(3)).toHaveText("");
  });
});
