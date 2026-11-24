// Quick changes that work in every list: delete with Undo, one-tap levels,
// +/− counts and quick add.
"use strict";

// Delete a record and offer Undo. Links to it from other records, such as
// miniatures in a deleted project, are cleared.
function remove(sec, recordId) {
  let item = db[sec].find((x) => x.id === recordId),
    unlinked = 0;
  if (!item) return;
  commitWithUndo(
    () => {
      db[sec] = db[sec].filter((x) => x.id !== recordId);
      for (let [k, d] of Object.entries(defs))
        for (let f of d.fields)
          if (f.to === sec)
            for (let r of db[k])
              if (r[f.key] === recordId) {
                r[f.key] = "";
                unlinked++;
              } else if (asList(r[f.key]).includes(recordId)) {
                r[f.key] = asList(r[f.key]).filter((x) => x !== recordId);
                unlinked++;
              }
    },
    () =>
      `Deleted "${item.name}"` +
      (unlinked ? ` and unlinked ${unlinked} item(s) from it` : ""),
  );
}

// One tap on a level button (paint stock, miniature status, …): save it,
// then redraw only that row so it keeps its place and keyboard focus
// stays on the chosen button.
function setScale(b) {
  let f = column(defs[section], b.dataset.scale),
    rec = db[section].find((x) => x.id === b.dataset.id),
    value = b.dataset.value;
  if (!rec || f?.type !== "scale" || !f.options.includes(value)) return;
  if (!commit(() => (rec[f.key] = value))) return;
  redrawRow(rec, `[data-scale="${f.key}"][aria-pressed="true"]`);
}

// One tap on - or +: change a count by one within its limits, then redraw
// the row (its other counts may have new limits) and keep focus on the
// button, or on the other one if this one is now at its limit.
function stepCount(b) {
  let d = defs[section],
    f = column(d, b.dataset.key),
    rec = db[section].find((x) => x.id === b.dataset.id),
    delta = Number(b.dataset.step);
  if (!rec || !f?.stepper || Math.abs(delta) !== 1) return;
  let blank = rec[f.key] === "" || rec[f.key] == null,
    next = (Number(rec[f.key]) || 0) + delta,
    { lo, hi } = stepRange(d, f, rec);
  if ((blank && delta < 0) || next < lo || (hi !== null && next > hi)) return;
  if (!commit(() => (rec[f.key] = String(next)))) return;
  let btn = (step) => `[data-key="${f.key}"][data-step="${step}"]`;
  redrawRow(rec, btn(delta), btn(-delta));
}

function quickAdd(form) {
  let input = form.elements.name,
    name = input.value.trim();
  if (!name || !defs[section]) return;
  document.querySelector("#search").value = "";
  document.querySelector("#filter").value = "";
  let added = commitWithUndo(
    () => db[section].push({ id: id(), name }),
    () => `Added "${name}"`,
  );
  if (!added) return;
  input.value = "";
  input.focus();
}
