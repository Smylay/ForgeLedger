// A project's own page (#/projects/<id>): its progress, miniatures and where
// their models are on the board, photos, and its wishlist items and
// rewards. Plus the wishlist's Project field.
const {
  test,
  reload,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  tableRows,
} = require("./helpers");

const view = (page) => page.locator("#projectContent");
const section = (page, title) =>
  view(page).locator("section.card", {
    has: page.getByRole("heading", { name: title }),
  });

const data = {
  paints: [{ id: "red", name: "Red", stock: "Low" }],
  projects: [
    {
      id: "p",
      name: "Iron",
      faction: "Iron Guard",
      system: "Grimdark",
      budget: "100",
      notes: "Line one\nLine two",
    },
    { id: "p2", name: "Other" },
  ],
  miniatures: [
    {
      id: "m1",
      name: "Squad",
      project: "p",
      quantity: "3",
      painted: "1",
      status: "In progress",
      price: "30",
      paints: ["red"],
      photos: ["ph1"],
    },
    { id: "m2", name: "Hero", project: "p", quantity: "1", status: "Unbuilt" },
    { id: "m3", name: "Stranger", project: "p2", quantity: "1" },
  ],
  queue: [
    {
      id: "a",
      name: "Squad",
      miniature: "m1",
      cards: [
        { id: "a1", phase: "Painting" },
        { id: "a2", phase: "Done" },
      ],
    },
    {
      id: "u",
      name: "Banner",
      project: "p",
      cards: [{ id: "u1", phase: "Priming", photo: "ph2" }],
    },
  ],
  wishlist: [
    {
      id: "w1",
      name: "Tank",
      project: "p",
      category: "Miniature",
      priority: "High",
      price: "50",
    },
    { id: "w2", name: "Treat", rewardFor: "p", rewardAt: "100", price: "9" },
    { id: "w3", name: "Not ours", project: "p2" },
  ],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  // The photos the data uses (their bytes don't matter here).
  await page.evaluate(() =>
    putPhotos(
      ["ph1", "ph2"].map((id) => ({
        id,
        type: "image/jpeg",
        full: new ArrayBuffer(4),
        thumb: new ArrayBuffer(4),
        added: Date.now(),
      })),
    ),
  );
  await seed(page, data);
});

