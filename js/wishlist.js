// The wishlist: adding low paints, the Bought button, and rewards that
// unlock when a project reaches a percentage.
"use strict";

// Add restock entries for paints to the wishlist, linked to each paint.
function addToWishlist(paints) {
  if (!paints.length) return;
  commitWithUndo(
    () => {
      for (let p of paints)
        db.wishlist.push({
          id: id(),
          name: optionLabel(p),
          category: "Paint",
          priority: "High",
          paint: p.id,
          price: p.price || "",
          url: "",
          notes: "Restock",
        });
    },
    () =>
      paints.length === 1
        ? `Added "${optionLabel(paints[0])}" to the wishlist`
        : `Added ${paints.length} paints to the wishlist`,
  );
}

// Wishlist categories that have a list to go into when bought.
const BOUGHT_TO = { Paint: "paints", Tool: "tools", Miniature: "miniatures" };

// "Bought" on a wishlist row. A restock (linked to a paint that still
// exists) sets that paint back to Full; Paint, Tool and Miniature items
// are added to that list; anything else asks where it goes. `b` is the
// button, so focus can move to the next row's Bought afterwards.
function bought(b) {
  let w = db.wishlist.find((x) => x.id === b.dataset.bought);
  if (!w) return;
  let row = [...document.querySelectorAll("[data-bought]")].indexOf(b),
    paint = linked(column(defs.wishlist, "paint"), w.paint),
    to = BOUGHT_TO[w.category];
  if (paint || to) {
    if (buy(w, to, paint)) focusBought(row);
    return;
  }
  buying = { id: w.id, row };
  document.querySelector("#boughtText").textContent =
    `Where should "${w.name}" go? It comes off the wishlist either way.`;
  let choice = w.category === "Terrain" ? "miniatures" : "";
  for (let r of document.querySelectorAll("#boughtForm [name=to]"))
    r.checked = r.value === choice;
  document.querySelector("#boughtDialog").showModal();
}
// The Bought prompt's Apply.
function applyBought(to) {
  let w = buying && db.wishlist.find((x) => x.id === buying.id);
  if (w) buy(w, to || null, null);
}
// Take `w` off the wishlist, and restock `paint` or add a record to the
// `to` list (or neither), all with one Undo. Returns whether it saved.
function buy(w, to, paint) {
  let record = !paint && to ? boughtRecord(to, w) : null;
  return commitWithUndo(
    () => {
      db.wishlist = db.wishlist.filter((x) => x.id !== w.id);
      if (paint) {
        paint.stock = "Full";
        // A paint you planned with but didn't own (quantity 0) is one now,
        // at the item's price. Any other is a restock, recorded for
        // Recorded spend (paints.js).
        if (paint.quantity === "0") {
          paint.quantity = "1";
          if (!paint.price && w.price) paint.price = w.price;
        } else addRestock(paint, w.price);
      }
      if (record) db[to].push(record);
    },
    () =>
      paint
        ? `Bought "${w.name}": "${paint.name}" is Full again${amount(w.price) ? `, ${money(amount(w.price))} recorded` : ""}`
        : record
          ? `Bought "${w.name}": added to ${defs[to].nav || defs[to].title}`
          : `Bought "${w.name}": taken off the wishlist`,
  );
}
// A new paint, tool or miniature from a wishlist item: its name, price
// and notes, with the product link added to the notes.
function boughtRecord(to, w) {
  let link = safeUrl(w.url),
    notes = [w.notes, link && `Bought from ${link}`].filter(Boolean).join("\n"),
    r = { id: id(), name: w.name, price: w.price || "", notes };
  if (to === "paints") return { ...r, quantity: "1", stock: "Full" };
  if (to === "tools") return { ...r, quantity: "1", condition: "New" };
  // Its model count isn't known. A project's item joins the project.
  return { ...r, status: "Unbuilt", ...(w.project && { project: w.project }) };
}
// After a row goes, focus the Bought button now in its place (or the last
// one), else the quick-add box.
function focusBought(row) {
  let all = document.querySelectorAll("[data-bought]");
  (
    all[Math.min(row, all.length - 1)] ||
    document.querySelector(".view.active .quickadd input")
  )?.focus();
}

