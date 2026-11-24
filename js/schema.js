// Storage keys, defaults, and `defs`, the config that describes every
// collection; plus helpers for linked records, paint stock and project
// stats.
"use strict";

const KEY = "forgeledger_v2_data";
// Bump when stored data changes shape, and add a step to migrate().
const SCHEMA_VERSION = 5;
// The app's version, shown in Settings and the sidebar, and written into
// backups (as `appVersion`).
const APP_VERSION = "1.0.0";
const BACKUP_KEY = "forgeledger_v2_last_backup";
// "off" when the user has turned single-key shortcuts off (kept outside
// the data, like the last backup time).
const SHORTCUTS_KEY = "forgeledger_v2_shortcuts";
// The theme (dark, light or system), kept per browser like the shortcuts
// setting. The <head> of forgeledger_v2.html reads it too, before drawing.
const THEME_KEY = "forgeledger_v2_theme";
const THEMES = ["dark", "light", "system"];
const RECOVERY_PREFIX = "forgeledger_v2_recovered_";
const BACKUP_REMINDER_DAYS = 14;
const DUE_SOON_DAYS = 14; // dates this close get a "Due in N days" marker
// Paint stock levels, fullest first. Low and Empty count as low stock.
const STOCK_LEVELS = ["Full", "Good", "Half", "Low", "Empty"];
// Painting queue stages between "Not started" and "Complete", which are
// always first and last. These are the default until it's edited.
const DEFAULT_STAGES = [
  "Building",
  "Priming",
  "Basecoating",
  "Detailing",
  "Basing",
];
const MAX_STAGES = 20; // middle stages in one list
const MAX_STAGE_NAME = 40; // characters
const COLLECTIONS = [
  "paints",
  "tools",
  "miniatures",
  "projects",
  "queue",
  "wishlist",
  "skills",
];
const defaults = {
  schemaVersion: SCHEMA_VERSION,
  paints: [],
  tools: [],
  miniatures: [],
  projects: [],
  queue: [],
  wishlist: [],
  skills: [
    ["Drybrushing", 0],
    ["Washing & shading", 0],
    ["Layering", 0],
    ["Edge highlighting", 0],
    ["Glazing", 0],
    ["Wet blending", 0],
    ["Airbrushing", 0],
    ["Weathering", 0],
    ["Object-source lighting", 0],
    ["Non-metallic metal", 0],
  ].map((x) => ({ id: id(), name: x[0], level: x[1], notes: "", goal: "" })),
};
// Every collection, in nav order. This drives the nav, page titles, forms,
// table columns, the filter dropdown and search.
//   view:     section element to show; list collections use #listView.
//   columns:  field keys (or `computed` keys) shown in the table.
//   filter:   key of the field the filter dropdown filters on.
//   computed: read-only columns calculated from other data.
// Field types: text (default), textarea, select (needs `options`), link
// (stores the id of a record in collection `to`), links (an array of ids),
// date, url, color, count, money, percent, level, scale (one of `options`,
// shown in tables as one-tap buttons coloured by `tones`: good, mid, bad
// or none; it sorts in option order, or reversed with `highFirst`).
const defs = {
  paints: {
    title: "Paints",
    noun: "paint",
    sub: "Brands, ranges, stock and replacement warnings",
    fields: [
      { key: "name", label: "Paint name", required: true },
      {
        key: "brand",
        label: "Brand",
        suggest: "paintBrands",
        suggestMore: () => catalogueBrands(),
      },
      // Range is the product line, e.g. Vallejo Model Color; its suggestions
      // follow the brand.
      {
        key: "range",
        label: "Range",
        suggest: true,
        suggestBy: "brand",
        suggestMore: (obj) => catalogueRanges(obj.brand),
      },
      { key: "colour", label: "Colour / hex", type: "color" },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: [
          "Primer",
          "Base",
          "Layer",
          "Standard",
          "Shade/Wash",
          "Contrast/Speedpaint",
          "Glaze",
          "Ink",
          "Dry",
          "Air",
          "Metallic",
          "Technical",
          "Effect",
          "Medium",
          "Other",
        ],
      },
      { key: "quantity", label: "Quantity", type: "count", stepper: true },
      {
        key: "stock",
        label: "Stock",
        type: "scale",
        options: STOCK_LEVELS,
        tones: ["good", "good", "mid", "bad", "bad"],
        highFirst: true, // options run from most to least
      },
      {
        key: "price",
        get label() {
          return priced("Cost");
        },
        type: "money",
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    computed: {
      usedin: {
        label: "Used in",
        type: "count",
        value: (p) => usedIn(p).length,
        html: (p) => usedInHtml(p),
      },
    },
    columns: ["name", "brand", "range", "type", "quantity", "stock", "usedin"],
    swatch: "colour", // show this colour beside each paint's name
    formIntro: () => catalogueFindHtml(), // Find in the paint catalogue
    // Each list opens sorted so what needs attention comes first: here, the
    // lowest stock. Clicking a column header still sorts by that column.
    defaultSort: { key: "stock", dir: 1 },
    filter: "type",
  },
  tools: {
    title: "Tools",
    noun: "tool",
    sub: "Brushes, airbrush equipment and hobby supplies",
    fields: [
      { key: "name", label: "Tool", required: true },
      { key: "brand", label: "Brand", suggest: "toolBrands" },
      {
        key: "category",
        label: "Category",
        type: "select",
        options: [
          "Brush",
          "Airbrush",
          "Cutting",
          "Assembly",
          "Basing",
          "Lighting",
          "Storage",
          "Other",
        ],
      },
      {
        key: "condition",
        label: "Condition",
        type: "scale",
        options: ["New", "Good", "Worn", "Replace soon"],
        tones: ["good", "good", "mid", "bad"],
        highFirst: true, // best first, like paint stock
      },
      { key: "quantity", label: "Quantity", type: "count" },
      {
        key: "price",
        get label() {
          return priced("Cost");
        },
        type: "money",
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: ["name", "category", "condition", "quantity", "price"],
    filter: "category",
    defaultSort: { key: "condition", dir: 1 }, // worst condition first
  },
  miniatures: {
    title: "Miniatures",
    noun: "miniature",
    photos: true, // a thumbnail and a Photos button on each row
    sub: "Models, units and their painting state",
    fields: [
      { key: "name", label: "Miniature / unit", required: true },
      { key: "brand", label: "Brand", suggest: "miniatureBrands" },
      {
        key: "faction",
        label: "Faction",
        suggest: true,
        suggestFrom: ["miniatures", "projects"], // shared by both
      },
      { key: "project", label: "Army project", type: "link", to: "projects" },
      { key: "quantity", label: "Model count", type: "count", stepper: true },
      {
        key: "painted",
        label: "Painted count",
        type: "count",
        atMost: "quantity",
        stepper: true,
      },
      {
        key: "status",
        label: "Status",
        type: "scale",
        options: ["Unbuilt", "Built", "Primed", "In progress", "Complete"],
        tones: ["none", "none", "none", "mid", "good"],
      },
      {
        key: "price",
        get label() {
          return priced("Cost");
        },
        type: "money",
      },
      {
        key: "paints",
        label: "Recipe paints",
        type: "links",
        to: "paints",
        plan: true, // add paints you don't own yet (catalogue.js)
      },
      { key: "recipe", label: "Recipe steps", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      "name",
      "faction",
      "project",
      "quantity",
      "painted",
      "status",
      "paints",
    ],
    filter: "status",
    defaultSort: { key: "status", dir: 1 }, // least finished first
  },
  projects: {
    title: "Army projects",
    noun: "army project",
    sub: "Track complete forces, goals, budgets and progress",
    fields: [
      { key: "name", label: "Project name", required: true },
      {
        key: "faction",
        label: "Faction",
        suggest: true,
        suggestFrom: ["miniatures", "projects"], // shared by both
      },
      { key: "system", label: "Game system", suggest: "gameSystems" },
      { key: "target", label: "Target model count", type: "count" },
      {
        key: "budget",
        get label() {
          return priced("Budget");
        },
        type: "money",
      },
      {
        key: "deadline",
        label: "Target date",
        type: "date",
        doneWhen: (p) => projectDone(p),
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    computed: {
      progress: {
        label: "Progress",
        type: "percent",
        value: (p) => projectStats(p).percent,
      },
      painted: {
        label: "Painted",
        type: "count",
        value: (p) => projectStats(p).painted,
      },
      models: {
        label: "Models owned",
        type: "count",
        value: (p) => projectStats(p).models,
      },
      spent: {
        label: "Spent",
        type: "money",
        value: (p) => projectStats(p).spent,
      },
    },
    columns: [
      "name",
      "faction",
      "system",
      "progress",
      "painted",
      "models",
      "target",
      "spent",
      "deadline",
    ],
    filter: "system",
    under: (p) => projectRewardsHtml(p), // rewards, under the name
    defaultSort: { key: "deadline", dir: 1 }, // soonest target date first
  },
  queue: {
    title: "Painting queue",
    noun: "queue item",
    sub: "Prioritised models awaiting paint",
    view: "queueView",
    fields: [
      { key: "name", label: "Queue item", required: true },
      {
        key: "miniature",
        label: "Miniature",
        type: "link",
        to: "miniatures",
      },
      { key: "project", label: "Army project", type: "link", to: "projects" },
      {
        key: "stage",
        label: "Stage",
        type: "select",
        options: ["Not started", ...DEFAULT_STAGES, "Complete"],
        optionsFor: (q) => queueStages(q), // the item's own stages
      },
      { key: "models", label: "Model count", type: "count" },
      {
        key: "due",
        label: "Target date",
        type: "date",
        doneWhen: (q) => q.stage === "Complete",
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  skills: {
    title: "Skill proficiency",
    nav: "Skills",
    noun: "skill",
    sub: "Track development from 0 to 9",
    view: "skillsView",
    fields: [
      { key: "name", label: "Skill", required: true },
      { key: "level", label: "Proficiency 0-9", type: "level" },
      { key: "goal", label: "Next practice goal" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  wishlist: {
    title: "Wishlist",
    noun: "wishlist item",
    sub: "Future paints, tools and miniatures",
    fields: [
      { key: "name", label: "Wanted item", required: true },
      {
        key: "category",
        label: "Category",
        type: "select",
        options: ["Paint", "Tool", "Miniature", "Terrain", "Book", "Other"],
      },
      {
        key: "priority",
        label: "Priority",
        type: "scale",
        options: ["Low", "Medium", "High"],
        tones: ["none", "mid", "bad"],
      },
      { key: "paint", label: "Restocks paint", type: "link", to: "paints" },
      {
        key: "rewardFor",
        label: "Reward for project",
        type: "link",
        to: "projects",
      },
      { key: "rewardAt", label: "Unlocks at project % done", type: "percent" },
      {
        key: "price",
        get label() {
          return priced("Expected cost");
        },
        type: "money",
      },
      { key: "url", label: "Product URL", type: "url" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    computed: {
      reward: {
        label: "Reward",
        type: "text",
        value: (w) => rewardText(w),
        html: (w) => rewardHtml(w),
      },
    },
    columns: ["name", "category", "priority", "reward", "price", "url"],
    filter: "priority",
    defaultSort: { key: "priority", dir: -1 }, // highest priority first
  },
};
// A field or computed column of collection `d`, by key.
function column(d, key) {
  return d.computed?.[key] || d.fields.find((f) => f.key === key);
}
// The record that link field `f` points at, or undefined if it's gone.
function linked(f, value) {
  return value ? db[f.to].find((r) => r.id === value) : undefined;
}
// The ids in a `links` field. Tolerates missing or malformed values.
function asList(value) {
  return Array.isArray(value) ? value.filter((x) => typeof x === "string") : [];
}
// Every record a `links` field points at that still exists.
function linkedAll(f, value) {
  return asList(value)
    .map((v) => linked(f, v))
    .filter(Boolean);
}
// How a record is named in a picker; paints include their brand.
function optionLabel(r) {
  return r.brand ? `${r.name} (${r.brand})` : String(r.name ?? "");
}

// A project is done once its progress reaches its target (or, with no
// target, every model it owns).
function projectDone(p) {
  let st = projectStats(p);
  return st.goal > 0 && st.progress >= st.goal;
}
//
// `progress` counts work in progress too, in models: each model is worth
// its queue item's stage share (Basecoating, step 3 of 6, is half a model;
// Complete is a whole one). A miniature counts the more of its painted
// count and its queue work, up to its model count, so nothing is counted
// twice. Queue items linked to the project but to no miniature add their
// work too. `percent` is progress out of the goal (target, else models
// owned), rounded down, so 100% means really done.
function projectStats(p) {
  let minis = db.miniatures.filter((m) => m.project === p.id),
    work = new Map(),
    loose = 0;
  for (let q of db.queue) {
    let m = linked(column(defs.queue, "miniature"), q.miniature);
    if (m?.project === p.id)
      work.set(m.id, (work.get(m.id) || 0) + queueWork(q));
    else if (!m && q.project === p.id) loose += queueWork(q);
  }
  let models = minis.reduce((a, m) => a + (Number(m.quantity) || 1), 0),
    progress =
      loose +
      minis.reduce((a, m) => {
        let size = Number(m.quantity) || 1,
          painted = Math.min(size, Number(m.painted) || 0);
        return a + Math.min(size, Math.max(painted, work.get(m.id) || 0));
      }, 0),
    goal = Number(p.target) || models;
  return {
    models,
    painted: minis.reduce((a, m) => a + Number(m.painted || 0), 0),
    spent: minis.reduce((a, m) => a + Number(m.price || 0), 0),
    goal,
    progress,
    percent: goal > 0 ? Math.min(100, Math.floor((100 * progress) / goal)) : 0,
  };
}
