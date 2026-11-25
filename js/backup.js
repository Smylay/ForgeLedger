// Backups and exports: the JSON backup (photos included), importing
// one, and CSV export of a list.
"use strict";

// A backup is the data, the app version that made it, and the images its
// photos use (see photos.js).
async function backupJson(data) {
  let photos = await backupPhotos(data);
  return JSON.stringify(
    {
      appVersion: APP_VERSION,
      ...data,
      ...(Object.keys(photos).length ? { photos } : {}),
    },
    null,
    2,
  );
}

async function exportJSON() {
  download(await backupJson(db), `forgeledger-backup-${today()}.json`);
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {}
  renderBackupState();
  if (section === "dashboard") renderDashboard();
}
function importJSON(file) {
  let r = new FileReader();
  r.onload = async () => {
    let data, problem;
    try {
      data = parseData(r.result);
      problem = problemWith(data);
    } catch {
      problem = "it isn't valid JSON";
    }
    if (problem) return toast(`Can't import this file: ${problem}.`, 5000);
    if (hasUserData()) {
      if (
        !confirm(
          "Replace all current data with this backup?\n\nA copy of your current data will be downloaded first.",
        )
      )
        return;
      download(
        await backupJson(db),
        `forgeledger-before-import-${today()}.json`,
      );
    }
    // Store the backup's images first; they never go into localStorage.
    // Nor does the version that made it.
    let incoming = photosFromBackup(data.photos),
      stored = 0,
      made =
        typeof data.appVersion === "string" ? data.appVersion.slice(0, 20) : "";
    delete data.photos;
    delete data.appVersion;
    if (incoming.length && (await photosWork()))
      try {
        await putPhotos(incoming);
        stored = incoming.length;
      } catch {}
    let next = withCurrency(fromBackup(data));
    if (!commit(() => (db = next))) return;
    newRewards = []; // rewards in a backup were unlocked elsewhere
    renderRewardNotice();
    go("dashboard");
    let from =
      made && made !== APP_VERSION ? ` (made by ForgeLedger ${made})` : "";
    toast(
      stored < incoming.length
        ? `Backup imported${from}, but its ${incoming.length - stored} photo(s) couldn't be stored in this browser`
        : `Backup imported${from}`,
      stored < incoming.length || from ? 6000 : 1800,
    );
  };
  r.readAsText(file);
}

function csv() {
  let arr = db[section];
  if (!arr.length) return toast("Nothing to export");
  let keys = [...new Set(arr.flatMap(Object.keys))],
    cell = (v) => {
      let s = String(v ?? "");
      // Stop spreadsheets running a cell as a formula; plain numbers are kept.
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    },
    text = [
      keys.map(cell).join(","),
      ...arr.map((o) => keys.map((k) => cell(o[k])).join(",")),
    ].join("\n");
  download(text, section + ".csv", "text/csv");
}