// Wishlist rewards: an item with `rewardFor` (a project) unlocks when that
// project's progress reaches `rewardAt` percent (blank means 100). Null
// for items that aren't rewards, or whose project is gone.
function reward(w) {
  let p = linked(column(defs.wishlist, "rewardFor"), w.rewardFor);
  if (!p) return null;
  let at = w.rewardAt === "" || w.rewardAt == null ? 100 : Number(w.rewardAt);
  at = Number.isFinite(at) ? Math.max(0, Math.min(100, Math.round(at))) : 100;
  let st = projectStats(p),
    reached = st.goal > 0 ? (100 * st.progress) / st.goal : 0;
  // As for percent: shares added as fractions can fall a hair short.
  return {
    project: p,
    at,
    percent: st.percent,
    unlocked: reached + 1e-9 >= at,
  };
}
function unlockedRewards() {
  return db.wishlist.filter((w) => reward(w)?.unlocked).map((w) => w.id);
}
// After a change, add rewards it unlocked to `newRewards` (shown until
// dismissed), and drop any it locked again.
function noteRewards(was) {
  let now = unlockedRewards();
  newRewards = [
    ...newRewards.filter((rid) => now.includes(rid)),
    ...now.filter((rid) => !was.includes(rid) && !newRewards.includes(rid)),
  ];
  renderRewardNotice();
}

function rewardText(w) {
  let r = reward(w);
  if (!r) return "";
  return r.unlocked
    ? `Unlocked: ${r.project.name} reached ${r.at}%`
    : `Locked: ${r.project.name} ${r.percent}% of ${r.at}%`;
}

// A wishlist item's reward state, for its table cell and the dashboard.
function rewardHtml(w) {
  let r = reward(w);
  if (!r) return "";
  return r.unlocked
    ? `<span class="pill unlocked">Unlocked</span> ${esc(r.project.name)} reached ${r.at}%`
    : `<span class="pill locked">Locked</span> ${esc(r.project.name)}: ${r.percent}% of ${r.at}%`;
}
// Rewards unlocked by a change just now (`newRewards`), until dismissed or
// bought, on every page.
function renderRewardNotice() {
  let shown = newRewards
    .map((rid) => db.wishlist.find((w) => w.id === rid))
    .filter((w) => w && reward(w)?.unlocked);
  document.querySelector("#rewardNotice").innerHTML = shown
    .map((w) => {
      let r = reward(w),
        wid = esc(w.id),
        name = esc(w.name);
      return `<div class="notice reward">Reward unlocked: <b>${name}</b>. ${esc(r.project.name)} reached ${r.at}%. <button class="btn" data-bought="${wid}" aria-label="Bought: ${name}">Bought</button> <button class="btn" data-unreward="${wid}" aria-label="Dismiss: ${name}">Dismiss</button></div>`;
    })
    .join("");
}

// "Add all N to wishlist" on the dashboard: every low paint not already on it.
function addLowToWishlist() {
  let wanted = new Set(db.wishlist.map((w) => w.paint));
  addToWishlist(db.paints.filter((p) => isLow(p) && !wanted.has(p.id)));
}
// Dismiss a reward from the "unlocked" notice. It stays on the wishlist.
function dismissReward(rid) {
  newRewards = newRewards.filter((x) => x !== rid);
  renderRewardNotice();
}
// Under each project's name in the projects table: its rewards, and a
// button to add one.
function projectRewardsHtml(p) {
  let chips = db.wishlist
    .filter((w) => w.rewardFor === p.id)
    .map((w) => ({ w, r: reward(w) }))
    .filter((x) => x.r)
    .map(
      ({ w, r }) =>
        `<span class="rewardchip">${esc(w.name)} ${r.unlocked ? '<span class="pill unlocked">Unlocked</span>' : `<span class="pill locked">Unlocks at ${r.at}%</span>`}</span>`,
    )
    .join("");
  return `<div class="under">${chips}<span class="rowacts"><button data-addreward="${esc(p.id)}" aria-label="Add reward for ${esc(p.name)}">Add reward</button></span></div>`;
}
// "Add reward": a new wishlist item, for this project at 100%, from the
// projects page.
function addReward(pid) {
  openForm("wishlist", { rewardFor: pid, rewardAt: "100" });
}