async function openIron(page) {
  await nav(page, "projects");
  await page.locator("#content").getByRole("link", { name: "Iron" }).click();
  await expect(page).toHaveURL(/#\/projects\/p$/);
}

test("a project's name opens its page; All projects and Back return", async ({
  page,
}) => {
  await openIron(page);
  await expect(page.locator("#title")).toHaveText("Iron");
  await expect(page.locator("#subtitle")).toHaveText("Iron Guard · Grimdark");
  await expect(page).toHaveTitle("Iron · ForgeLedger");
  await expect(page.locator('#nav a[data-sec="projects"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#addBtn")).toBeHidden();
  await page.getByRole("link", { name: "← All projects" }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(tableRows(page)).toHaveCount(2);
  await page.goBack();
  await expect(page.locator("#title")).toHaveText("Iron");
  // Reloading keeps the page.
  await reload(page);
  await expect(page.locator("#title")).toHaveText("Iron");
  await expect(section(page, "Miniatures")).toBeVisible();
});

test("its progress, miniatures, where they are on the board, and notes", async ({
  page,
}) => {
  await openIron(page);
  const metrics = view(page).locator(".metric");
  await expect(metrics.nth(1)).toContainText("Painted1 of 4");
  await expect(metrics.nth(2)).toContainText("£30.00 of £100.00");
  await expect(metrics.nth(3)).toContainText("None");
  await expect(section(page, "Progress")).toContainText(
    "On the board: Priming 1 · Painting 1 · Done 1.",
  );
  const minis = section(page, "Miniatures").locator(".pmini");
  // Its own miniatures, then units on the board with no miniature.
  await expect(minis).toHaveCount(3);
  await expect(minis.nth(0)).toContainText("Squad");
  await expect(minis.nth(0)).toContainText("In progress");
  await expect(minis.nth(0)).toContainText(
    "1 of 3 painted · on the board: Painting 1 · Done 1",
  );
  await expect(minis.nth(0)).toContainText("Low paint: Red (Low)");
  await expect(minis.nth(1)).toContainText("Hero");
  await expect(minis.nth(2)).toContainText("Banner");
  await expect(minis.nth(2)).toContainText("Priming 1");
  await expect(section(page, "Miniatures")).not.toContainText("Stranger");
  await expect(section(page, "Notes")).toHaveText("NotesLine one\nLine two");
  // Add 1 works here, and the page redraws.
  await page
    .getByRole("button", { name: "Add 1 model of Hero to the board" })
    .click();
  await expect(minis.nth(1)).toContainText("on the board: To do 1");
});

test("every photo of its miniatures and models, each opening its viewer", async ({
  page,
}) => {
  await openIron(page);
  const gallery = section(page, "Photos").locator(".gallery button");
  await expect(gallery).toHaveCount(2);
  await expect(gallery.nth(0)).toHaveAttribute(
    "aria-label",
    "Photo 1 of Squad",
  );
  await expect(gallery.nth(1)).toHaveAttribute("aria-label", "Photo of Banner");
  await expect(gallery.nth(0).locator("img")).toHaveAttribute("src", /^blob:/);
  await gallery.nth(0).click();
  await expect(page.locator("#photosTitle")).toHaveText('Photos of "Squad"');
  await page.click("#closePhotos");
  await gallery.nth(1).click();
  await expect(page.locator("#photosTitle")).toHaveText('Photo of "Banner"');
});

test("its wishlist items and rewards, with Bought and adding more", async ({
  page,
}) => {
  await openIron(page);
  const wishes = section(page, "Wishlist and rewards");
  await expect(wishes.locator(".rewardline")).toHaveCount(2);
  await expect(wishes).toContainText("Tank");
  await expect(wishes).toContainText("Miniature · High priority · £50.00");
  await expect(wishes).toContainText("Treat");
  await expect(wishes).not.toContainText("Not ours");
  await expect(wishes).toContainText("Expected cost: £59.00");
  // A locked reward can't be bought yet.
  await expect(
    wishes.getByRole("button", { name: "Bought: Treat" }),
  ).toHaveCount(0);

  // Bought on a miniature for the project puts it in the project.
  await wishes.getByRole("button", { name: "Bought: Tank" }).click();
  const tank = (await stored(page)).miniatures.find((m) => m.name === "Tank");
  expect(tank.project).toBe("p");
  await expect(section(page, "Miniatures")).toContainText("Tank");
  await expect(wishes).not.toContainText("Tank");

  // Add wishlist item opens the form with the project chosen.
  await wishes.getByRole("button", { name: "Add wishlist item" }).click();
  await expect(page.locator('#formFields [name="project"]')).toHaveValue("p");
  await fillForm(page, { name: "Banner pole" });
  await submitForm(page);
  await expect(wishes).toContainText("Banner pole");
  await expect(page.locator("#title")).toHaveText("Iron");
});

test("Edit project changes it in place", async ({ page }) => {
  await openIron(page);
  await page.getByRole("button", { name: "Edit project" }).click();
  await fillForm(page, { name: "Iron Legion" });
  await submitForm(page);
  await expect(page.locator("#title")).toHaveText("Iron Legion");
  await expect(page).toHaveTitle("Iron Legion · ForgeLedger");
});

test("an address for a project that isn't there shows the list", async ({
  page,
}) => {
  await page.evaluate(() => (location.hash = "#/projects/nope"));
  await expect(tableRows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/#\/projects$/);
  await page.evaluate(() => (location.hash = "#/projects/%E0%A4%A"));
  await expect(tableRows(page)).toHaveCount(2);
});

test("a project deleted elsewhere takes its page back to the list", async ({
  page,
}) => {
  await openIron(page);
  await page.evaluate(() => {
    db.projects = db.projects.filter((p) => p.id !== "p");
    render();
  });
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(tableRows(page)).toHaveCount(1);
});

test("projects link to their pages from the dashboard and other tables", async ({
  page,
}) => {
  await page
    .locator("#projectSummary")
    .getByRole("link", { name: "Iron" })
    .click();
  await expect(page.locator("#title")).toHaveText("Iron");
  await nav(page, "miniatures");
  await page.locator("#content").getByRole("link", { name: "Other" }).click();
  await expect(page.locator("#title")).toHaveText("Other");
  await expect(section(page, "Miniatures")).toContainText("Stranger");
});

test.describe("the wishlist's Project field", () => {
  test("is in the form, the search, and cleared when the project goes", async ({
    page,
  }) => {
    await nav(page, "wishlist");
    await page.fill("#search", "other");
    await expect(tableRows(page)).toHaveCount(1);
    await expect(tableRows(page).first()).toContainText("Not ours");
    await page.fill("#search", "");
    await page.locator('button[data-edit="w3"]').click();
    await expect(page.locator('#formFields [name="project"]')).toHaveValue(
      "p2",
    );
    await page.click("#cancelModal");
    await nav(page, "projects");
    await page.locator('button[data-del="p2"]').click();
    expect(
      (await stored(page)).wishlist.find((w) => w.id === "w3").project,
    ).toBe("");
  });
});
