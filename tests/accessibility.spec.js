// Automated accessibility checks (axe-core, WCAG 2.1 and 2.2, A and AA) on every
// section, the add/edit form and the queue completion prompt, with enough
// data that badges, chips, markers and buttons all appear.
const { default: AxeBuilder } = require("@axe-core/playwright");
const {
  test,
  expect,
  SITE,
  seed,
  nav,
  fillForm,
  submitForm,
  imageFile,
} = require("./helpers");

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};

const data = {
  paints: [
    {
      id: "red",
      name: "Red",
      brand: "Acme",
      type: "Base",
      remaining: "80",
      colour: "#cc0000",
      price: "4",
    },
    {
      id: "black",
      name: "Black",
      brand: "Acme",
      type: "Base",
      remaining: "10",
      colour: "#111111",
    },
  ],
  tools: [
    {
      id: "t",
      name: "Brush",
      category: "Brush",
      condition: "Good",
      quantity: "2",
      price: "6",
    },
  ],
  projects: [
    {
      id: "p",
      name: "Army",
      system: "Skirmish",
      target: "20",
      budget: "100",
      deadline: day(-2),
    },
    {
      id: "p2",
      name: "Later",
      system: "Battle",
      target: "5",
      deadline: day(4),
    },
  ],
  miniatures: [
    {
      id: "m",
      name: "Squad",
      project: "p",
      quantity: "10",
      painted: "3",
      status: "Built",
      paints: ["red", "black"],
    },
  ],
  queue: [
    {
      id: "q",
      name: "Squad",
      miniature: "m",
      project: "p",
      stage: "Basing",
      models: "10",
      due: day(-1),
    },
    { id: "q2", name: "Hero", stage: "Priming", models: "1", due: day(3) },
    {
      id: "q3",
      name: "Split squad",
      models: "5",
      stage: "Priming",
      split: { Priming: 2, Basecoating: 2, Complete: 1 },
    },
  ],
  wishlist: [
    {
      id: "w",
      name: "Big pot",
      category: "Paint",
      priority: "High",
      price: "5",
      url: "https://example.com/pot",
    },
    { id: "w2", name: "Rulebook", category: "Book" },
    // Rewards for project p: one unlocked, one locked.
    { id: "w3", name: "Paint set", rewardFor: "p", rewardAt: "0" },
    { id: "w4", name: "Big knight", rewardFor: "p", rewardAt: "100" },
  ],
  // A library technique with a level and date, and one of your own with a
  // goal, so every kind of skill card and suggestion appears.
  skills: [
    { id: "s1", name: "Layering", level: 4, changed: "2020-01-01" },
    { id: "s2", name: "Sculpting", level: 2, goal: "Finish a bust" },
    { id: "s3", name: "Glazing", level: 9 },
  ],
};

async function violations(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} -> ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
}

for (const viewport of [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "phone", size: { width: 375, height: 812 } },
]) {
  test.describe(`${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    test.beforeEach(async ({ page }) => {
      // Served over HTTP: axe reads the stylesheet, and WebKit blocks a page
      // opened from file:// from reading other local files.
      await page.goto(SITE);
      await seed(page, data);
    });

    for (const section of [
      "dashboard",
      "paints",
      "tools",
      "miniatures",
      "projects",
      "queue",
      "skills",
      "wishlist",
    ]) {
      test(`${section} has no accessibility violations`, async ({ page }) => {
        await nav(page, section);
        expect(await violations(page)).toEqual([]);
      });
    }

    test("the add/edit form has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "miniatures");
      await page.locator("button[data-edit]").first().click();
      expect(await violations(page)).toEqual([]);
    });

    test("the completion prompt has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "queue");
      await page.locator("#queueContent button[data-edit]").first().click();
      await fillForm(page, { stage: "Complete" });
      await submitForm(page);
      await expect(page.locator("#completeDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the skill level guide and own-skill box have no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "skills");
      await page.click(".levelguide summary");
      await page.selectOption("#skillAdd select", "other");
      await expect(page.locator("#skillAdd input")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the photo viewer has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "miniatures");
      await page.locator("button[data-photos]").first().click();
      await page
        .locator("#photoFile")
        .setInputFiles([
          await imageFile(page, "a.png", 400, 300),
          await imageFile(page, "b.png", 300, 400),
        ]);
      await expect(page.locator("#photoStrip button")).toHaveCount(2);
      expect(await violations(page)).toEqual([]);
    });

    test("the reward notice has no accessibility violations", async ({
      page,
    }) => {
      // Show it as if a change had just unlocked the reward.
      await page.evaluate(() => {
        newRewards = ["w3"];
        renderRewardNotice();
      });
      await expect(page.locator("#rewardNotice .notice")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the stage editor has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "queue");
      await page.click("#stagesBtn");
      await expect(page.locator("#stagesDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the Bought prompt has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "wishlist");
      await page.getByRole("button", { name: "Bought: Rulebook" }).click();
      await expect(page.locator("#boughtDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the keyboard shortcuts list has no accessibility violations", async ({
      page,
    }) => {
      await page.click("#keysBtn");
      await expect(page.locator("#keysDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}
