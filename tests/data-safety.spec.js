const fs = require("fs");
const {
  test,
  expect,
  APP,
  KEY,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
  addItem,
  modalOpen,
  tableRows,
  downloadText,
  importBackup,
} = require("./helpers");

const BACKUP_KEY = "forgeledger_v2_last_backup";
const RECOVERY_PREFIX = "forgeledger_v2_recovered_";

const recoveryCopies = (page) =>
  page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .map((k) => localStorage.getItem(k)),
    RECOVERY_PREFIX,
  );

test.beforeEach(async ({ page }) => openApp(page));

test.describe("two tabs", () => {
  test("a change in one tab is picked up by the other, not overwritten", async ({
    page,
    context,
  }) => {
    const other = await context.newPage();
    const otherErrors = [];
    other.on("pageerror", (e) => otherErrors.push(e.message));
    await other.goto(APP);

    await addItem(page, "paints", { name: "From tab A" });
    await expect(other.locator("#toast")).toHaveText(
      "Updated with changes from another tab",
    );
    await addItem(other, "paints", { name: "From tab B" });

    expect((await stored(page)).paints.map((p) => p.name)).toEqual([
      "From tab A",
      "From tab B",
    ]);
    expect(otherErrors).toEqual([]);
  });
});

test.describe("importing", () => {
  test("asks before replacing data and downloads a copy first", async ({
    page,
    dialogs,
  }, testInfo) => {
    await addItem(page, "paints", { name: "Old" });
    const downloading = page.waitForEvent("download");
    await importBackup(page, { paints: [{ id: "n", name: "New" }] }, testInfo);
    const copy = await downloading;

    expect(dialogs.messages[0]).toContain("Replace all current data");
    expect(copy.suggestedFilename()).toMatch(/^forgeledger-before-import-/);
    const saved = JSON.parse(fs.readFileSync(await copy.path(), "utf8"));
    expect(saved.paints[0].name).toBe("Old");
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect((await stored(page)).paints.map((p) => p.name)).toEqual(["New"]);
  });

  test("declining the confirmation keeps current data", async ({
    page,
    dialogs,
  }, testInfo) => {
    await addItem(page, "paints", { name: "Old" });
    let downloaded = false;
    page.on("download", () => (downloaded = true));
    dialogs.accept = false;
    await importBackup(page, { paints: [{ id: "n", name: "New" }] }, testInfo);
    await expect.poll(() => dialogs.messages.length).toBe(1);
    expect((await stored(page)).paints[0].name).toBe("Old");
    expect(downloaded).toBe(false);
  });

  test("an untouched app imports without asking", async ({
    page,
    dialogs,
  }, testInfo) => {
    await importBackup(page, { paints: [{ id: "n", name: "New" }] }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect(dialogs.messages).toEqual([]);
  });

  test("the file picker is cleared so the same file can be chosen again", async ({
    page,
  }, testInfo) => {
    await importBackup(page, { paints: [] }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    await expect(page.locator("#importFile")).toHaveValue("");
  });

  const malformed = [
    ["paints is null", { paints: null }, 'the "paints" section is damaged'],
    [
      "miniatures is an object",
      { miniatures: {} },
      'the "miniatures" section is damaged',
    ],
    [
      "records aren't objects",
      { paints: [1, 2] },
      'the "paints" section is damaged',
    ],
    ["a JSON array", [1, 2], "it isn't a ForgeLedger backup"],
    [
      "unrelated JSON",
      { name: "package.json" },
      "it has no ForgeLedger data in it",
    ],
    [
      "a newer schema",
      { schemaVersion: 99, paints: [] },
      "it was made by a newer version of ForgeLedger",
    ],
  ];
  for (const [label, content, reason] of malformed) {
    test(`rejects a backup where ${label}`, async ({ page }, testInfo) => {
      await addItem(page, "paints", { name: "Keep" });
      await importBackup(page, content, testInfo);
      await expect(page.locator("#toast")).toHaveText(
        `Can't import this file: ${reason}.`,
      );
      expect((await stored(page)).paints[0].name).toBe("Keep");
      await page.reload(); // reloading keeps the current page (#/paints)
      await nav(page, "dashboard");
      await expect(page.locator("#metrics .card")).toHaveCount(4);
    });
  }

  test("records without ids get one and can be edited", async ({
    page,
  }, testInfo) => {
    await importBackup(
      page,
      { paints: [{ name: "No id" }, { id: 7, name: "Number id" }] },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    const paints = (await stored(page)).paints;
    expect(typeof paints[0].id).toBe("string");
    expect(paints[0].id).not.toBe("");
    expect(paints[1].id).toBe("7");

    await nav(page, "paints");
    await page.click("button[data-edit]");
    await fillForm(page, { name: "Edited" });
    await submitForm(page);
    expect((await stored(page)).paints[0].name).toBe("Edited");
  });

  test("old backups without a schema version are upgraded", async ({
    page,
  }, testInfo) => {
    await importBackup(page, { paints: [{ id: "a", name: "Old" }] }, testInfo);
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect((await stored(page)).schemaVersion).toBe(1);
    const backup = JSON.parse(await downloadText(page, "#backupBtn"));
    expect(backup.schemaVersion).toBe(1);
  });
});

test.describe("saved data", () => {
  test("damaged data from older versions is repaired and the original kept", async ({
    page,
  }) => {
    // This shape used to crash the dashboard on every load.
    const damaged = { paints: null, tools: [{ id: "t", name: "Keep" }] };
    await seed(page, damaged);

    await expect(page.locator("#metrics .card")).toHaveCount(4);
    await expect(page.locator("#alerts")).toContainText(
      'Some saved data couldn\'t be read (the "paints" section is damaged)',
    );
    expect((await stored(page)).tools[0].name).toBe("Keep");
    expect(await recoveryCopies(page)).toEqual([JSON.stringify(damaged)]);

    const original = await downloadText(
      page,
      'button[data-recovery="download"]',
    );
    expect(original).toBe(JSON.stringify(damaged));
    await page.click('button[data-recovery="dismiss"]');
    await expect(page.locator("#alerts")).toBeEmpty();
  });

  test("unreadable data is kept, not overwritten by the next save", async ({
    page,
  }) => {
    const truncated = '{"paints":[{"id":"1","name":"Precious"}';
    await page.evaluate(
      ([k, raw]) => localStorage.setItem(k, raw),
      [KEY, truncated],
    );
    await page.reload();
    await expect(page.locator("#alerts")).toContainText("it isn't valid JSON");

    await addItem(page, "tools", { name: "New" });
    expect(await recoveryCopies(page)).toEqual([truncated]);
  });

  test("a failed save keeps the form open and creates no duplicates", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (window.failSaves)
          throw new DOMException("full", "QuotaExceededError");
        return real.call(this, k, v);
      };
      window.failSaves = true;
    });
    await nav(page, "paints");
    await page.click("#addBtn");
    await fillForm(page, { name: "Retry" });
    for (let i = 0; i < 3; i++) await submitForm(page);

    expect(await modalOpen(page)).toBe(true);
    await expect(page.locator("#toast")).toHaveText(
      "Couldn't save: browser storage is full or blocked.",
    );
    await expect(page.locator("#saveState")).toHaveText("Not saved");
    expect(await stored(page)).toBeNull();

    await page.evaluate(() => (window.failSaves = false));
    await submitForm(page);
    expect((await stored(page)).paints.map((p) => p.name)).toEqual(["Retry"]);
    await expect(tableRows(page)).toHaveCount(1);
  });

  test("blocked storage keeps working in memory and says so", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const blocked = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
    });
    await page.reload();
    await expect(page.locator("#alerts")).toContainText(
      "This browser is blocking storage",
    );
    await addItem(page, "paints", { name: "In memory" });
    await expect(tableRows(page)).toHaveCount(1);
    await expect(page.locator("#saveState")).toHaveText(
      "Not saved: storage is blocked",
    );
  });
});

