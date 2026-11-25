// Layout on a phone-sized screen: nothing may widen the page, and the
// current section stays visible in the scrolling nav row.
const { test, reload, expect, APP, openApp, seed, nav } = require("./helpers");

const sections = [
  "dashboard",
  "paints",
  "tools",
  "miniatures",
  "projects",
  "queue",
  "skills",
  "wishlist",
];

test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    paints: [
      { id: "p", name: "A paint with a rather long name", remaining: "5" },
    ],
    miniatures: [
      { id: "m", name: "Squad", quantity: "10", paints: ["p"], project: "a" },
    ],
    projects: [{ id: "a", name: "An army with a long name", target: "20" }],
    wishlist: [
      {
        id: "w",
        name: "A reward with a rather long name",
        rewardFor: "a",
        rewardAt: "0",
      },
      { id: "w2", name: "Later", rewardFor: "a", rewardAt: "90" },
    ],
    queue: [
      { id: "q", name: "Squad", miniature: "m", stage: "Basing" },
      {
        id: "s",
        name: "A split squad with a long name",
        models: "10",
        split: { "Not started": 2, Basecoating: 3, Detailing: 4, Basing: 1 },
      },
    ],
  });
});

for (const section of sections) {
  test(`${section} fits the screen width`, async ({ page }) => {
    await nav(page, section);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the current section is scrolled into view in the nav row", async ({
  page,
}) => {
  // Open by address: clicking the link would make Playwright scroll it into
  // view itself and hide a missing scroll.
  await page.goto(APP + "#/wishlist");
  const [link, row] = await Promise.all([
    page.locator('#nav a[data-sec="wishlist"]').boundingBox(),
    page.locator("#nav").boundingBox(),
  ]);
  expect(link.x).toBeGreaterThanOrEqual(row.x);
  expect(link.x + link.width).toBeLessThanOrEqual(row.x + row.width + 1);
});

test("the Settings button is still there, beside the brand", async ({
  page,
}) => {
  await expect(page.locator(".sideinfo")).toBeHidden();
  await expect(page.locator("#keysBtn")).toBeHidden();
  // The brand is a full-width block, so measure its text.
  const brandEnd = await page.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.querySelector(".brand"));
    return r.getBoundingClientRect().right;
  });
  const btn = await page.locator("#settingsBtn").boundingBox();
  expect(btn.x).toBeGreaterThan(brandEnd);
  expect(btn.x + btn.width).toBeLessThanOrEqual(375);
  // Settings holds the shortcuts' off switch and a way to the list.
  await page.click("#settingsBtn");
  await expect(page.locator("#settingsKeysOn")).toBeVisible();
  await page.click("#settingsKeysList");
  await expect(page.locator("#keysDialog")).toBeVisible();
});

test("Settings fits the screen", async ({ page }) => {
  await page.click("#settingsBtn");
  const overflow = await page
    .locator("#settingsDialog")
    .evaluate((d) => d.scrollWidth - d.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the reward notice fits the screen", async ({ page }) => {
  await page.evaluate(() => {
    newRewards = ["w"];
    renderRewardNotice();
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the photo viewer fits the screen", async ({ page }) => {
  await nav(page, "miniatures");
  await page.locator("button[data-photos]").first().click();
  const overflow = await page
    .locator("#photosDialog")
    .evaluate((d) => d.scrollWidth - d.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the board editor's rows fit the screen", async ({ page }) => {
  await nav(page, "queue");
  await page.click("#editBoard");
  const [list, del] = await Promise.all([
    page.locator("#phaseList").boundingBox(),
    page.locator("#phaseList [data-pdel]").first().boundingBox(),
  ]);
  expect(del.x + del.width).toBeLessThanOrEqual(list.x + list.width + 1);
});

test("short pages leave no gap under the header", async ({ page }) => {
  await nav(page, "queue");
  const [side, main] = await Promise.all([
    page.locator(".side").boundingBox(),
    page.locator(".main").boundingBox(),
  ]);
  expect(main.y - (side.y + side.height)).toBeLessThanOrEqual(1);
  expect(side.height).toBeLessThan(200);
});

test.describe("short desktop window", () => {
  test.use({ viewport: { width: 1280, height: 420 } });

  test("the sidebar footer doesn't overlap the nav", async ({ page }) => {
    const [lastLink, foot] = await Promise.all([
      page.locator("#nav a").last().boundingBox(),
      page.locator(".sidefoot").boundingBox(),
    ]);
    expect(foot.y).toBeGreaterThanOrEqual(lastLink.y + lastLink.height);
  });
});

test.describe("laptop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("every table fits without scrolling sideways", async ({ page }) => {
    // The example data has photos, recipes and rewards, so every column is
    // as wide as it gets in normal use.
    await page.evaluate(() => localStorage.clear());
    await reload(page);
    await page.getByRole("button", { name: "Load example data" }).click();
    await expect(page.locator("#startNotice")).toContainText("example data");
    for (const section of [
      "paints",
      "tools",
      "miniatures",
      "projects",
      "wishlist",
    ]) {
      await nav(page, section);
      const overflow = await page
        .locator(".tablewrap")
        .evaluate((t) => t.scrollWidth - t.clientWidth);
      expect(overflow, section).toBeLessThanOrEqual(0);
    }
  });
});
