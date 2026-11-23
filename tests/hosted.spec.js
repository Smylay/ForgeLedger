// The app served over HTTP, as on a home server, rather than from file://.
const {
  test,
  reload,
  expect,
  SITE,
  openSite,
  seed,
  stored,
  addItem,
  nav,
  tableRows,
  imageFile,
} = require("./helpers");

test("the site root opens the app on the dashboard", async ({ page }) => {
  await page.goto(SITE);
  await expect(page).toHaveURL(SITE + "forgeledger_v2.html");
  await expect(page.locator("#title")).toHaveText("Dashboard");
  await expect(page.locator("#metrics .card")).toHaveCount(4);
});

test("data saved on the server copy survives a reload", async ({ page }) => {
  await openSite(page);
  await addItem(page, "paints", { name: "Hosted paint" });
  await reload(page);
  await expect(page.locator("#content")).toContainText("Hosted paint");
  expect((await stored(page)).paints[0].name).toBe("Hosted paint");
});

test("page addresses work when hosted", async ({ page }) => {
  await openSite(page, "#/queue");
  await expect(page.locator("#title")).toHaveText("Painting queue");
  await nav(page, "skills");
  expect(new URL(page.url()).hash).toBe("#/skills");
  await page.goBack();
  await expect(page.locator("#title")).toHaveText("Painting queue");
});

test("two tabs on the server copy stay in sync", async ({ page, context }) => {
  const other = await context.newPage();
  await openSite(page);
  await openSite(other);
  await addItem(page, "paints", { name: "From tab A" });
  await expect(other.locator("#toastText")).toHaveText(
    "Updated with changes from another tab",
  );
  await addItem(other, "paints", { name: "From tab B" });
  expect((await stored(page)).paints.map((p) => p.name)).toEqual([
    "From tab A",
    "From tab B",
  ]);
});

// Photos work when served too, as on a home server.
test("photos can be added when hosted", async ({ page }) => {
  await openSite(page);
  await seed(page, {
    schemaVersion: 5,
    miniatures: [{ id: "m", name: "Squad" }],
  });
  await nav(page, "miniatures");
  await page.getByRole("button", { name: "Photos: Squad" }).click();
  await expect(page.locator("#photosUnavailable")).toBeHidden();
  await page
    .locator("#photoFile")
    .setInputFiles([await imageFile(page, "a.png", 400, 300)]);
  await expect(page.locator("#photoView img")).toHaveAttribute("src", /^blob:/);
  expect((await stored(page)).miniatures[0].photos).toHaveLength(1);
  await page.click("#closePhotos");
  await expect(tableRows(page).first().locator("img.thumb")).toHaveAttribute(
    "src",
    /^blob:/,
  );
});
