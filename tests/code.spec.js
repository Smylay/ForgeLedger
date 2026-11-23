// Checks on the source itself. The script files share one global scope,
// and a second `function` with a name already used silently replaces the
// first (a repeated let or const at least fails to load).
const fs = require("fs");
const path = require("path");
const { test, expect } = require("./helpers");

test("no two script files declare the same top-level name", () => {
  const dir = path.join(__dirname, "..", "js");
  const seen = new Map(),
    repeats = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [, name] of src.matchAll(
      /^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
    )) {
      if (seen.has(name)) repeats.push(`${name}: ${seen.get(name)}, ${file}`);
      else seen.set(name, file);
    }
  }
  expect(repeats).toEqual([]);
});

// A write just before page.reload() can be lost under load (see reload() in
// helpers.js), which makes tests fail at random.
test("tests reload with the helper, not page.reload()", () => {
  const found = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith(".spec.js") && f !== "code.spec.js")
    .filter((f) =>
      /page\.reload\(/.test(fs.readFileSync(path.join(__dirname, f), "utf8")),
    );
  expect(found).toEqual([]);
});
