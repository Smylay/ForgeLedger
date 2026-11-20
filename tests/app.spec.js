const {
  test,
  expect,
  openApp,
  stored,
  nav,
  fillForm,
  submitForm,
  addItem,
  modalOpen,
  tableRows,
} = require("./helpers");

test.beforeEach(async ({ page }) => openApp(page));

test.describe("navigation", () => {
  const sections = {
    dashboard: "Dashboard",
    paints: "Paints",
    tools: "Tools",
    miniatures: "Miniatures",
    projects: "Army projects",
    queue: "Painting queue",
    skills: "Skill proficiency",
    wishlist: "Wishlist",
  };
  for (const [key, title] of Object.entries(sections)) {
    test(`${key} renders with the right title and Add button`, async ({
      page,
    }) => {
      await nav(page, key);
      await expect(page.locator("#title")).toHaveText(title);
      await expect(page.locator("#addBtn")).toBeVisible({
        visible: key !== "dashboard",
      });
    });
  }

  test("Add button is hidden on first load", async ({ page }) => {
    await expect(page.locator("#addBtn")).toBeHidden();
  });

  test("switching sections clears the search box", async ({ page }) => {
    await addItem(page, "paints", { name: "Red" });
    await page.fill("#search", "zzz");
    await nav(page, "tools");
    await nav(page, "paints");
    await expect(page.locator("#search")).toHaveValue("");
    await expect(tableRows(page)).toHaveCount(1);
  });
});

test.describe("list collections", () => {
  for (const section of [
    "paints",
    "tools",
    "miniatures",
    "projects",
    "wishlist",
  ]) {
    test(`${section}: add, edit and delete`, async ({ page, dialogs }) => {
      await addItem(page, section, { name: "First" });
      expect((await stored(page))[section]).toHaveLength(1);
      await expect(
        page.locator(`#nav button[data-sec="${section}"] .count`),
      ).toHaveText("1");

      await page.click("button[data-edit]");
      await fillForm(page, { name: "Renamed" });
      await submitForm(page);
      expect((await stored(page))[section][0].name).toBe("Renamed");

      await page.click("button[data-del]");
      expect(dialogs.messages).toHaveLength(1);
      expect((await stored(page))[section]).toHaveLength(0);
    });
  }

  test("declining the delete confirmation keeps the item", async ({
    page,
    dialogs,
  }) => {
    await addItem(page, "paints", { name: "Keep" });
    dialogs.accept = false;
    await page.click("button[data-del]");
    expect((await stored(page)).paints).toHaveLength(1);
  });
});

test.describe("form", () => {
  test("an empty required name blocks saving", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await submitForm(page);
    expect(await modalOpen(page)).toBe(true);
    expect(await stored(page)).toBeNull();
  });

  test("Escape closes the form", async ({ page }) => {
    await nav(page, "paints");
    await page.click("#addBtn");
    await page.keyboard.press("Escape");
    expect(await modalOpen(page)).toBe(false);
  });

  test("cancelling an edit discards the changes", async ({ page }) => {
    await addItem(page, "paints", { name: "Original" });
    await page.click("button[data-edit]");
    await fillForm(page, { name: "Changed" });
    await page.click("#cancelModal");
    expect((await stored(page)).paints[0].name).toBe("Original");
  });
});

test.describe("painting queue", () => {
  test("queue a miniature from its row", async ({ page }) => {
    await addItem(page, "miniatures", { name: "Squad", quantity: "5" });
    await page.click("button[data-queue]");
    const queue = (await stored(page)).queue;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ name: "Squad", models: "5" });
    await expect(
      page.locator('#nav button[data-sec="queue"] .count'),
    ).toHaveText("1");
  });

  test("add, edit, reorder and delete queue items", async ({ page }) => {
    await addItem(page, "queue", { name: "A" });
    await addItem(page, "queue", { name: "B" });
    const names = async () => (await stored(page)).queue.map((q) => q.name);

    await page.click(".qitem:nth-child(2) button[data-up]");
    expect(await names()).toEqual(["B", "A"]);
    await page.click(".qitem:nth-child(1) button[data-up]");
    await page.click(".qitem:nth-child(2) button[data-down]");
    expect(await names()).toEqual(["B", "A"]);

    await page.click(".qitem:nth-child(1) button[data-editq]");
    await fillForm(page, { stage: "Basing" });
    await submitForm(page);
    expect((await stored(page)).queue[0].stage).toBe("Basing");

    await page.click(".qitem:nth-child(1) button[data-delq]");
    expect(await names()).toEqual(["A"]);
    await expect(
      page.locator('#nav button[data-sec="queue"] .count'),
    ).toHaveText("1");
  });
});

test.describe("skills", () => {
  test("starts with the 10 default skills", async ({ page }) => {
    await nav(page, "skills");
    await expect(page.locator(".skill")).toHaveCount(10);
  });

  test("dragging a slider updates the label and saves", async ({ page }) => {
    await nav(page, "skills");
    const slider = page.locator("input[data-skill]").first();
    const result = await slider.evaluate((el) => {
      el.value = 6;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return {
        sameElement: document.querySelector("input[data-skill]") === el,
        label: el.closest(".skill").querySelector(".skilltop strong")
          .textContent,
      };
    });
    expect(result).toEqual({ sameElement: true, label: "6/9" });
    expect((await stored(page)).skills[0].level).toBe(6);
  });

  test("levels above 9 are clamped", async ({ page }) => {
    await addItem(page, "skills", { name: "Freehand", level: "12" });
    expect((await stored(page)).skills.at(-1).level).toBe(9);
  });

  test("deleting a skill updates the count", async ({ page }) => {
    await nav(page, "skills");
    await page.click("button[data-dels]");
    await expect(
      page.locator('#nav button[data-sec="skills"] .count'),
    ).toHaveText("9");
  });
});

test.describe("dashboard", () => {
  test("low-stock warnings ignore paints with no Remaining %", async ({
    page,
  }) => {
    await addItem(page, "paints", { name: "Blank" });
    await addItem(page, "paints", { name: "Empty", remaining: "0" });
    await addItem(page, "paints", { name: "Low", remaining: "15" });
    await addItem(page, "paints", { name: "Full", remaining: "80" });
    await nav(page, "dashboard");
    const stock = page.locator("#stockSummary");
    await expect(stock).toContainText("Empty");
    await expect(stock).toContainText("Low");
    await expect(stock).not.toContainText("Blank");
    await expect(stock).not.toContainText("Full");
  });
});
