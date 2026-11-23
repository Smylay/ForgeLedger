// Skills: level names, the technique library and its next steps, the
// picker, the profile, practice suggestions and the "changed" date.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
} = require("./helpers");

// A date `offset` days from today, as stored in `changed`.
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};
const card = (page, name) => page.locator(".skill", { hasText: name });
const pick = (page) => page.locator("#skillAdd select");
const setSlider = (page, name, value) =>
  card(page, name)
    .locator("input[type=range]")
    .evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);

test.beforeEach(async ({ page }) => openApp(page));

test.describe("levels and next steps", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      schemaVersion: 3,
      skills: [
        { id: "a", name: "Edge highlighting", level: 2 },
        { id: "b", name: "Sculpting", level: 5, goal: "Finish a bust" },
        { id: "c", name: "Painting eyes", level: 1 },
      ],
    });
    await nav(page, "skills");
  });

  test("cards name the level, for sight and for screen readers", async ({
    page,
  }) => {
    await expect(card(page, "Sculpting").locator(".lvl")).toHaveText(
      "5/9 · Confident",
    );
    await expect(
      card(page, "Sculpting").locator("input[type=range]"),
    ).toHaveAttribute("aria-valuetext", "5 of 9, Confident");
  });

  test("the level guide explains all ten levels", async ({ page }) => {
    await page.click(".levelguide summary");
    const levels = page.locator("#levelGuide li");
    await expect(levels).toHaveCount(10);
    await expect(levels.first()).toHaveText(
      "Not tried: You haven't tried it yet.",
    );
    await expect(levels.last()).toContainText("Mastery");
  });

  test("a library technique's next step follows its level", async ({
    page,
  }) => {
    const step = card(page, "Edge highlighting").locator(".nextstep");
    await expect(step).toContainText("Run the side of the brush");
    await setSlider(page, "Edge highlighting", 3);
    await expect(step).toContainText("Keep the line thin");
    await expect(card(page, "Edge highlighting").locator(".lvl")).toHaveText(
      "3/9 · Basic",
    );
  });

  test("a skill of your own shows your goal, or says there isn't one", async ({
    page,
  }) => {
    await expect(card(page, "Sculpting").locator(".nextstep")).toBeHidden();
    await expect(card(page, "Sculpting")).toContainText(
      "Your goal: Finish a bust",
    );
    await expect(card(page, "Painting eyes")).toContainText("No practice goal");
  });

  test("library names match whatever the case and spacing", async ({
    page,
  }) => {
    await seed(page, {
      schemaVersion: 3,
      skills: [{ id: "a", name: "  edge HIGHLIGHTING ", level: 0 }],
    });
    await nav(page, "skills");
    await expect(page.locator(".nextstep")).toContainText(
      "Run the side of the brush",
    );
  });
});

test.describe("adding skills", () => {
  test("the picker lists library techniques you haven't added", async ({
    page,
  }) => {
    await nav(page, "skills");
    const options = await pick(page)
      .locator("option")
      .evaluateAll((os) => os.map((o) => o.textContent));
    // 20 in the library, 10 already there on a new install.
    expect(options).toHaveLength(12);
    expect(options[0]).toBe("Add a technique…");
    expect(options).toContain("Priming");
    expect(options).not.toContain("Layering");
    expect(options.at(-1)).toBe("Other: name your own…");
  });

  test("adding a technique saves it, with Undo, and drops it from the list", async ({
    page,
  }) => {
    await nav(page, "skills");
    await pick(page).selectOption("Priming");
    await page.click("#skillAdd button");
    const added = (await stored(page)).skills.at(-1);
    expect(added).toMatchObject({ name: "Priming", level: 0, changed: day(0) });
    await expect(card(page, "Priming").locator(".nextstep")).toContainText(
      "short passes",
    );
    await expect(pick(page)).toHaveValue("");
    await expect(pick(page)).toBeFocused();
    await expect(
      pick(page).locator("option", { hasText: /^Priming$/ }),
    ).toHaveCount(0);
    await expect(page.locator("#toastText")).toHaveText('Added "Priming"');
    await page.click("#toastAction");
    expect((await stored(page)).skills).toHaveLength(10);
  });

  test("Other asks for a name", async ({ page }) => {
    await nav(page, "skills");
    const name = page.locator("#skillAdd input");
    await expect(name).toBeHidden();
    await pick(page).selectOption("other");
    await expect(name).toBeVisible();
    await expect(name).toBeFocused();
    await name.fill("Sculpting");
    await name.press("Enter");
    expect((await stored(page)).skills.at(-1).name).toBe("Sculpting");
    await expect(name).toBeHidden();
    await expect(card(page, "Sculpting")).toContainText("No practice goal");
  });

  test("a skill you already have isn't added twice", async ({ page }) => {
    await nav(page, "skills");
    await pick(page).selectOption("other");
    await page.locator("#skillAdd input").fill("drybrushing ");
    await page.click("#skillAdd button");
    await expect(page.locator("#toastText")).toHaveText(
      '"drybrushing" is already in your skills',
    );
    expect(await stored(page)).toBeNull(); // nothing was saved
    await expect(page.locator(".skill")).toHaveCount(10);
  });

  test("nothing is added until something is chosen", async ({ page }) => {
    await nav(page, "skills");
    await page.click("#skillAdd button");
    await pick(page).selectOption("other");
    await page.click("#skillAdd button"); // name left blank
    expect(await stored(page)).toBeNull(); // nothing was saved
    await expect(page.locator(".skill")).toHaveCount(10);
  });

  test("a skill added with the form records the date", async ({ page }) => {
    await nav(page, "skills");
    await page.click("#addBtn");
    await fillForm(page, { name: "Sculpting", level: "3" });
    await submitForm(page);
    expect((await stored(page)).skills.at(-1)).toMatchObject({
      name: "Sculpting",
      level: 3,
      changed: day(0),
    });
  });
});

