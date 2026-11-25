// Settings: theme, currency, auto-save to a file, keyboard shortcuts and
// erasing everything; plus the app version that backups carry.
const {
  test,
  reload,
  expect,
  openSite,
  openApp,
  seed,
  stored,
  nav,
  addItem,
  downloadText,
  importBackup,
  importAndWait,
  imageFile,
} = require("./helpers");

const settings = (page) => page.locator("#settingsDialog");
async function openSettings(page) {
  await page.click("#settingsBtn");
  await expect(settings(page)).toBeVisible();
}

test.describe("theme", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("starts dark, and a choice is kept for this browser only", async ({
    page,
  }) => {
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await openSettings(page);
    await expect(page.locator("#themeSetting")).toHaveValue("dark");
    await page.selectOption("#themeSetting", "light");
    await expect(html).toHaveAttribute("data-theme", "light");
    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(243, 245, 248)");

    await reload(page);
    await expect(html).toHaveAttribute("data-theme", "light");
    expect(await bg()).toBe("rgb(243, 245, 248)");
    // Not part of the data, so not in backups.
    await addItem(page, "paints", { name: "Red" });
    expect(JSON.stringify(await stored(page))).not.toContain('"light"');
  });

  test("Match my device follows the device's setting", async ({ page }) => {
    await openSettings(page);
    await page.selectOption("#themeSetting", "system");
    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "light" });
    expect(await bg()).toBe("rgb(243, 245, 248)");
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await bg()).toBe("rgb(15, 18, 22)");
  });

  test("the light theme sets every colour the dark one does, in both its blocks", async ({
    page,
  }) => {
    // Served over HTTP: browsers don't let a file:// page read its rules.
    await openSite(page);
    const blocks = await page.evaluate(() => {
      const props = (rule) =>
        Object.fromEntries(
          [...rule.style]
            .filter((p) => p.startsWith("--") || p === "color-scheme")
            .map((p) => [p, rule.style.getPropertyValue(p).trim()]),
        );
      const out = {};
      for (const sheet of document.styleSheets)
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ":root") out.dark = props(rule);
          if (rule.selectorText === ':root[data-theme="light"]')
            out.light = props(rule);
          if (
            rule.media &&
            /prefers-color-scheme: ?light/.test(rule.conditionText)
          )
            for (const inner of rule.cssRules)
              if (inner.selectorText === ':root[data-theme="system"]')
                out.system = props(inner);
        }
      return out;
    });
    expect(Object.keys(blocks.light).sort()).toEqual(
      Object.keys(blocks.dark).sort(),
    );
    expect(blocks.system).toEqual(blocks.light);
    expect(blocks.light["color-scheme"]).toBe("light");
  });

  test("colour themes apply, and are kept", async ({ page }) => {
    const html = page.locator("html");
    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (const [theme, colour] of [
      ["forest", "rgb(14, 20, 17)"],
      ["ocean", "rgb(12, 18, 25)"],
      ["amethyst", "rgb(18, 15, 24)"],
      ["parchment", "rgb(244, 238, 226)"],
    ]) {
      await openSettings(page);
      await page.selectOption("#themeSetting", theme);
      await expect(html).toHaveAttribute("data-theme", theme);
      expect(await bg()).toBe(colour);
      await reload(page);
      await expect(html).toHaveAttribute("data-theme", theme);
      expect(await bg()).toBe(colour);
    }
  });

  test("colour themes set only known colours; Parchment sets them all", async ({
    page,
  }) => {
    // Served over HTTP: browsers don't let a file:// page read its rules.
    await openSite(page);
    const blocks = await page.evaluate(() => {
      const out = {};
      for (const sheet of document.styleSheets)
        for (const rule of sheet.cssRules) {
          const m = /^:root(?:\[data-theme="(\w+)"\])?$/.exec(
            rule.selectorText || "",
          );
          if (m)
            out[m[1] || "dark"] = [...rule.style].filter(
              (p) => p.startsWith("--") || p === "color-scheme",
            );
        }
      return out;
    });
    const dark = [...blocks.dark].sort();
    for (const theme of ["forest", "ocean", "amethyst"]) {
      expect(blocks[theme].length).toBeGreaterThan(0);
      expect(dark).toEqual(expect.arrayContaining(blocks[theme]));
    }
    expect([...blocks.parchment].sort()).toEqual(dark);
    // Every theme in Settings has its colours.
    const offered = await page
      .locator("#themeSetting option")
      .evaluateAll((os) => os.map((o) => o.value));
    expect(offered).toEqual(await page.evaluate(() => THEMES));
    for (const t of offered.filter((t) => !["dark", "system"].includes(t)))
      expect(blocks[t], t).toBeDefined();
  });

  test("a junk stored theme counts as dark", async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem("forgeledger_v2_theme", "neon"),
    );
    await reload(page);
    await openSettings(page);
    await expect(page.locator("#themeSetting")).toHaveValue("dark");
  });
});

