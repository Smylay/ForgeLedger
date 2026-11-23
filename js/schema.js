// Storage keys, defaults, and `defs`, the config that describes every
// collection; plus helpers for reading linked records and project stats.
"use strict";

const KEY = "forgeledger_v2_data";
// Bump when stored data changes shape, and add a step to migrate().
const SCHEMA_VERSION = 1;
const BACKUP_KEY = "forgeledger_v2_last_backup";
const RECOVERY_PREFIX = "forgeledger_v2_recovered_";
const BACKUP_REMINDER_DAYS = 14;
const DUE_SOON_DAYS = 14; // dates this close get a "Due in N days" marker
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
// date, url, color, count, money, percent, level.
const defs = {
  paints: {
    title: "Paints",
    noun: "paint",
    sub: "Brands, ranges, stock and replacement warnings",
    fields: [
      { key: "name", label: "Paint name", required: true },
      { key: "brand", label: "Brand" },
      { key: "range", label: "Range" },
      { key: "colour", label: "Colour / hex", type: "color" },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: [
          "Base",
          "Layer",
          "Shade",
          "Contrast/Speedpaint",
          "Metallic",
          "Technical",
          "Ink",
          "Medium",
          "Other",
        ],
      },
      { key: "quantity", label: "Quantity", type: "count" },
      { key: "remaining", label: "Remaining %", type: "percent" },
      { key: "price", label: "Cost (£)", type: "money" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: ["name", "brand", "range", "type", "quantity", "remaining"],
    filter: "type",
  },
  tools: {
    title: "Tools",
    noun: "tool",
    sub: "Brushes, airbrush equipment and hobby supplies",
    fields: [
      { key: "name", label: "Tool", required: true },
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
        type: "select",
        options: ["New", "Good", "Worn", "Replace soon"],
      },
      { key: "quantity", label: "Quantity", type: "count" },
      { key: "price", label: "Cost (£)", type: "money" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: ["name", "category", "condition", "quantity", "price"],
    filter: "category",
  },
  miniatures: {
    title: "Miniatures",
    noun: "miniature",
    sub: "Models, units and their painting state",
    fields: [
      { key: "name", label: "Miniature / unit", required: true },
      { key: "faction", label: "Faction" },
      { key: "project", label: "Army project", type: "link", to: "projects" },
      { key: "quantity", label: "Model count", type: "count" },
      {
        key: "painted",
        label: "Painted count",
        type: "count",
        atMost: "quantity",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["Unbuilt", "Built", "Primed", "In progress", "Complete"],
      },
      { key: "price", label: "Cost (£)", type: "money" },
      { key: "paints", label: "Recipe paints", type: "links", to: "paints" },
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
  },
  projects: {
    title: "Army projects",
    noun: "army project",
    sub: "Track complete forces, goals, budgets and progress",
    fields: [
      { key: "name", label: "Project name", required: true },
      { key: "faction", label: "Faction" },
      { key: "system", label: "Game system" },
      { key: "target", label: "Target model count", type: "count" },
      { key: "budget", label: "Budget (£)", type: "money" },
      {
        key: "deadline",
        label: "Target date",
        type: "date",
        doneWhen: (p) => projectDone(p),
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    computed: {
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
      "painted",
      "models",
      "target",
      "spent",
      "deadline",
    ],
    filter: "system",
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
        options: [
          "Not started",
          "Building",
          "Priming",
          "Basecoating",
          "Detailing",
          "Basing",
          "Complete",
        ],
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
        type: "select",
        options: ["Low", "Medium", "High"],
      },
      { key: "paint", label: "Restocks paint", type: "link", to: "paints" },
      { key: "price", label: "Expected cost (£)", type: "money" },
      { key: "url", label: "Product URL", type: "url" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: ["name", "category", "priority", "price", "url"],
    filter: "priority",
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
// A paint is low when its Remaining % is set and under 20.
function isLow(p) {
  return p.remaining !== "" && p.remaining != null && Number(p.remaining) < 20;
}
// The low paints a miniature's recipe uses.
function lowRecipePaints(m) {
  return m
    ? linkedAll(column(defs.miniatures, "paints"), m.paints).filter(isLow)
    : [];
}
// How a record is named in a picker; paints include their brand.
function optionLabel(r) {
  return r.brand ? `${r.name} (${r.brand})` : String(r.name ?? "");
}

// A project is done once its painted count reaches its target (or, with
// no target, every model it owns).
function projectDone(p) {
  let st = projectStats(p),
    goal = Number(p.target) || st.models;
  return goal > 0 && st.painted >= goal;
}
function projectStats(p) {
  let minis = db.miniatures.filter((m) => m.project === p.id);
  return {
    models: minis.reduce((a, m) => a + Number(m.quantity || 1), 0),
    painted: minis.reduce((a, m) => a + Number(m.painted || 0), 0),
    spent: minis.reduce((a, m) => a + Number(m.price || 0), 0),
  };
}
