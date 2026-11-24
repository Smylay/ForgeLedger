// Example data: offered on an empty dashboard, loaded with photos, kept or
// cleared; and examples/forgeledger-example.json, which must match it.
const fs = require("fs");
const path = require("path");
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
  importBackup,
} = require("./helpers");

const EXAMPLE = path.join(
  __dirname,
  "..",
  "examples",
  "forgeledger-example.json",
);
const start = (page) => page.locator("#startNotice");
const count = (page, sec) =>
  page.locator(`#nav a[data-sec="${sec}"] .count`).textContent();

test.beforeEach(async ({ page }) => openApp(page));

test("an empty app offers the example data; one with data doesn't", async ({
  page,
}) => {
  await expect(start(page)).toContainText("New to ForgeLedger?");
  await seed(page, { schemaVersion: 5, paints: [{ id: "p", name: "Mine" }] });
  await expect(start(page)).toBeEmpty();
});

test.describe("loaded", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "Load example data" }).click();
    await expect(page.locator("#toastText")).toHaveText("Example data loaded");
  });

  test("fills every section", async ({ page }) => {
    const counts = {};
    for (const sec of [
      "paints",
      "tools",
      "miniatures",
      "projects",
      "queue",
      "skills",
      "wishlist",
    ])
      counts[sec] = await count(page, sec);
    expect(counts).toEqual({
      paints: "11",
      tools: "5",
      miniatures: "5",
      projects: "2",
      queue: "4",
      skills: "11",
      wishlist: "5",
    });
    expect((await stored(page)).demo).toBe(true);
  });

  test("shows off the features", async ({ page }) => {
    // Progress with work in progress, and a reward it unlocked.
    await expect(
      page.locator("#projectSummary .project").first(),
    ).toContainText("36%");
    await expect(page.locator("#rewardSummary")).toContainText(
      "Heavy tank kit Unlocked",
    );
    // Low paints, with one already on the wishlist.
    await expect(page.locator("#stockSummary")).toContainText("Bright Red");
    // Deadlines count from today.
    await nav(page, "queue");
    await expect(page.locator("#queueContent")).toContainText("Due in 5 days");
    await expect(page.locator("#queueContent")).toContainText("Overdue");
    await expect(
      page.locator('#queueContent button[data-split][aria-pressed="true"]'),
    ).toHaveCount(1);
    await expect(page.locator("#queueContent")).toContainText("own stages");
    // Photos are drawn and stored.
    await nav(page, "miniatures");
    await expect(page.locator("#content img.thumb").first()).toHaveAttribute(
      "src",
      /^blob:/,
    );
  });

  test("Keep it makes it your data", async ({ page }) => {
    await expect(start(page)).toContainText("You're looking at example data");
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(start(page)).toBeEmpty();
    expect(await stored(page)).not.toHaveProperty("demo");
  });

  test("Clear it starts fresh, with Undo", async ({ page }) => {
    await page
      .getByRole("button", { name: "Clear it and start fresh" })
      .click();
    expect(await count(page, "paints")).toBe("0");
    expect(await count(page, "skills")).toBe("10"); // the starting skills
    await expect(start(page)).toContainText("New to ForgeLedger?");
    await page.click("#toastAction");
    expect(await count(page, "paints")).toBe("11");
  });

  test("every section fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const sec of [
      "dashboard",
      "paints",
      "tools",
      "miniatures",
      "projects",
      "queue",
      "skills",
      "wishlist",
    ]) {
      await nav(page, sec);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, sec).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("the example file", () => {
  const file = JSON.parse(fs.readFileSync(EXAMPLE, "utf8"));

  test("matches js/demo.js (run `npm run example` if not)", async ({
    page,
  }) => {
    const { photos, ...data } = file;
    const expected = await page.evaluate(() => {
      const [y, m, d] = DEMO_FILE_DATE.split("-").map(Number);
      return demoData(new Date(y, m - 1, d));
    });
    expect(data).toEqual(expected);
    expect(Object.keys(photos)).toEqual(["demo-photo-1", "demo-photo-2"]);
    for (const p of Object.values(photos))
      expect(p).toMatchObject({ type: "image/jpeg" });
  });

  test("imports, photos and all", async ({ page }, testInfo) => {
    await importBackup(page, file, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    await expect(start(page)).toContainText("You're looking at example data");
    await nav(page, "miniatures");
    await expect(page.locator("#content img.thumb").first()).toHaveAttribute(
      "src",
      /^blob:/,
    );
  });
});
