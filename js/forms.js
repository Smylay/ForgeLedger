// The add/edit form: inputs per field type, validation and saving.
"use strict";

// HTML attributes for each input type that uses a plain <input>.
const inputAttrs = {
  text: 'type="text"',
  date: 'type="date"',
  url: 'type="url" pattern="https?://.+" title="Starts with http:// or https://"',
  count: 'type="number" min="0" step="1"',
  money: 'type="number" min="0" step="0.01"',
  percent: 'type="number" min="0" max="100" step="1"',
  level: 'type="number" min="0" max="9" step="1"',
};
function fieldHtml(f, obj) {
  let v = obj[f.key] ?? "",
    name = `name="${f.key}"`,
    req = f.required ? "required" : "";
  if (f.type === "select" || f.type === "scale")
    return `<label>${f.label}<select ${name} ${req}><option value="">Select...</option>${(f.optionsFor?.(obj) || f.options).map((o) => `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  if (f.type === "link")
    return `<label>${f.label}<select ${name}><option value="">None</option>${db[f.to].map((r) => `<option value="${esc(r.id)}" ${v === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`;
  if (f.type === "links") {
    let chosen = asList(v),
      all = db[f.to];
    return `<label class="full">${f.label}<select ${name} multiple size="${Math.min(6, Math.max(3, all.length))}">${all.map((r) => `<option value="${esc(r.id)}" ${chosen.includes(r.id) ? "selected" : ""}>${esc(optionLabel(r))}</option>`).join("")}</select><small class="muted">${all.length ? "Ctrl-click (⌘-click on a Mac) to pick several." : `No ${defs[f.to].title.toLowerCase()} yet.`}</small></label>`;
  }
  if (f.type === "textarea")
    return `<label class="full">${f.label}<textarea ${name}>${esc(v)}</textarea></label>`;
  if (f.type === "color") {
    // A colour picker can't be empty, so "No colour" is a separate choice.
    let c = safeColour(v);
    if (c.length === 4) c = "#" + [...c.slice(1)].map((h) => h + h).join("");
    return `<div class="colourfield"><label>${f.label}<input ${name} type="color" value="${c || "#808080"}"></label><label class="check"><input type="checkbox" data-nocolour="${f.key}" ${c ? "" : "checked"}> No colour</label></div>`;
  }
  return `<label>${f.label}<input ${name} ${inputAttrs[f.type || "text"]} value="${esc(v)}" ${req}></label>`;
}
// Open the add/edit form for a record of collection `sec`, on any page:
// adding a reward from the projects page opens a wishlist form. `obj` is
// the record to edit, or starting values for a new one (no `id`).
function openForm(sec = section, obj = {}) {
  let d = defs[sec];
  formSection = sec;
  editId = obj.id || null;
  document.querySelector("#modalTitle").textContent =
    (editId ? "Edit " : "Add ") + d.noun;
  document.querySelector("#formFields").innerHTML = d.fields
    .map((f) => fieldHtml(f, obj))
    .join("");
  document.querySelector("#modal").showModal();
}
function submit(e) {
  e.preventDefault();
  let form = e.target,
    d = defs[formSection],
    fd = new FormData(form),
    o = Object.fromEntries(fd);
  // Rules the browser can't check on its own, e.g. painted <= model count.
  for (let f of d.fields)
    if (f.atMost) {
      let over =
        o[f.key] !== "" &&
        o[f.atMost] !== "" &&
        Number(o[f.key]) > Number(o[f.atMost]);
      form.elements[f.key].setCustomValidity(
        over
          ? `Can't be more than the ${column(d, f.atMost).label.toLowerCase()}.`
          : "",
      );
    }
  if (!form.reportValidity()) return;
  for (let f of d.fields) {
    if (f.type === "level")
      o[f.key] = Math.max(0, Math.min(9, Math.round(Number(o[f.key]) || 0)));
    if (
      f.type === "color" &&
      form.querySelector(`[data-nocolour="${f.key}"]`).checked
    )
      o[f.key] = "";
    if (f.type === "links") o[f.key] = fd.getAll(f.key);
  }
  o.id = editId || id();
  let prev = db[formSection].find((x) => x.id === o.id);
  // A queue item moved to another stage starts that stage's count again.
  if (formSection === "queue" && prev && prev.stage !== o.stage)
    o.stageDone = 0;
  // Skills record when their level last changed, for practice suggestions.
  if (formSection === "skills" && (!prev || skillLevel(prev) !== o.level))
    o.changed = today();
  let saved = commit(() => {
    let arr = db[formSection],
      i = arr.findIndex((x) => x.id === o.id);
    // Merge, so fields the form doesn't show (like a queue item's stage
    // count, or fields from older versions) survive an edit.
    if (i >= 0) arr[i] = { ...arr[i], ...o };
    else arr.push(o);
    // A split queue item: choosing another stage puts every model there;
    // otherwise keep its stage in step, as the model count may have changed.
    let q = arr[i >= 0 ? i : arr.length - 1];
    if (formSection === "queue" && isSplit(q)) {
      if (prev.stage !== o.stage) delete q.split;
      else storeSplit(q, splitCounts(q));
    }
  });
  if (!saved) return; // keep the form open so nothing typed is lost
  document.querySelector("#modal").close();
  toast("Saved");
  renderNav();
  render();
  if (
    formSection === "queue" &&
    o.stage === "Complete" &&
    prev?.stage !== "Complete"
  )
    askComplete(o);
}