test.describe("currency", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seed(page, {
      tools: [{ id: "t", name: "Knife", price: "4.5" }],
      wishlist: [{ id: "w", name: "Pot", price: "1234" }],
    });
  });

  test("starts as pounds sterling", async ({ page }) => {
    await expect(page.locator("#metrics")).toContainText("£4.50");
    await nav(page, "tools");
    await expect(page.locator("thead")).toContainText("Cost (£)");
  });

  test("changes how prices and labels are shown, without converting", async ({
    page,
  }) => {
    await openSettings(page);
    await page.selectOption("#currencySetting", "EUR");
    await expect(page.locator("#toast")).toContainText(
      "Prices are shown in Euro",
    );
    expect((await stored(page)).currency).toBe("EUR");
    await page.click("#closeSettings");
    await expect(page.locator("#metrics")).toContainText("€4.50");

    await nav(page, "tools");
    await expect(page.locator("thead")).toContainText("Cost (€)");
    await expect(page.locator("tbody")).toContainText("€4.50");
    await page.click("button[data-edit]");
    await expect(page.locator("#formFields")).toContainText("Cost (€)");
    await page.click("#cancelModal");

    await nav(page, "wishlist");
    await expect(page.locator("thead")).toContainText("Expected cost (€)");
    await expect(page.locator("tbody")).toContainText("€1,234.00");
    // The amount itself is unchanged.
    expect((await stored(page)).wishlist[0].price).toBe("1234");
  });

  test("currencies without pence and with their own style", async ({
    page,
  }) => {
    await openSettings(page);
    await page.selectOption("#currencySetting", "JPY");
    await page.click("#closeSettings");
    await nav(page, "wishlist");
    await expect(page.locator("tbody")).toContainText("1,234");
    await expect(page.locator("thead")).toContainText("Expected cost (");
  });

  test("an unknown stored currency counts as pounds", async ({ page }) => {
    const data = await stored(page);
    await seed(page, { ...data, currency: "<img src=x onerror=alert(1)>" });
    await expect(page.locator("#metrics")).toContainText("£4.50");
    await openSettings(page);
    await expect(page.locator("#currencySetting")).toHaveValue("GBP");
  });

  test("goes with the data into backups, and older backups keep it", async ({
    page,
  }, testInfo) => {
    await openSettings(page);
    await page.selectOption("#currencySetting", "USD");
    await page.click("#closeSettings");
    const backup = JSON.parse(await downloadText(page, "#backupBtn"));
    expect(backup.currency).toBe("USD");

    // A backup from before currencies could be chosen keeps the current one.
    // importAndWait clears the toast first, so the second import's toast
    // can't be mistaken for the first's.
    await importAndWait(page, { paints: [{ id: "p", name: "Old" }] }, testInfo);
    expect((await stored(page)).currency).toBe("USD");
    // One that has its own brings it.
    await importAndWait(page, { ...backup, currency: "SEK" }, testInfo);
    expect((await stored(page)).currency).toBe("SEK");
  });
});

