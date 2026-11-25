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
  // The board: To do, Building, Priming, Painting, Detailing, Done, so each
  // model counts a fifth more per phase.
  const cards = (...groups) =>
    groups.flatMap(([phase, n], g) =>
      Array.from({ length: n }, (_, i) => ({ id: `c${g}-${i}`, phase })),
    );
  const army = (queueCards, extra = {}, more = {}) => ({
    projects: [{ id: "p", name: "Army", target: "10" }],
    miniatures: [
      { id: "m", name: "Squad", project: "p", quantity: "10", ...extra },
    ],
    queue: [{ id: "q", name: "Squad", miniature: "m", cards: queueCards }],
    ...more,
  });

  test("each model counts its phase's share", async ({ page }) => {
    // Painting is 3 of 5: 0.6 of a model each.
    await seed(page, army(cards(["Painting", 10])));
    await expect(dashboardPercent(page, "Army")).toHaveText("60%");
    expect(await progressCell(page, "Army")).toBe("60%");
  });

  test("models in different phases count separately", async ({ page }) => {
    // 6 at 3/5 and 4 at 4/5: (18 + 16) / 5 = 6.8 models, 68%.
    await seed(page, army(cards(["Painting", 6], ["Detailing", 4])));
    expect(await progressCell(page, "Army")).toBe("68%");
  });

  test("an edited board sets the shares", async ({ page }) => {
    // To do, A, B, C, Done: B is 2 of 4.
    await seed(
      page,
      army(cards(["B", 10]), {}, { queueStages: ["A", "B", "C"] }),
    );
    expect(await progressCell(page, "Army")).toBe("50%");
  });

  test("painted models count fully, and the larger count wins", async ({
    page,
  }) => {
    await seed(page, army(cards(["Building", 10]), { painted: "8" }));
    expect(await progressCell(page, "Army")).toBe("80%");
  });

  test("queue items linked only to the project count too", async ({ page }) => {
    await seed(page, {
      projects: [{ id: "p", name: "Army", target: "8" }],
      queue: [
        { id: "q", name: "Loose", project: "p", cards: cards(["Done", 4]) },
      ],
    });
    expect(await progressCell(page, "Army")).toBe("50%");
  });

  test("a project whose models are all done is done", async ({ page }) => {
    const past = new Date(Date.now() - 3 * 864e5).toLocaleDateString("en-CA");
    await seed(page, {
      ...army(cards(["Done", 10])),
      projects: [{ id: "p", name: "Army", target: "10", deadline: past }],
    });
    await expect(dashboardPercent(page, "Army")).toHaveText("100%");
    // Done, so its past target date isn't marked overdue.
    await expect(
      page.locator("#projectSummary .project", { hasText: "Army" }),
    ).not.toContainText("Overdue");
  });

  test("1.x queues count the same way once they're cards", async ({ page }) => {
    // Basecoating, 4 of 10 done, becomes Painting 6 and Detailing 4: 68%.
    await seed(page, {
      schemaVersion: 5,
      ...army([]),
      queue: [
        {
          id: "q",
          name: "Squad",
          miniature: "m",
          stage: "Basecoating",
          stageDone: 4,
        },
      ],
    });
    expect(await progressCell(page, "Army")).toBe("68%");
  });
});

test.describe("rewards", () => {
  const data = {
    projects: [{ id: "p", name: "Army", target: "10" }],
    miniatures: [{ id: "m", name: "Squad", project: "p", quantity: "10" }],
    queue: [
      // 9 at Painting (3/5) and 1 at Priming (2/5): 5.8 models, 58%.
      {
        id: "q",
        name: "Squad",
        miniature: "m",
        cards: [
          ...Array.from({ length: 9 }, (_, i) => ({
            id: `c${i}`,
            phase: "Painting",
          })),
          { id: "c9", phase: "Priming" },
        ],
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
  // Moves the last model on to Painting: 6 models, 60%.
  const plusOne = (page) =>
    page.getByRole("button", { name: "Move Squad on to Painting" });

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
    await plusOne(page).click(); // 60%
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
