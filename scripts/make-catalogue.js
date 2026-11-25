// Builds data/paint-catalogue.js, the paint catalogue the app loads, from
// data/sources/miniature_paints.json and data/sources/additions.json. Run with `npm run catalogue` after
// changing the source; tests/catalogue.spec.js fails while it's out of date.
//
// It tidies the source as it goes:
// - varnishes, mediums, thinners and the like get no colour, since the
//   source gives them a placeholder white;
// - the same paint listed twice in one range (old and new codes) becomes
//   one entry with both codes;
// - double spaces and bottle sizes ("17 Ml") come out of names;
// - types become the app's paint types.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "data", "sources", "miniature_paints.json");
// Paints added to the source, e.g. ranges it doesn't have yet. Their hex
// may be null where no colour has been published.
const ADDITIONS = path.join(ROOT, "data", "sources", "additions.json");
const OUT = path.join(ROOT, "data", "paint-catalogue.js");

// The source's types, and the app's paint types they become.
const TYPES = {
  primer: "Primer",
  base: "Base",
  layer: "Layer",
  standard: "Standard",
  shade: "Shade/Wash",
  contrast: "Contrast/Speedpaint",
  glaze: "Glaze",
  ink: "Ink",
  dry: "Dry",
  air: "Air",
  metallic: "Metallic",
  technical: "Technical",
  effect: "Effect",
};
// Products with no colour of their own. "Medium" counts only at the end of
// a name, and not after a colour ("Lahmian Medium", not "Medium Green" or
// "Oxide Brown Medium").
const NO_COLOUR =
  /\b(varnish|thinner|retarder|cleaner|reducer|flow improver|sealer|additive|clear base)\b|^(ardcoat|stormshield|medium wet|medium xpress)$|\bmedium(\s*-\d+-)?$/i;
const COLOUR_THEN_MEDIUM =
  /\b(brown|red|green|blue|grey|gray|yellow|orange|black|white|purple|pink|flesh|bone|tan)\s+medium$/i;

function tidyName(name) {
  return String(name)
    .replace(/\s+/g, " ")
    .replace(/\s*\d+\s*ml$/i, "")
    .trim();
}
function hasColour(name) {
  return !NO_COLOUR.test(name) || COLOUR_THEN_MEDIUM.test(name);
}

// The catalogue: brands, ranges and types once each, and each paint as
// [brand, range, name, code, hex, type, discontinued], where brand, range
// and type index those lists, hex is "RRGGBB" or "" for no colour, and
// discontinued is 1 or 0.
function build(source) {
  const brands = [],
    ranges = [],
    types = Object.values(TYPES),
    seen = new Map(),
    paints = [];
  const index = (list, v) => {
    let i = list.indexOf(v);
    if (i < 0) i = list.push(v) - 1;
    return i;
  };
  for (const p of source.paints) {
    const name = tidyName(p.name),
      code = p.code ? String(p.code) : "",
      key = [p.brand, p.range, name.toLowerCase()].join("\u0000");
    if (!TYPES[p.type]) throw new Error(`Unknown type ${p.type} for ${name}`);
    if (p.hex !== null && !/^#[0-9A-Fa-f]{6}$/.test(p.hex))
      throw new Error(`Bad colour ${p.hex} for ${name}`);
    const earlier = seen.get(key);
    if (earlier) {
      if (code && !earlier[3].split(" / ").includes(code))
        earlier[3] = earlier[3] ? `${earlier[3]} / ${code}` : code;
      continue;
    }
    const paint = [
      index(brands, p.brand),
      index(ranges, p.range),
      name,
      code,
      p.hex && hasColour(name) ? p.hex.slice(1).toUpperCase() : "",
      types.indexOf(TYPES[p.type]),
      p.discontinued ? 1 : 0,
    ];
    seen.set(key, paint);
    paints.push(paint);
  }
  return { brands, ranges, types, paints };
}

function render(catalogue) {
  return [
    "// The paint catalogue. Built by scripts/make-catalogue.js from",
    "// data/sources/miniature_paints.json and additions.json: don't edit it",
    "// by hand.",
    "// Sources and licences: data/sources/README.md.",
    "//",
    "// Each paint is [brand, range, name, code, hex, type, discontinued]:",
    "// brand, range and type index the lists below, hex is RRGGBB or empty",
    "// for no colour, and discontinued is 1 or 0.",
    "const PAINT_CATALOGUE = {",
    `  brands: ${JSON.stringify(catalogue.brands)},`,
    `  ranges: ${JSON.stringify(catalogue.ranges)},`,
    `  types: ${JSON.stringify(catalogue.types)},`,
    "  paints: [",
    ...catalogue.paints.map((p) => `    ${JSON.stringify(p)},`),
    "  ],",
    "};",
    "",
  ].join("\n");
}

// The source, with the additions after it.
function readSource() {
  const source = JSON.parse(fs.readFileSync(SOURCE, "utf8")),
    additions = JSON.parse(fs.readFileSync(ADDITIONS, "utf8"));
  return { paints: [...source.paints, ...additions.paints] };
}

module.exports = { build, render, readSource, OUT, TYPES };

if (require.main === module) {
  const catalogue = build(readSource());
  fs.writeFileSync(OUT, render(catalogue));
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${catalogue.paints.length} paints, ${catalogue.brands.length} brands`,
  );
}
