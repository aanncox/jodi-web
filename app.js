/* ============================================================
   ISI DI SINI: tempel URL Web App dari Google Apps Script
   (berakhiran /exec). Contoh:
   "https://script.google.com/macros/s/AKfycb.../exec"
   Kosongkan untuk melihat mode data contoh.
   ============================================================ */
const API_URL = "";

(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EMPTY = { total: 0, brands: 0, avgHours: 0, avgSat: 0, brandCounts: {}, activityCounts: {}, budgetCounts: {} };
  const DEMO = {
    total: 128, brands: 8, avgHours: 5.4, avgSat: 4.1,
    brandCounts: { Samsung: 34, Xiaomi: 26, Apple: 22, OPPO: 15, vivo: 12, realme: 9, Infinix: 6, POCO: 4 },
    activityCounts: { "Media sosial": 38, "Chat dan komunikasi": 29, Gaming: 24, "Streaming video": 21, "Belajar atau kerja": 11, Fotografi: 5 },
    budgetCounts: { "Di bawah 2 juta": 18, "2 sampai 5 juta": 52, "5 sampai 10 juta": 41, "Di atas 10 juta": 17 }
  };

  /* ---------- Scroll reveal ---------- */
  const targets = $$("[data-r],[data-io]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    targets.forEach((el) => io.observe(el));
  } else targets.forEach((el) => el.classList.add("in"));

  /* ---------- Nav & parallax ---------- */
  const nav = $("#nav"), mtn = $("#mtn");
  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("solid", y > 60);
    if (!reduce && mtn && y < 900) mtn.style.transform = "translateY(" + y * 0.12 + "px)";
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  /* ---------- Helpers ---------- */
  function countTo(el, to, dec) {
    dec = dec || 0;
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now(), dur = 1400;
    (function step(t) {
      const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function bars(el, obj, limit) {
    const items = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, limit || 8);
    if (!items.length) { el.innerHTML = '<p class="empty">Belum ada data. Jadilah yang pertama mengisi survei.</p>'; return; }
    const total = items.reduce((n, i) => n + i[1], 0) || 1;
    el.innerHTML = items.map(([k, v]) => {
      const pct = Math.round((v / total) * 100);
      return '<div class="bar"><div class="row"><span>' + esc(k) + '</span><span>' + v + " (" + pct + '%)</span></div><div class="track"><div class="fill" data-w="' + pct + '"></div></div></div>';
    }).join("");
    const run = () => $$(".fill", el).forEach((f, i) => setTimeout(() => (f.style.width = f.dataset.w + "%"), reduce ? 0 : i * 90));
    const host = el.closest(".panel") || el;
    if (host.classList.contains("in")) run();
    else {
      const o = new MutationObserver(() => { if (host.classList.contains("in")) { run(); o.disconnect(); } });
      o.observe(host, { attributes: true, attributeFilter: ["class"] });
    }
  }
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3800);
  }
  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Ambil statistik (fetch, cadangan JSONP) ---------- */
  function jsonp(url, timeout) {
    return new Promise((resolve, reject) => {
      const cb = "__cb" + Date.now() + Math.floor(Math.random() * 1e4);
      const s = document.createElement("script");
      const done = () => { clearTimeout(t); delete window[cb]; s.remove(); };
      const t = setTimeout(() => { done(); reject(new Error("timeout")); }, timeout || 15000);
      window[cb] = (d) => { done(); resolve(d); };
      s.onerror = () => { done(); reject(new Error("jsonp")); };
      s.src = url + (url.indexOf("?") > -1 ? "&" : "?") + "callback=" + cb;
      document.head.appendChild(s);
    });
  }
  async function fetchStats() {
    const url = API_URL + "?action=stats&_=" + Date.now();
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      return await jsonp(url);
    }
  }

  function render(d, demo) {
    $("#modeBadge").hidden = !demo;
    const top = Object.entries(d.brandCounts || {}).sort((a, b) => b[1] - a[1])[0];
    countTo($("#sTotal"), +d.total || 0);
    countTo($("#sBrand"), +d.brands || 0);
    countTo($("#sHours"), +d.avgHours || 0, 1);
    countTo($("#sSat"), +d.avgSat || 0, 1);
    $("#sTop").textContent = top ? top[0] : "-";
    bars($("#brandBars"), d.brandCounts, 8);
    bars($("#actBars"), d.activityCounts, 6);
    bars($("#budgetBars"), d.budgetCounts, 4);
  }

  async function loadStats() {
    if (!API_URL) { render(DEMO, true); return; }
    try {
      const data = await fetchStats();
      if (!data || !data.ok) throw new Error((data && data.error) || "Gagal memuat data");
      render(data, false);
    } catch (err) {
      console.error(err);
      render(EMPTY, false);
      toast("Data belum bisa dimuat. Cek URL Web App dan pengaturan akses.");
    }
  }

  /* ---------- Kirim form ---------- */
  const form = $("#form"), msg = $("#msg"), btn = $("#send");
  function setMsg(t, type) { msg.textContent = t; msg.className = "msg " + (type || ""); }

  async function postData(body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    let res;
    try {
      res = await fetch(API_URL, { method: "POST", body: body, signal: ctrl.signal }); // text/plain: tanpa preflight CORS
    } catch (netErr) {
      // Respons diblokir browser: kirim ulang dengan ID yang sama (server membuang duplikat)
      await fetch(API_URL, { method: "POST", mode: "no-cors", body: body });
      return { ok: true, opaque: true };
    } finally { clearTimeout(t); }
    let out;
    try { out = await res.json(); }
    catch (e) { const er = new Error("URL Web App salah atau akses belum diatur ke Anyone."); er.server = true; throw er; }
    if (!out.ok) { const er = new Error(out.error || "Gagal mengirim"); er.server = true; throw er; }
    return out;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    setMsg("");
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.website) return; // jebakan bot
    const need = ["nama", "merek", "model", "jam", "aktivitas", "budget", "kepuasan"];
    const miss = need.filter((k) => !String(data[k] || "").trim());
    if (miss.length) {
      setMsg("Lengkapi dulu semua isian yang wajib.", "err");
      const k = miss[0], f = k === "kepuasan" ? $("#k1") : form.elements[k];
      if (f && f.focus) f.focus();
      return;
    }
    if (!API_URL) { setMsg("URL Web App belum diisi di app.js, jadi data belum terkirim.", "err"); return; }

    data.id = uid();
    btn.disabled = true; btn.textContent = "Mengirim...";
    try {
      await postData(JSON.stringify(data));
      form.reset();
      setMsg("Terkirim. Terima kasih sudah ikut survei.", "ok");
      toast("Terkirim. Terima kasih!");
      setTimeout(loadStats, 1200);
    } catch (err) {
      console.error(err);
      setMsg(err.server ? err.message : "Belum terkirim. Periksa koneksi lalu coba lagi.", "err");
    } finally {
      btn.disabled = false; btn.textContent = "Kirim";
    }
  });

  loadStats();
})();
