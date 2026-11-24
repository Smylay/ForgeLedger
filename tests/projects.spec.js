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
} = require("./helpers");

// Older backups carry hand-entered `complete` and `spent` on projects; both
// must be ignored in favour of values calculated from linked miniatures.
const data = {
  paints: [{ id: "p1", name: "Red", price: "4" }],
  tools: [{ id: "t1", name: "Brush", price: "6" }],
  miniatures: [
    {
      id: "m1",
      name: "Squad",
      project: "A",
      quantity: "10",
      painted: "4",
      price: "30",
    },
    {
      id: "m2",
      name: "Tank",
      project: "A",
      quantity: "",
      painted: "1",
      price: "45",
    },
    {
      id: "m3",
      name: "Loose",
      project: "",
      quantity: "5",
      painted: "0",
      price: "20",
    },
  ],
  projects: [
    {
      id: "A",
      name: "Linked",
      target: "20",
      complete: "99",
      spent: "999",
      budget: "200",
    },
    {
      id: "B",
      name: "Unlinked",
      target: "",
      complete: "7",
      spent: "50",
      budget: "",
    },
  ],
  queue: [],
  wishlist: [],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, data);
});

test("dashboard progress is calculated from linked miniatures", async ({
  page,
}) => {
  const summary = page.locator("#projectSummary");
  await expect(summary).toContainText(
    "5 of 20 models painted · 11 owned · £75.00 / £200.00",
  );
  await expect(summary).toContainText("Linked25%");
  await expect(summary).toContainText("Unlinked0%");
});

test("recorded spend counts each purchase once", async ({ page }) => {
  await expect(page.locator("#spendSummary")).toContainText("£105.00");
});

test("projects table shows calculated columns", async ({ page }) => {
  await nav(page, "projects");
  await expect(page.locator("#content thead th")).toHaveText([
    "Project name",
    "Faction",
    "Game system",
    "Progress",
    "Painted",
    "Models owned",
    "Target model count",
    "Spent",
    "Target date ▲", // projects open sorted by target date
    "Actions",
  ]);
  await expect(tableRows(page).first().locator("td")).toHaveText([
    /^Linked/, // then its rewards, and Add reward
    "",
    "",
    "25%",
    "5",
    "11",
    "20",
    "£75.00",
    "",
    /Edit/,
  ]);
});

test("project form has no manual completed/spent fields", async ({ page }) => {
  await nav(page, "projects");
  await page.click("button[data-edit]");
  const names = await page
    .locator("#formFields [name]")
    .evaluateAll((els) => els.map((e) => e.name));
  expect(names).toEqual([
    "name",
    "faction",
    "system",
    "target",
    "budget",
    "deadline",
    "notes",
  ]);
});

test("with no target, progress is measured against models owned", async ({
  page,
}) => {
  await seed(page, {
    ...data,
    miniatures: [
      { id: "m", name: "Five", project: "B", quantity: "5", painted: "2" },
    ],
  });
  await expect(page.locator("#projectSummary")).toContainText("Unlinked40%");
});

test.describe("rewards on the projects page", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      projects: [
        { id: "p", name: "Army", target: "4" },
        { id: "q", name: "Other", target: "4" },
      ],
      miniatures: [
        { id: "m", name: "Squad", project: "p", quantity: "4", painted: "2" },
      ],
      wishlist: [
        { id: "w1", name: "Paint set", rewardFor: "p", rewardAt: "50" },
        { id: "w2", name: "Big knight", rewardFor: "p" },
        { id: "w3", name: "Not a reward" },
      ],
    });
    await nav(page, "projects");
  });
  const under = (page, name) =>
    tableRows(page).filter({ hasText: name }).locator(".under");

  test("each project shows its rewards under its name", async ({ page }) => {
    await expect(under(page, "Army").locator(".rewardchip")).toHaveText([
      "Paint set Unlocked",
      "Big knight Unlocks at 100%",
    ]);
    await expect(under(page, "Other").locator(".rewardchip")).toHaveCount(0);
  });

  test("Add reward opens the wishlist form for that project, and stays here", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add reward for Other" }).click();
    await expect(page.locator("#modalTitle")).toHaveText("Add wishlist item");
    await expect(page.locator('#formFields [name="rewardFor"]')).toHaveValue(
      "q",
    );
    await expect(page.locator('#formFields [name="rewardAt"]')).toHaveValue(
      "100",
    );
    await fillForm(page, { name: "Dragon" });
    await submitForm(page);
    // Still on the projects page, now showing the new reward.
    await expect(page.locator("#title")).toHaveText("Army projects");
    await expect(under(page, "Other").locator(".rewardchip")).toHaveText([
      "Dragon Unlocks at 100%",
    ]);
    const added = (await stored(page)).wishlist.at(-1);
    expect(added).toMatchObject({
      name: "Dragon",
      rewardFor: "q",
      rewardAt: "100",
    });
    // The projects table wasn't replaced by the wishlist.
    await expect(page.locator("#content thead th").first()).toHaveText(
      "Project name",
    );
  });
});
