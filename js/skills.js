// The skills page: skill cards with sliders, the skill profile,
// practice suggestions and the technique picker. The levels and the
// technique library are in skillguide.js.
"use strict";

function renderSkills() {
  renderSkillPicker();
  renderSkillOverview();
  let guide = document.querySelector("#levelGuide");
  if (!guide.children.length)
    guide.innerHTML = LEVELS.map(
      ([name, meaning]) => `<li><b>${name}:</b> ${meaning}</li>`,
    ).join("");
  document.querySelector("#skillsContent").innerHTML = db.skills
    .map((s) => {
      let level = skillLevel(s),
        sid = esc(s.id),
        next = nextStep(s);
      // A skill from the library gets its next step; one of your own shows
      // your goal, or says there isn't one.
      let goal = s.goal
        ? `<div class="muted">Your goal: ${esc(s.goal)}</div>`
        : next
          ? ""
          : '<div class="muted">No practice goal</div>';
      let d = skillDifficulty(s);
      return `<div class="skill" data-card="${sid}"><div class="skilltop"><span><b>${esc(s.name)}</b>${d ? ` <span class="pill diff">${d}</span>` : ""}</span><strong class="lvl">${level}/9 · ${levelName(level)}</strong></div><input type="range" min="0" max="9" value="${level}" data-skill="${sid}" aria-label="${esc(s.name)} proficiency" aria-valuetext="${levelText(level)}"><p class="nextstep"${next ? "" : " hidden"}><span class="muted">Next step:</span> <span class="steptext">${esc(next)}</span></p>${goal}${toolNeedsHtml(s)}<div class="muted changed">${changedText(s)}</div><div class="rowacts"><button data-edit="${sid}">Edit notes</button><button class="del" data-del="${sid}">Delete</button></div></div>`;
    })
    .join("");
}
// Redraw one card's level, next step and date in place, so a slider being
// dragged isn't replaced.
function updateSkillCard(s) {
  let card = document.querySelector(`[data-card="${CSS.escape(s.id)}"]`),
    level = skillLevel(s);
  if (!card) return;
  card.querySelector(".lvl").textContent = `${level}/9 · ${levelName(level)}`;
  card.querySelector("input").setAttribute("aria-valuetext", levelText(level));
  card.querySelector(".steptext").textContent = nextStep(s);
  card.querySelector(".changed").textContent = changedText(s);
}
// The library techniques you haven't added, easiest first, then "Other"
// to name your own.
function renderSkillPicker() {
  let pick = document.querySelector("#skillAdd select"),
    chosen = pick.value,
    left = TECHNIQUES.filter(
      (t) => !db.skills.some((s) => sameName(s.name, t.name)),
    ).sort(
      (a, b) =>
        DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty),
    );
  pick.innerHTML = `<option value="">Add a technique…</option>${left
    .map(
      (t) =>
        `<option value="${esc(t.name)}">${esc(t.name)} · ${t.difficulty}</option>`,
    )
    .join("")}<option value="other">Other: name your own…</option>`;
  pick.value = [...pick.options].some((o) => o.value === chosen) ? chosen : "";
}
// The profile (every skill's level, highest first) and practice suggestions.
function renderSkillOverview() {
  let byLevel = [...db.skills].sort((a, b) => skillLevel(b) - skillLevel(a));
  document.querySelector("#skillProfile").innerHTML = byLevel.length
    ? byLevel
        .map((s) => {
          let level = skillLevel(s);
          return `<li><span class="mname">${esc(s.name)}</span><span class="meter" aria-hidden="true"><i style="width:${Math.round((level / 9) * 1000) / 10}%"></i></span><span class="mval">${level} · ${levelName(level)}</span></li>`;
        })
        .join("")
    : '<li class="muted">No skills yet. Add one above.</li>';
  let picks = practiceNext(db.skills);
  document.querySelector("#practice").innerHTML = picks.length
    ? `<ol class="practice">${picks
        .map(({ skill, reason }) => {
          let advice = nextStep(skill) || skill.goal || "";
          return `<li><b>${esc(skill.name)}</b> <span class="muted">· ${reason}</span>${advice ? `<div>${esc(advice)}</div>` : ""}</li>`;
        })
        .join("")}</ol>`
    : `<p class="muted">${db.skills.length ? "Every skill is at Mastery." : "Add a skill to get suggestions."}</p>`;
}
// The skill picker: a technique from the library, or "Other" with a name.
function addSkill(form) {
  let { pick, name: input } = form.elements,
    name = (pick.value === "other" ? input.value : pick.value).trim();
  if (!name) return;
  if (db.skills.some((s) => sameName(s.name, name)))
    return toast(`"${name}" is already in your skills`);
  let added = commitWithUndo(
    () =>
      db.skills.push({
        id: id(),
        name,
        level: 0,
        notes: "",
        goal: "",
        changed: today(),
      }),
    () => `Added "${name}"`,
  );
  if (!added) return;
  input.value = "";
  input.hidden = true;
  input.required = false;
  pick.value = "";
  pick.focus();
}

