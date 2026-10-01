/**
 * Survei HP Komunitas - Google Apps Script
 * Pasang lewat: Spreadsheet > Ekstensi > Apps Script
 *
 * LANGKAH:
 * 1. Tempel kode ini, klik Simpan.
 * 2. Pilih fungsi "setup" di menu atas, klik Jalankan, lalu setujui izin akses.
 * 3. Deploy > New deployment > Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Salin URL (berakhiran /exec) ke app.js.
 * Setelah mengubah kode: Deploy > Manage deployments > Edit > Version: New version.
 */
const SHEET_NAME = "Responses";
const HEADERS = ["Timestamp", "Nama", "Merek", "Model", "JamPerHari", "Aktivitas", "Budget", "Kepuasan", "Komentar"];

function setup() {
  getSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast("Sheet '" + SHEET_NAME + "' siap dipakai.");
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function out_(obj, callback) {
  const text = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + text + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

// Mencegah formula injection di spreadsheet
function clean_(v, max) {
  let s = String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max || 100);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    let d = {};
    try { d = JSON.parse((e && e.postData && e.postData.contents) || "{}"); }
    catch (x) { return out_({ ok: false, error: "Format data tidak valid" }); }

    if (d.website) return out_({ ok: true }); // jebakan bot

    // Buang kiriman ganda (ID yang sama)
    const cache = CacheService.getScriptCache();
    const id = clean_(d.id, 80);
    if (id && cache.get("sub_" + id)) return out_({ ok: true, duplicate: true });

    const nama = clean_(d.nama, 60), merek = clean_(d.merek, 40), model = clean_(d.model, 60);
    const aktivitas = clean_(d.aktivitas, 40), budget = clean_(d.budget, 40), komentar = clean_(d.komentar, 300);
    const jam = Number(d.jam), kepuasan = Number(d.kepuasan);

    if (!nama || !merek || !model || !aktivitas || !budget) return out_({ ok: false, error: "Data belum lengkap" });
    if (!(jam >= 0 && jam <= 24)) return out_({ ok: false, error: "Durasi tidak valid" });
    if (!(kepuasan >= 1 && kepuasan <= 5)) return out_({ ok: false, error: "Nilai kepuasan tidak valid" });

    getSheet_().appendRow([new Date(), nama, merek, model, jam, aktivitas, budget, kepuasan, komentar]);
    SpreadsheetApp.flush();
    if (id) cache.put("sub_" + id, "1", 21600);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet(e) {
  const cb = e && e.parameter && e.parameter.callback;
  try {
    const sh = getSheet_();
    const last = sh.getLastRow();
    const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];

    const brandCounts = {}, activityCounts = {}, budgetCounts = {};
    let hours = 0, sat = 0;
    const inc = (o, k) => { k = String(k || "").trim(); if (k) o[k] = (o[k] || 0) + 1; };

    rows.forEach((r) => {
      inc(brandCounts, r[2]);
      inc(activityCounts, r[5]);
      inc(budgetCounts, r[6]);
      hours += Number(r[4]) || 0;
      sat += Number(r[7]) || 0;
    });

    const n = rows.length;
    return out_({
      ok: true,
      total: n,
      brands: Object.keys(brandCounts).length,
      avgHours: n ? Math.round((hours / n) * 10) / 10 : 0,
      avgSat: n ? Math.round((sat / n) * 10) / 10 : 0,
      brandCounts: brandCounts,
      activityCounts: activityCounts,
      budgetCounts: budgetCounts
    }, cb);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, cb);
  }
}
