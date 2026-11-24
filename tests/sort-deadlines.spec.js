const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
} = require("./helpers");

// A date `offset` days from today, as the browser's date inputs store it.
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};
// A column's values as shown; for a count with +/- buttons, just the
// number ("" when it isn't set), and for a project's name, without the
// rewards line under it.
const column = (page, i) =>
  tableRows(page).evaluateAll(
    (rows, i) =>
      rows.map((r) => {
        let cell = r.cells[i].cloneNode(true),
          v = cell.querySelector(".stepval");
        cell.querySelector(".under")?.remove();
        return v
          ? v.querySelector(".sr-only")
            ? ""
            : v.textContent
          : cell.textContent;
      }),
    i,
  );
const header = (page, label) =>
  page.locator("#content thead button", { hasText: label });

test.beforeEach(async ({ page }) => openApp(page));

test.describe("sorting", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      paints: [
        { id: "1", name: "beta", quantity: "10", type: "Layer" },
        { id: "2", name: "Alpha", quantity: "2", type: "Base" },
        { id: "3", name: "gamma", quantity: "", type: "Base" },
      ],
      projects: [
        { id: "p1", name: "One" },
        { id: "p2", name: "Two" },
      ],
      miniatures: [
        { id: "m1", name: "a", project: "p2", quantity: "5", painted: "4" },
        { id: "m2", name: "b", project: "p1", quantity: "5", painted: "1" },
      ],
    });
    await nav(page, "paints");
  });

  test("text sorts A-Z ignoring case, then Z-A", async ({ page }) => {
    await header(page, "Paint name").click();
    expect(await column(page, 0)).toEqual(["Alpha", "beta", "gamma"]);
    await expect(page.locator("#content thead th").first()).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await header(page, "Paint name").click();
    expect(await column(page, 0)).toEqual(["gamma", "beta", "Alpha"]);
    await expect(header(page, "Paint name")).toHaveText("Paint name ▼");
  });

  test("numbers sort numerically with blanks last both ways", async ({
    page,
  }) => {
    await header(page, "Quantity").click();
    expect(await column(page, 4)).toEqual(["2", "10", ""]);
    await header(page, "Quantity").click();
    expect(await column(page, 4)).toEqual(["10", "2", ""]);
  });

  test("sorting doesn't change the stored order", async ({ page }) => {
    await header(page, "Paint name").click();
    expect((await stored(page)).paints.map((p) => p.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  test("sorting applies to filtered rows", async ({ page }) => {
    await page.selectOption("#filter", "Base");
    await header(page, "Paint name").click();
    await header(page, "Paint name").click();
    expect(await column(page, 0)).toEqual(["gamma", "Alpha"]);
  });

  test("calculated columns sort too", async ({ page }) => {
    await nav(page, "projects");
    await header(page, "Painted").click();
    expect(await column(page, 0)).toEqual(["One", "Two"]);
    await header(page, "Painted").click();
    expect(await column(page, 0)).toEqual(["Two", "One"]);
  });

  test("changing section resets the sort", async ({ page }) => {
    await header(page, "Paint name").click();
    await nav(page, "tools");
    await nav(page, "paints");
    expect(await column(page, 0)).toEqual(["beta", "Alpha", "gamma"]);
    await expect(header(page, "Paint name")).toHaveText("Paint name");
  });
});

test.describe("deadline markers", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      projects: [
        { id: "late", name: "Late", target: "10", deadline: day(-3) },
        { id: "soon", name: "Soon", target: "10", deadline: day(5) },
        { id: "far", name: "Far", target: "10", deadline: day(30) },
        { id: "done", name: "Done", target: "1", deadline: day(-3) },
        { id: "none", name: "None", target: "10", deadline: "" },
        { id: "junk", name: "Junk", target: "10", deadline: "next week" },
      ],
      miniatures: [
        {
          id: "m",
          name: "Finished",
          project: "done",
          quantity: "1",
          painted: "1",
        },
      ],
      queue: [
        { id: "q1", name: "Behind", stage: "Basing", due: day(-1) },
        { id: "q2", name: "Finished late", stage: "Complete", due: day(-1) },
        { id: "q3", name: "Today", stage: "Basing", due: day(0) },
        { id: "q4", name: "Tomorrow", stage: "Basing", due: day(1) },
      ],
    });
  });

  test("projects table marks overdue and due-soon targets", async ({
    page,
  }) => {
    await nav(page, "projects");
    const markers = await tableRows(page).evaluateAll((rows) =>
      rows.map((r) => r.cells[8].querySelector(".pill")?.textContent ?? ""),
    );
    // Sorted by target date: Late and Done (3 days ago; Done has no marker),
    // Soon, Far, then the junk date, then none.
    expect(markers).toEqual(["Overdue", "", "Due in 5 days", "", "", ""]);
  });

  test("the dashboard marks projects the same way", async ({ page }) => {
    const summary = page.locator("#projectSummary .project");
    await expect(summary.nth(0).locator(".pill")).toHaveText("Overdue");
    await expect(summary.nth(1).locator(".pill")).toHaveText("Due in 5 days");
    await expect(summary.nth(3).locator(".pill")).toHaveCount(0); // done
  });

  test("queue items are marked until complete", async ({ page }) => {
    await nav(page, "queue");
    const markers = await page
      .locator(".qitem")
      .evaluateAll((items) =>
        items.map((q) => q.querySelector(".pill")?.textContent ?? ""),
      );
    expect(markers).toEqual(["Overdue", "", "Due today", "Due in 1 day"]);
  });
});

test("each list opens sorted so what needs attention comes first", async ({
  page,
}) => {
  await seed(page, {
    paints: [
      { id: "p1", name: "Full pot", stock: "Full" },
      { id: "p2", name: "Empty pot", stock: "Empty" },
    ],
    tools: [
      { id: "t1", name: "New brush", condition: "New" },
      { id: "t2", name: "Old brush", condition: "Replace soon" },
    ],
    miniatures: [
      { id: "m1", name: "Done", status: "Complete" },
      { id: "m2", name: "Box", status: "Unbuilt" },
    ],
    projects: [
      { id: "a", name: "Later", deadline: "2030-06-01" },
      { id: "b", name: "Sooner", deadline: "2030-01-01" },
      { id: "c", name: "Whenever", deadline: "" },
    ],
    wishlist: [
      { id: "w1", name: "Maybe", priority: "Low" },
      { id: "w2", name: "Unrated" },
      { id: "w3", name: "Must have", priority: "High" },
    ],
  });
  const firstColumn = () => column(page, 0);
  const sorted = () =>
    page.locator(
      '#content th[aria-sort="ascending"], #content th[aria-sort="descending"]',
    );
  for (const [section, header, order] of [
    ["paints", "Stock ▲", ["Empty pot", "Full pot"]],
    ["tools", "Condition ▲", ["Old brush", "New brush"]],
    ["miniatures", "Status ▲", ["Box", "Done"]],
    ["projects", "Target date ▲", ["Sooner", "Later", "Whenever"]],
    ["wishlist", "Priority ▼", ["Must have", "Maybe", "Unrated"]],
  ]) {
    await nav(page, section);
    await expect(sorted(page), section).toHaveText([header]);
    expect(await firstColumn(), section).toEqual(order);
  }
  // Sorting only changes the display; the saved order is untouched.
  expect((await stored(page)).paints.map((p) => p.id)).toEqual(["p1", "p2"]);
});