// The tools a skill's technique needs, under its card: each with whether
// you have it, and if not, Add to wishlist (unless it's there) and Bought.
function toolMatches(name, text) {
  let x = String(text ?? "").toLowerCase();
  return (TECHNIQUE_TOOLS[name]?.match || []).some((m) => x.includes(m));
}
function ownedTool(name) {
  return db.tools.find((t) => toolMatches(name, t.name));
}
function wishedTool(name) {
  return db.wishlist.find(
    (w) => w.category === "Tool" && toolMatches(name, w.name),
  );
}
function toolNeedsHtml(s) {
  let tools = technique(s?.name)?.tools || [];
  if (!tools.length) return "";
  return `<div class="needs"><span class="muted">Needs:</span><ul>${tools
    .map((name) => {
      let have = ownedTool(name),
        wish = !have && wishedTool(name),
        n = esc(name),
        state = have
          ? `you have ${esc(have.name)}`
          : wish
            ? "on your wishlist"
            : "not in your tools",
        buttons = have
          ? ""
          : `<span class="rowacts">${wish ? "" : `<button data-toolwish="${n}" aria-label="Add to wishlist: ${n}">Add to wishlist</button>`}<button data-toolbought="${n}" aria-label="Bought: ${n}">Bought</button></span>`;
      return `<li><b>${n}</b> <span class="muted">· ${state}</span>${buttons}</li>`;
    })
    .join("")}</ul></div>`;
}
// Add to wishlist: the tool, as a Tool item, with Undo.
function toolWish(name, card) {
  if (!TECHNIQUE_TOOLS[name] || ownedTool(name) || wishedTool(name)) return;
  let added = commitWithUndo(
    () =>
      db.wishlist.push({
        id: id(),
        name,
        category: "Tool",
        priority: "Medium",
      }),
    () => `Added "${name}" to your wishlist`,
  );
  if (!added) return;
  renderNav();
  renderSkills();
  refocus(`[data-card="${CSS.escape(card || "")}"] [data-toolbought]`);
}
// Bought: the tool goes into your tools (New, quantity 1), with Undo. A
// matching wishlist item comes off the wishlist and gives its name, price
// and notes, as the wishlist's Bought does.
function toolBought(name, card) {
  let t = TECHNIQUE_TOOLS[name];
  if (!t || ownedTool(name)) return;
  let w = wishedTool(name),
    tool = w
      ? boughtRecord("tools", w)
      : {
          id: id(),
          name,
          price: "",
          notes: "",
          quantity: "1",
          condition: "New",
        };
  let bought = commitWithUndo(
    () => {
      if (w) db.wishlist = db.wishlist.filter((x) => x.id !== w.id);
      db.tools.push({ ...tool, category: t.category });
    },
    () => `Bought "${tool.name}": it's in your tools`,
  );
  if (!bought) return;
  renderNav();
  renderSkills();
  refocus(`[data-card="${CSS.escape(card || "")}"] input`);
}