test.describe("backup reminder", () => {
  const setLastBackup = (page, daysAgo) =>
    page.evaluate(
      ([k, t]) => localStorage.setItem(k, String(t)),
      [BACKUP_KEY, Date.now() - daysAgo * 864e5],
    );

  test("no reminder before anything is entered", async ({ page }) => {
    await expect(page.locator("#backupNotice")).toBeEmpty();
    await expect(page.locator("#backupState")).toHaveText("Last backup: never");
  });

  test("reminds after data is entered, clears after export", async ({
    page,
  }) => {
    await addItem(page, "paints", { name: "Red" });
    await nav(page, "dashboard");
    await expect(page.locator("#backupNotice")).toContainText(
      "Last backup: never",
    );
    await downloadText(page, "#backupBtn");
    await expect(page.locator("#backupNotice")).toBeEmpty();
    await expect(page.locator("#backupState")).toHaveText("Last backup: today");
  });

  test("reminds when the last backup is 14 or more days old", async ({
    page,
  }) => {
    await addItem(page, "paints", { name: "Red" });
    await setLastBackup(page, 20);
    await page.reload();
    await nav(page, "dashboard");
    await expect(page.locator("#backupNotice")).toContainText(
      "Last backup: 20 days ago",
    );
    await setLastBackup(page, 3);
    await page.reload();
    await nav(page, "dashboard");
    await expect(page.locator("#backupNotice")).toBeEmpty();
    await expect(page.locator("#backupState")).toHaveText(
      "Last backup: 3 days ago",
    );
  });
});

test("a second message stays up for its full time", async ({ page }) => {
  await nav(page, "paints");
  await page.click("#csvBtn"); // "Nothing to export"
  await page.waitForTimeout(1000);
  await page.click("#csvBtn");
  await page.waitForTimeout(900);
  await expect(page.locator("#toast")).toBeVisible();
});