test.describe("version", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("is shown in the sidebar and Settings", async ({ page }) => {
    const v = await page.evaluate(() => APP_VERSION);
    expect(v).toBe(require("../package.json").version);
    await expect(page.locator(".sideinfo")).toContainText(`ForgeLedger ${v}`);
    await openSettings(page);
    await expect(settings(page)).toContainText(`ForgeLedger ${v}`);
  });

  test("an import says which version made an older backup", async ({
    page,
  }, testInfo) => {
    await importBackup(
      page,
      { appVersion: "0.9.0", paints: [{ id: "p", name: "Red" }] },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText(
      "Backup imported (made by ForgeLedger 0.9.0)",
    );
    const data = await stored(page);
    expect(data).not.toHaveProperty("appVersion");
    expect(data.paints[0].name).toBe("Red");
  });

  test("a backup from this version just says imported", async ({
    page,
  }, testInfo) => {
    const v = await page.evaluate(() => APP_VERSION);
    await importBackup(page, { appVersion: v, paints: [] }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
  });

  test("a backup from a newer version is refused, naming it", async ({
    page,
  }, testInfo) => {
    await importBackup(
      page,
      { appVersion: "9.0.0", schemaVersion: 999, paints: [] },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText(
      "Can't import this file: it was made by a newer version of ForgeLedger (9.0.0).",
    );
  });

  test("a junk version is shown as text, cut short", async ({
    page,
  }, testInfo) => {
    await importBackup(
      page,
      { appVersion: "<b>x</b>" + "y".repeat(50), paints: [] },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText(
      "Backup imported (made by ForgeLedger <b>x</b>yyyyyyyyyyyy)",
    );
  });
});

test.describe("erase all data", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seed(page, {
      paints: [{ id: "p", name: "Red" }],
      miniatures: [{ id: "m", name: "Squad" }],
      currency: "EUR",
    });
  });

  test("downloads a backup, then erases data and photos", async ({ page }) => {
    await nav(page, "miniatures");
    await page.click("button[data-photos]");
    await page
      .locator("#photoFile")
      .setInputFiles([await imageFile(page, "a.png", 40, 30)]);
    await expect(page.locator("#photoStrip button")).toHaveCount(1);
    await page.click("#closePhotos");

    await openSettings(page);
    const backup = JSON.parse(await downloadText(page, "#eraseAll"));
    expect(backup.paints[0].name).toBe("Red");
    expect(Object.keys(backup.photos)).toHaveLength(1);

    await expect(page.locator("#toast")).toContainText("Erased all data");
    await expect(settings(page)).toBeHidden();
    await expect(page.locator("#title")).toHaveText("Dashboard");
    const data = await stored(page);
    expect(data.paints).toEqual([]);
    expect(data.miniatures).toEqual([]);
    expect(data).not.toHaveProperty("currency");
    expect(await page.evaluate(() => allPhotos())).toEqual([]);
    // Back to a new install: the example data is offered again.
    await expect(page.locator("#startNotice")).toContainText(
      "New to ForgeLedger?",
    );
  });

  test("Cancel erases nothing", async ({ page, dialogs }) => {
    dialogs.accept = false;
    await openSettings(page);
    await page.click("#eraseAll");
    expect(dialogs.messages[0]).toContain("Erase all your ForgeLedger data");
    await expect(settings(page)).toBeVisible();
    expect((await stored(page)).paints).toHaveLength(1);
  });
});

test.describe("keyboard shortcuts", () => {
  test("can be turned off and listed from Settings", async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await expect(page.locator("#settingsKeysOn")).toBeChecked();
    await page.locator("#settingsKeysOn").uncheck();
    await page.click("#closeSettings");
    await page.keyboard.press("2");
    await expect(page.locator("#title")).toHaveText("Dashboard");

    await openSettings(page);
    await page.click("#settingsKeysList");
    await expect(settings(page)).toBeHidden();
    await expect(page.locator("#keysDialog")).toBeVisible();
    await expect(page.locator("#keysOn")).not.toBeChecked();
  });
});

