// Automated accessibility checks (axe-core, WCAG 2.1 and 2.2, A and AA) on every
// section, form and dialog, with enough data that badges, chips, markers and
// buttons all appear. They run at desktop and phone sizes in the dark theme,
// and at desktop size in the light theme and each colour theme, which
// mostly change contrast. Contrast doesn't depend on the browser, so the
// colour themes run in Chromium only.
const { default: AxeBuilder } = require("@axe-core/playwright");
const {
  test,
  reload,
  expect,
  openSite,
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
      // So the paint form shows its restocks.
      restocks: [{ date: "2026-01-10", price: "3.5" }],
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
    { id: "t2", name: "Old airbrush", category: "Airbrush" },
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
  // Model cards on the board: a unit spread over phases, one of one, and
  // one with a model done.
  queue: [
    {
      id: "q",
      name: "Squad",
      miniature: "m",
      project: "p",
      due: day(-1),
      cards: [
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `s${i}`,
          phase: "Detailing",
        })),
        { id: "s9", phase: "Done" },
      ],
    },
    {
      id: "q2",
      name: "Hero",
      due: day(3),
      cards: [{ id: "h1", phase: "Priming" }],
    },
    {
      id: "q3",
      name: "Split squad",
      cards: [
        { id: "x1", phase: "Priming" },
        { id: "x2", phase: "Priming" },
        { id: "x3", phase: "Painting" },
        { id: "x4", phase: "Painting" },
        { id: "x5", phase: "Done" },
      ],
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
    // Airbrushing needs an airbrush (owned, below) and a compressor (not),
    // so its card shows tools with and without buttons.
    { id: "s4", name: "Airbrushing", level: 1 },
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

const desktop = { width: 1280, height: 800 };
for (const run of [
  { name: "desktop", size: desktop, theme: "dark" },
  { name: "phone", size: { width: 375, height: 812 }, theme: "dark" },
  { name: "light theme", size: desktop, theme: "light" },
  ...["forest", "ocean", "amethyst", "parchment"].map((theme) => ({
    name: `${theme} theme`,
    size: desktop,
    theme,
    chromiumOnly: true,
  })),
]) {
  test.describe(`${run.name}`, () => {
    test.use({ viewport: run.size });
    test.skip(
      ({ browserName }) => run.chromiumOnly && browserName !== "chromium",
      "Contrast is the same in every browser",
    );

    test.beforeEach(async ({ page }) => {
      // Served over HTTP: axe reads the stylesheet, and WebKit blocks a page
      // opened from file:// from reading other local files.
      await openSite(page);
      await page.evaluate(
        (t) => localStorage.setItem("forgeledger_v2_theme", t),
        run.theme,
      );
      await seed(page, data);
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        run.theme,
      );
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
      await page
        .getByRole("button", { name: "Move all 9 of Squad on to Done" })
        .click();
      await expect(page.locator("#completeDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the board with a unit open, and the list, have no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "queue");
      await page.locator('[data-unit="q3"][data-from="Priming"]').click();
      await expect(page.locator("#queueContent .mcard")).toHaveCount(2);
      expect(await violations(page)).toEqual([]);
      await page.click('[data-qview="list"]');
      await expect(page.locator("#queueContent .qitem")).toHaveCount(3);
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

    test("the example data offer and notice have no accessibility violations", async ({
      page,
    }) => {
      await page.evaluate(() => localStorage.clear());
      await reload(page);
      await expect(page.locator("#startNotice .notice")).toContainText(
        "New to ForgeLedger?",
      );
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: "Load example data" }).click();
      await expect(page.locator("#startNotice .notice")).toContainText(
        "example data",
      );
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

    test("the board editor has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "queue");
      await page.click("#editBoard");
      await expect(page.locator("#phasesDialog")).toBeVisible();
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
      // Through Settings, since the sidebar button is hidden on phones.
      await page.click("#settingsBtn");
      await page.click("#settingsKeysList");
      await expect(page.locator("#keysDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the paint form with catalogue suggestions has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "paints");
      await page.click("#addBtn");
      await page.fill("#catalogueFind", "red");
      await expect(
        page.locator("#catalogueList option").first(),
      ).toBeAttached();
      expect(await violations(page)).toEqual([]);
    });

    test("planning a recipe paint has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "miniatures");
      await page.click("#addBtn");
      await page.fill("#planPaint", "black");
      await expect(page.locator("#planList option").first()).toBeAttached();
      expect(await violations(page)).toEqual([]);
    });

    test("a paint's restocks in its form have no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "paints");
      await page
        .getByRole("row", { name: /Black/ })
        .locator("button[data-edit]")
        .click();
      await expect(page.locator("#formFields .restocks li")).toHaveCount(1);
      expect(await violations(page)).toEqual([]);
    });

    test("the Used in list has no accessibility violations", async ({
      page,
    }) => {
      await nav(page, "paints");
      await page
        .getByRole("button", { name: "Used in 1 miniature: Red" })
        .click();
      await expect(page.locator("#usedInDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("Settings has no accessibility violations", async ({ page }) => {
      await page.click("#settingsBtn");
      await expect(page.locator("#settingsDialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}