test.describe("the changed date", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      schemaVersion: 3,
      skills: [
        { id: "a", name: "Layering", level: 4, changed: day(-20) },
        { id: "b", name: "Glazing", level: 2 },
      ],
    });
    await nav(page, "skills");
  });

  test("shows how long ago, and nothing for older skills", async ({ page }) => {
    await expect(card(page, "Layering").locator(".changed")).toHaveText(
      "Changed 2 weeks ago",
    );
    await expect(card(page, "Glazing").locator(".changed")).toHaveText("");
  });

  test("moving the slider records today", async ({ page }) => {
    await setSlider(page, "Glazing", 3);
    expect((await stored(page)).skills[1]).toMatchObject({
      level: 3,
      changed: day(0),
    });
    await expect(card(page, "Glazing").locator(".changed")).toHaveText(
      "Changed today",
    );
  });

  test("editing records it only when the level changes", async ({ page }) => {
    await card(page, "Layering").locator("button[data-edit]").click();
    await fillForm(page, { goal: "Smoother cloaks" });
    await submitForm(page);
    expect((await stored(page)).skills[0].changed).toBe(day(-20));
    await card(page, "Layering").locator("button[data-edit]").click();
    await fillForm(page, { level: "5" });
    await submitForm(page);
    expect((await stored(page)).skills[0].changed).toBe(day(0));
  });
});

test.describe("profile and practice suggestions", () => {
  const profile = (page) =>
    page
      .locator("#skillProfile li")
      .evaluateAll((items) =>
        items.map((li) => [
          li.querySelector(".mname").textContent,
          li.querySelector(".mval").textContent,
          li.querySelector(".meter i").style.width,
        ]),
      );
  const practice = (page) =>
    page
      .locator("#practice li")
      .evaluateAll((items) =>
        items.map(
          (li) =>
            li.querySelector("b").textContent +
            " " +
            li.querySelector(".muted").textContent,
        ),
      );

  test.beforeEach(async ({ page }) => {
    await seed(page, {
      schemaVersion: 3,
      skills: [
        { id: "a", name: "Layering", level: 4, changed: day(-3) },
        { id: "b", name: "Glazing", level: 9, changed: day(-90) },
        { id: "c", name: "Freehand", level: 6, changed: day(-45) },
        { id: "d", name: "Basing", level: 0 },
        { id: "e", name: "Sculpting", level: 2, goal: "Finish a bust" },
        { id: "f", name: "Weathering", level: 5, changed: day(-60) },
      ],
    });
    await nav(page, "skills");
  });

  test("the profile lists every skill, highest first", async ({ page }) => {
    expect(await profile(page)).toEqual([
      ["Glazing", "9 · Mastery", "100%"],
      ["Freehand", "6 · Skilled", "66.6667%"],
      ["Weathering", "5 · Confident", "55.5556%"],
      ["Layering", "4 · Competent", "44.4444%"],
      ["Sculpting", "2 · Learning", "22.2222%"],
      ["Basing", "0 · Not tried", "0%"],
    ]);
  });

  test("suggests stale skills first, oldest first, then the lowest", async ({
    page,
  }) => {
    // Glazing is the oldest but at Mastery, so it's left out.
    expect(await practice(page)).toEqual([
      "Weathering · Not changed in 8 weeks",
      "Freehand · Not changed in 6 weeks",
      "Basing · Not tried yet",
    ]);
    await expect(page.locator("#practice li").first()).toContainText(
      "Layer effects: rust under chips",
    );
  });

  test("suggestions show your goal for a skill of your own", async ({
    page,
  }) => {
    await setSlider(page, "Weathering", 6);
    await setSlider(page, "Freehand", 7);
    await setSlider(page, "Basing", 3);
    expect(await practice(page)).toEqual([
      "Sculpting · One of your lowest",
      "Basing · One of your lowest",
      "Layering · One of your lowest",
    ]);
    await expect(page.locator("#practice li").first()).toContainText(
      "Finish a bust",
    );
  });

  test("the profile and suggestions update as a slider moves", async ({
    page,
  }) => {
    await setSlider(page, "Basing", 8);
    expect((await profile(page))[1]).toEqual([
      "Basing",
      "8 · Expert",
      "88.8889%",
    ]);
    expect(await practice(page)).not.toContain("Basing · Not tried yet");
  });

  test("say so when there's nothing to suggest", async ({ page }) => {
    await seed(page, {
      schemaVersion: 3,
      skills: [{ id: "a", name: "Glazing", level: 9 }],
    });
    await nav(page, "skills");
    await expect(page.locator("#practice")).toHaveText(
      "Every skill is at Mastery.",
    );
    await page.click("button[data-del]");
    await expect(page.locator("#practice")).toHaveText(
      "Add a skill to get suggestions.",
    );
    await expect(page.locator("#skillProfile")).toHaveText(
      "No skills yet. Add one above.",
    );
  });
});