test.describe("auto-save to a file", () => {
  test("says when the browser can't do it", async ({ page }) => {
    // Firefox and Safari have no file picker for saving.
    await page.addInitScript(() => (window.showSaveFilePicker = undefined));
    await openApp(page);
    await openSettings(page);
    await expect(page.locator("#autoSaveStatus")).toContainText(
      "needs Chrome, Edge or another Chromium-based browser",
    );
    await expect(page.locator("#autoSaveChoose")).toBeHidden();
    await expect(page.locator("#autoSaveStop")).toBeHidden();
  });

  test.describe("in Chromium", () => {
    // The picker is replaced with a file in the page's private file system,
    // which Chromium can write the same way as a file the user picked. A test
    // switch in localStorage makes writing fail.
    //
    // A handle to that stand-in file can't be read back from IndexedDB after
    // a reload: CI's headless Chromium crashes. So start-up is tested with a
    // stand-in for the handle it reads, instead of by reloading.
    test.skip(
      ({ browserName }) => browserName !== "chromium",
      "only Chromium can save to a picked file",
    );

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.showSaveFilePicker = async () =>
          (await navigator.storage.getDirectory()).getFileHandle(
            "autosave.json",
            { create: true },
          );
        const writable = FileSystemFileHandle.prototype.createWritable;
        FileSystemFileHandle.prototype.createWritable = function (...a) {
          return localStorage.getItem("test_fail")
            ? Promise.reject(new Error("disk full"))
            : writable.apply(this, a);
        };
      });
      // Served over HTTP: the private file system needs a secure origin.
      await openSite(page);
    });

    // The saved file's data, or null before it's first written. (A poll
    // gives up at once if this throws.)
    const file = (page) =>
      page.evaluate(async () => {
        try {
          const dir = await navigator.storage.getDirectory();
          const f = await (await dir.getFileHandle("autosave.json")).getFile();
          return JSON.parse(await f.text());
        } catch {
          return null;
        }
      });

    test("writes a full backup after each change", async ({ page }) => {
      await openSettings(page);
      await expect(page.locator("#autoSaveStatus")).toContainText("Off.");
      await page.click("#autoSaveChoose");
      await expect(page.locator("#autoSaveStatus")).toContainText(
        "On: saving to autosave.json. Last saved at",
      );
      await expect(page.locator("#autoSaveChoose")).toBeHidden();
      await expect(page.locator("#autoSaveStop")).toBeVisible();
      const first = await file(page);
      expect(first.appVersion).toBe(await page.evaluate(() => APP_VERSION));
      await expect(page.locator("#autoSaveState")).toContainText(
        "Auto-save: on",
      );
      // It counts as a backup.
      await expect(page.locator("#backupState")).not.toContainText("never");

      await page.click("#closeSettings");
      await nav(page, "paints");
      await page.fill(".quickadd input", "Red");
      await page.press(".quickadd input", "Enter");
      await expect
        .poll(async () => (await file(page))?.paints.map((p) => p.name))
        .toEqual(["Red"]);
    });

    test("is remembered, and forgotten when stopped", async ({ page }) => {
      const stored = () =>
        page.evaluate(() => handleTx("readonly", (st) => st.getAllKeys()));
      await openSettings(page);
      await page.click("#autoSaveChoose");
      await expect(page.locator("#autoSaveStatus")).toContainText("On:");
      expect(await stored()).toEqual(["autosave"]);
      await page.click("#autoSaveStop");
      await expect(page.locator("#autoSaveStatus")).toContainText("Off.");
      await expect(page.locator("#autoSaveState")).toHaveText("");
      await expect(page.locator("#autoSaveChoose")).toBeVisible();
      expect(await stored()).toEqual([]);
    });

    // Start-up with a remembered file: `handleTx` gives the app a stand-in
    // handle, which reports `permission` until permission is requested, and
    // keeps what's written to it in `__written`.
    const startWith = (page, permission) =>
      page.evaluate(async (permission) => {
        window.__written = [];
        const handle = {
          name: "remembered.json",
          queryPermission: async () => permission,
          requestPermission: async () => (permission = "granted"),
          createWritable: async () => ({
            write: async (text) => window.__written.push(JSON.parse(text)),
            close: async () => {},
          }),
        };
        handleTx = async () => handle;
        autoSave = { handle: null, state: "off", savedAt: 0, error: "" };
        await loadAutoSave();
      }, permission);

    test("picks up a remembered file at start-up", async ({ page }) => {
      await startWith(page, "granted");
      await expect(page.locator("#autoSaveState")).toHaveText("Auto-save: on");
      await openSettings(page);
      await expect(page.locator("#autoSaveStatus")).toContainText(
        "On: saving to remembered.json",
      );
      await page.click("#closeSettings");
      await addItem(page, "paints", { name: "Red" });
      await expect
        .poll(() => page.evaluate(() => window.__written.at(-1)?.paints))
        .toMatchObject([{ name: "Red" }]);
    });

    test("pauses until permission is given again", async ({ page }) => {
      await startWith(page, "prompt");
      await expect(page.locator("#autoSaveState")).toHaveText(
        "Auto-save: paused",
      );
      await openSettings(page);
      await expect(page.locator("#autoSaveStatus")).toContainText(
        "Paused: the browser needs your permission again to save to remembered.json",
      );
      await expect(page.locator("#autoSaveChoose")).toBeHidden();
      // Nothing is written while paused.
      await page.click("#closeSettings");
      await addItem(page, "paints", { name: "Red" });
      await page.waitForTimeout(2000); // longer than the auto-save delay
      expect(await page.evaluate(() => window.__written)).toEqual([]);

      await openSettings(page);
      await page.click("#autoSaveResume");
      await expect(page.locator("#autoSaveStatus")).toContainText(
        "On: saving to remembered.json. Last saved at",
      );
      await expect(page.locator("#autoSaveResume")).toBeHidden();
      // Resuming writes straight away.
      expect(
        await page.evaluate(() => window.__written.at(-1).paints[0].name),
      ).toBe("Red");
    });

    test("says when writing fails", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("test_fail", "1"));
      await openSettings(page);
      await page.click("#autoSaveChoose");
      await expect(page.locator("#autoSaveStatus")).toContainText(
        "Couldn't save to autosave.json (disk full)",
      );
      await expect(page.locator("#autoSaveState")).toHaveText(
        "Auto-save: failed",
      );
      await expect(page.locator("#autoSaveChoose")).toBeVisible();
    });

    test("stops before erasing, so the file keeps the data", async ({
      page,
    }) => {
      await addItem(page, "paints", { name: "Keep me" });
      await openSettings(page);
      await page.click("#autoSaveChoose");
      await expect.poll(async () => (await file(page))?.paints.length).toBe(1);
      await downloadText(page, "#eraseAll");
      await expect(page.locator("#toast")).toContainText("Erased all data");
      await page.waitForTimeout(2000); // longer than the auto-save delay
      expect((await file(page)).paints[0].name).toBe("Keep me");
      await openSettings(page);
      await expect(page.locator("#autoSaveStatus")).toContainText("Off.");
    });
  });
});
