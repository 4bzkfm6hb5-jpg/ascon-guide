/* ASCON LIVING travel guide – PWA (plain JS, renders data/*.json built from the PDF data) */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rich = s => esc(s).replace(/&lt;(\/?)(b|i|strong|em)&gt;/gi, "<$1$2>").replace(/&lt;br\s*\/?&gt;/gi, "<br>");
const plain = s => String(s ?? "").replace(/<[^>]+>/g, "");
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);
const S = {lang: null, meta: null, places: [], text: {}, filters: {}, open: new Set(), q: "", limit: {}};
const PAGE = 20;
const MIN = () => ({ar:"دقيقة",ko:"분",zh:"分钟",ja:"分",vi:"phút",de:"Min."}[S.lang] || "min");
const ltr = s => `<bdi dir="ltr">${s}</bdi>`;   // LTR island (names, addresses, numbers) inside RTL text
const bdi = s => `<bdi>${s}</bdi>`;             // direction from content (hours/prices may be translated)
const dirOf = c => (S.meta && S.meta.languages[c] && S.meta.languages[c].dir) || ((window.LANGS || []).find(l => l.code === c) || {}).dir || (c === "ar" ? "rtl" : "ltr");
const isRtl = () => dirOf(S.lang) === "rtl";
function applyDir(c) { const h = document.documentElement; h.lang = c; h.dir = dirOf(c); }
const LS = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
            set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};

/* ---------- SVG audience icons (one set, brand colours) ---------- */
const P = {
  family: '<circle class="fg" cx="9" cy="8" r="2.3"/><circle class="fg" cx="15.5" cy="9" r="1.8"/><path class="fg" d="M5.8 18v-4.2c0-1.8 1.4-3.2 3.2-3.2s3.2 1.4 3.2 3.2V18zM12.9 18v-3.4c0-1.4 1.2-2.6 2.6-2.6s2.6 1.2 2.6 2.6V18z"/>',
  kids: '<circle class="fg" cx="12" cy="7.5" r="2.4"/><path class="fg" d="M8 11.2h8l-1.6 1.2v5.8h-1.8v-3.2h-1.2v3.2H9.6v-5.8z"/>',
  age_4_12: '<circle class="fg" cx="12" cy="7.5" r="2.4"/><path class="fg" d="M8 11.2h8l-1.6 1.2v5.8h-1.8v-3.2h-1.2v3.2H9.6v-5.8z"/>',
  hot_day: '<circle class="fg" cx="12" cy="12" r="3.6"/><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M6.7 17.3l1.4-1.4M15.9 8.1l1.4-1.4" stroke-width="1.5" class="fg" stroke-linecap="round"/>',
  age_0_3: '<circle class="fg" cx="12" cy="9" r="3.2"/><path class="fg" d="M7.5 18c0-2.6 2-4.6 4.5-4.6s4.5 2 4.5 4.6z"/>',
  accessible: '<circle class="fg" cx="11" cy="6.2" r="1.6"/><path d="M10.6 8.6v4.6h4.1l1.8 4M10.6 10.8h3.4" stroke-width="1.7" fill="none" class="fg" stroke-linecap="round"/><path d="M8.7 11.3a4 4 0 1 0 5.3 5.3" stroke-width="1.6" fill="none" class="fg"/>',
  halal: '<path class="fg" d="M13.8 6.2a6 6 0 1 0 3.9 10.3 5 5 0 1 1-3.9-10.3z"/><path class="fg" d="m16 9.2.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.3.7.3-1.4-1-1 1.4-.2z"/>',
  vegetarian: '<path class="fg" d="M17.5 6.5c-6.5 0-10 3.3-10 8 0 1 .3 2 .7 2.7 1-2.8 3-4.8 6-6-2.4 1.6-4.1 3.7-5 6.3.8.4 1.6.5 2.4.5 4.4 0 6.4-4.2 5.9-11.5z"/>',
  vegan: '<path class="fg" d="M17.5 6.5c-6.5 0-10 3.3-10 8 0 1 .3 2 .7 2.7 1-2.8 3-4.8 6-6-2.4 1.6-4.1 3.7-5 6.3.8.4 1.6.5 2.4.5 4.4 0 6.4-4.2 5.9-11.5z"/>',
  budget: '<text class="fg" x="12" y="16.3" font-size="11" font-weight="700" text-anchor="middle" font-family="sans-serif">₫</text>',
  alcohol: '<path class="fg" d="M7.5 7h7.5v10.5a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1zM15 9h1.6a1.6 1.6 0 0 1 1.6 1.6v2.8a1.6 1.6 0 0 1-1.6 1.6H15v-1.4h1.4v-3.2H15z"/>',
  top: '<path class="fg" d="m12 5.5 1.9 4 4.3.5-3.2 3 .9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-3 4.3-.5z"/>',
  quirky: '<path class="fg" d="M12 3.5l1.5 4.8 4.3-2.6-2.6 4.3 4.8 1.5-4.8 1.5 2.6 4.3-4.3-2.6L12 20.5l-1.5-4.8-4.3 2.6 2.6-4.3L4 12.5l4.8-1.5-2.6-4.3 4.3 2.6z"/>',
  rainy_day: '<path class="fg" d="M8.3 13.5a3 3 0 0 1 .4-6 4 4 0 0 1 7.4 1.2 2.4 2.4 0 0 1 0 4.8z"/><path d="M9.5 15.5l-.8 2M12.5 15.5l-.8 2M15.5 15.5l-.8 2" stroke-width="1.4" class="fg" stroke-linecap="round"/>',
  teens: '<circle class="fg" cx="12" cy="7" r="2.2"/><path class="fg" d="M8.6 18v-5.4c0-1.6 1.5-2.8 3.4-2.8s3.4 1.2 3.4 2.8V18z"/>'
};
const TAG_ORDER = ["top","family","age_0_3","age_4_12","kids","teens","seniors","group_friendly","accessible","stroller_friendly","vegan","vegetarian","halal","gluten_free","kosher","budget","luxury","rainy_day","hot_day","quirky","pet_friendly","lgbtq_friendly","alcohol"];
const ICON_ALIAS = {cafes_desserts:"cafes", bars_nightlife:"nightlife", kids_family:"family_kids", sights_culture:"sights", day_trips:"daytrips", practical_emergency:"practical", accessible:"wheelchair", age_4_12:"kids", vegan:"vegetarian", outside_area:"approx"};
function iconFile(slug) { const f = (S.meta && S.meta.icon_files) || []; const k = f.includes(slug) ? slug : (f.includes(ICON_ALIAS[slug]) ? ICON_ALIAS[slug] : null); return k ? `icons/set/${k}.svg` : null; }
const humanize = s => String(s || "").replace(/[_-]+/g, " ").replace(/^\w/, m => m.toUpperCase());
const TI = () => Math.max(0, TAX_ORDER.indexOf(S.lang));
const tax = (kind, slug) => { const a = TAX[kind] && TAX[kind][slug]; return a ? a[TI()] || a[0] : null; };
const ico = t => iconFile(t) ? `<img src="${iconFile(t)}" alt="" width="20" height="20" aria-hidden="true">` : `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${t==="top"||t==="quirky"?"#F06E1E":t==="alcohol"?"#00243C":"#008448"}"/><g fill="#fff" stroke="#fff" stroke-width="0">${(P[t]||'<circle class="fg" cx="12" cy="12" r="3"/>').replace(/class="fg"/g,'class="fg"')}</g></svg>`;

/* ---------- i18n ---------- */
const U = () => UI[S.lang] || UI.en;
const t = k => U()[k] ?? UI.en[k] ?? k;
const tagLabel = k => { const md = (S.meta && S.meta.tags && S.meta.tags[k]) || {}, ml = md.labels || {};
  return ((T().taxonomy || {}).tag || {})[k] || ml[S.lang] || tax("tag", k) || (U().tag || {})[k] || ml.en || UI.en.tag[k] || humanize(k); };
const T = () => S.text[S.lang] || {};
const EN = () => S.text.en || {};
const langInfo = c => LANGS.find(l => l.code === c) || LANGS[0];
const hasGuide = c => !!(S.meta && S.meta.languages[c] && S.meta.languages[c].guide);
function suggestLang() {
  const nav = (navigator.languages || [navigator.language || "en"]).map(x => String(x).toLowerCase());
  for (const n of nav) { const c = n.split("-")[0]; if (UI[c]) return c; }
  return "en";
}
const catOf = id => (S.meta.categories || []).find(c => c.id === id);
const catLabel = c => ((T().taxonomy || {}).cat || {})[c.id] || (c.labels || {})[S.lang] || tax("cat", c.id) || (c.labels || {}).en || humanize(c.id);
const catIcon = c => iconFile(c.id) ? `<img src="${iconFile(c.id)}" alt="" width="34" height="34">` : esc(c.icon);
function subLabel(cat, sc) {
  const c = catOf(cat), ext = c && c.subcategories && c.subcategories[sc];
  const lab = l => !ext ? null : typeof ext === "string" ? (l === "en" ? ext : null) : ((ext.labels || {})[l] || ext["label_" + l] || null);
  return ((T().taxonomy || {}).sub || {})[sc] || lab(S.lang) || tax("sub", sc) || lab("en") || humanize(sc);
}
function ptext(q) {           // field-level fallback: chosen language -> English
  const a = (EN().places || {})[q.uid] || {}, b = (T().places || {})[q.uid] || {};
  const o = Object.assign({}, a, b);
  o.note = (T().notes || {})[q.id] || b.note || (EN().notes || {})[q.id] || a.note || o.desc;
  return o;
}

/* ---------- links ---------- */
const ll = q => q.lat != null && q.lng != null ? `${q.lat},${q.lng}` : null;
const dest = q => ll(q) || encodeURIComponent(`${q.name}, ${q.addr || "Ho Chi Minh City"}`);
function routeUrl(q, fromHome) {
  if (q.maps_url && !fromHome) return q.maps_url;
  let u = `https://www.google.com/maps/dir/?api=1&destination=${dest(q)}`;
  if (q.google_place_id) u += `&destination_place_id=${encodeURIComponent(q.google_place_id)}`;
  if (fromHome && S.meta.origin) u += `&origin=${S.meta.origin.lat},${S.meta.origin.lng}`;
  return u;
}
function searchUrl(q) {
  let u = `https://www.google.com/maps/search/?api=1&query=${dest(q)}`;
  if (q.google_place_id) u += `&query_place_id=${encodeURIComponent(q.google_place_id)}`;
  return u;
}

/* ---------- data ---------- */
async function getJSON(u) { const r = await fetch(u, {cache: "no-cache"}); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }
async function loadText(c) {
  if (S.text[c] !== undefined) return;
  S.text[c] = hasGuide(c) || c === "en" || (S.meta.languages[c] && (S.meta.languages[c].practical || S.meta.languages[c].notes)) ? await getJSON(`data/text-${c}.json`).catch(() => null) : null;
}
const dist = q => q.km ?? q.straight ?? 999;

/* ---------- rendering helpers ---------- */
function distLine(q) {
  const c = EN().common || {}, out = [];
  if (q.km != null || q.car_min != null) out.push(`<span dir="ltr">🚗 ${q.km != null ? q.km + " km" : ""}${q.car_min != null ? " · " + q.car_min + " " + MIN() : ""}</span>`);
  if (q.moto_min != null) out.push(`<span dir="ltr">🛵 ${q.moto_min} ${MIN()}</span>`);
  if (q.walk_km != null && q.walk_min != null) out.push(`<span dir="ltr">🚶 ${q.walk_km} km · ${q.walk_min} ${MIN()}</span>`);
  return out.length ? `<div class="dist" aria-label="${esc(t("car"))} / ${esc(t("moto"))} / ${esc(t("walk"))}">${out.join("")}</div>` : "";
}
function tagsHtml(q) {
  const tg = (q.tags || []).slice().sort((a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b));
  return tg.length ? `<div class="tags">${tg.map(x => `<span class="tag">${ico(x)}${esc(tagLabel(x))}</span>`).join("")}</div>` : "";
}
const LOC = {ar:"ar-u-nu-latn",en:"en-US",de:"de-DE",vi:"vi-VN",zh:"zh-CN",ko:"ko-KR",ja:"ja-JP",fr:"fr-FR",es:"es-ES",pt:"pt-BR"};
function fmtRating(q) {
  const loc = LOC[S.lang] || "en-US", s = Number(q.rs).toLocaleString(loc, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  return q.rc ? `${ltr(s + " ★")} (${t("reviews").replace("{n}", ltr(Number(q.rc).toLocaleString(loc)))})` : ltr(`${s} ★`);
}
function card(q, pre = "p") {
  const x = ptext(q), open = S.open.has(q.uid);
  const alt = [x.name && x.name !== q.name ? x.name : "", x.name_note, (S.lang === "en" ? (x.type || x.subcategory) : subLabel(q.category, q.subcategory))].filter(Boolean);
  const hours = x.hours_short || x.hours || (q.layer === "hospitals" ? "" : t("hoursCheck")), price = x.price || q.price_level;
  const facts = [
    hours ? `<div>🕘 <b>${esc(t("hours"))}:</b> ${bdi(rich(String(hours).replace(/^Hours:\s*/i, "")))}</div>` : "",
    x.inside ? `<div>🏬 ${rich(x.inside)}</div>` : "",
    price ? `<div>💰 <b>${esc(t("price"))}:</b> ${bdi(rich(price))}</div>` : "",
    (q.rs && (!q.rc || q.rc >= 20)) ? `<div>⭐ <b>${esc(t("rating"))}:</b> ${fmtRating(q)}</div>` : "",
    (x.phone || q.phone) ? `<div>📞 <b>${esc(t("phone"))}:</b> ${(() => { const orig = (q.phone || x.phone).split(/;\s*/), tr = (x.phone || "").split(/;\s*/), shown = tr.length === orig.length && x.phone ? tr : orig; return orig.map((p, i) => { const m = p.match(/[\d() +]{6,}/); return m ? `<a href="tel:${m[0].replace(/[^\d+]/g, "")}" dir="ltr">${esc(shown[i])}</a>` : ltr(esc(shown[i])); }).join("<br>"); })()}${x.phone_note ? " " + esc(x.phone_note) : ""}</div>` : "",
    (x.er_24h || x.pharmacy_24h || x.emergency_24h || q.emergency_24h) ? `<div>🚑 <b>${esc(t("er24"))}:</b> ${bdi(esc(x.er_24h || x.pharmacy_24h || x.emergency_24h || q.emergency_24h))}</div>` : ""].join("");
  const extra = [];
  extra.push(`<div class="driver"><div class="lbl">${esc(t("showDriver"))}</div><b>${ltr(esc(q.name))}</b>${q.addr ? `<br>${ltr(esc(q.addr))}` : ""}</div>`);
  for (const k of ["about", "what_is_sold", "guest_tips", "unconfirmed_note"]) if (x[k]) extra.push(`<p dir="auto">${rich(x[k])}</p>`);
  if (Array.isArray(x.offers) && x.offers.length) extra.push(`<div class="lbl">${esc(t("offers"))}</div><table>${x.offers.map(o => `<tr><td>${rich(o[0])}</td><td>${rich(o[1])}</td></tr>`).join("")}</table>`);
  if (q.approx) extra.push(`<p class="small">📍 ${esc(t("approx"))}</p>`);
  if (q.across_canal) extra.push(`<p class="small">🌉 ${esc(t("canal"))}</p>`);
  const outside = q.outside_area ? `<span class="badge">${esc(tagLabel("outside_area"))}</span>` : "";
  return `<article class="card" id="${pre}-${esc(q.uid)}" data-uid="${esc(q.uid)}" data-pre="${pre}">
    <h3>${q.top ? '<span class="top" title="' + esc(tagLabel("top")) + '">★</span> ' : ""}${ltr(esc(q.name))}${outside}</h3>
    ${alt.length ? `<div class="alt">${alt.map(s => bdi(rich(s))).join(" · ")}</div>` : ""}
    ${(() => { const qm = quickMeta(q), pr = price && plain(String(price)).length <= 16 ? price : ""; return qm || pr ? `<div class="meta">${qm}${pr && qm ? '<span class="dot">·</span>' : ""}${pr ? `<span>${bdi(rich(String(pr)))}</span>` : ""}</div>` : ""; })()}
    ${tagsHtml(q)}${distLine(q)}
    ${!distLine(q) && q.addr ? `<div class="facts">📍 ${ltr(esc(q.addr))}</div>` : ""}
    <div class="facts">${facts}</div>
    ${x.note ? `<p dir="auto" class="note ${open ? "" : "clamp"}">${rich(x.note)}</p>` : ""}
    ${open ? `<div class="extra">${extra.join("")}</div>` : ""}
    <div class="btns">
      <a class="btn route" href="${esc(routeUrl(q))}" target="_blank" rel="noopener">🧭 ${esc(t("route"))}</a>
      ${S.meta.origin ? `<a class="btn sm" href="${esc(routeUrl(q, true))}" target="_blank" rel="noopener">🏠 ${esc(t("fromHome"))}</a>` : ""}
      <a class="btn sm" href="${esc(searchUrl(q))}" target="_blank" rel="noopener">📍 ${esc(t("gmaps"))}</a>
      <button class="btn sm" data-copy="${esc(q.name + (q.addr ? ", " + q.addr : ""))}">🚕 ${esc(t("grab"))}</button>
      <button class="btn sm more" data-toggle="${esc(q.uid)}" aria-expanded="${open}">${esc(open ? t("less") : t("more"))}</button>
    </div></article>`;
}
function filterBar(key, list, withSub) {
  const f = S.filters[key] || (S.filters[key] = {sub: "all", tags: []});
  let h = "";
  if (withSub) {
    const subs = {}; list.forEach(q => { subs[q.subcategory] = (subs[q.subcategory] || 0) + 1; });
    const ks = Object.keys(subs); if (isRtl() || S.lang === "ar") ks.sort((a, b) => (b === "halal") - (a === "halal"));
    if (ks.length > 1) h += `<div class="chips" role="group">` + `<button class="chip" data-sub="all" aria-pressed="${f.sub === "all"}">${esc(t("all"))} <span class="n">${list.length}</span></button>` +
      ks.map(k => `<button class="chip" data-sub="${esc(k)}" aria-pressed="${f.sub === k}">${esc(subLabel(withSub, k))} <span class="n">${subs[k]}</span></button>`).join("") + `</div>`;
  }
  const tags = new Set(); list.forEach(q => (q.tags || []).forEach(x => tags.add(x)));
  let tl = TAG_ORDER.filter(x => tags.has(x)).concat([...tags].filter(x => !TAG_ORDER.includes(x)));
  if (S.lang === "ar") tl = tl.filter(x => x === "halal").concat(tl.filter(x => x !== "halal"));
  if (tl.length) h += `<div class="lbl">${esc(t("filter"))}</div><div class="chips" role="group">` + tl.map(x => `<button class="chip" data-tag="${esc(x)}" aria-pressed="${f.tags.includes(x)}">${ico(x)} ${esc(tagLabel(x))}</button>`).join("") + `</div>`;
  return h;
}
function applyFilters(key, list) {
  const f = S.filters[key] || {sub: "all", tags: []};
  return list.filter(q => (f.sub === "all" || q.subcategory === f.sub) && f.tags.every(x => (q.tags || []).includes(x)));
}

/* ---------- views ---------- */
const EXPLORE = {en:"Explore",de:"Entdecken",vi:"Khám phá",zh:"探索",ko:"둘러보기",ja:"さがす",fr:"Explorer",es:"Explorar",pt:"Explorar",ar:"استكشف"};
const HALAL = {en:"Halal food & mosques",de:"Halal-Essen & Moscheen",vi:"Đồ ăn Halal & nhà thờ Hồi giáo",zh:"清真美食与清真寺",ko:"할랄 음식 & 모스크",ja:"ハラール料理とモスク",fr:"Cuisine halal & mosquées",es:"Comida halal y mezquitas",pt:"Comida halal e mesquitas",ar:"طعام حلال ومساجد"};
const halalLbl = () => HALAL[S.lang] || t("halalQuick");
const CREDITS_L = {en:"Photo credits",de:"Bildnachweise",vi:"Nguồn ảnh",zh:"图片来源",ko:"사진 출처",ja:"写真クレジット",fr:"Crédits photo",es:"Créditos de fotos",pt:"Créditos das fotos",ar:"مصادر الصور"};
const creditsLbl = () => CREDITS_L[S.lang] || CREDITS_L.en;
async function openCredits() {
  const m = $("#langModal");
  let list = [];
  try { list = await (await fetch("img/cat/credits.json")).json(); } catch (e) {}
  m.innerHTML = `<div class="sheet"><h2>📷 ${esc(creditsLbl())}</h2><p class="small" dir="ltr" lang="en">Wikimedia Commons · cropped &amp; converted to WebP</p>
    <ul class="credits">${list.map(c => { const cat = catOf(c.cat); return `<li><img src="img/cat/${esc(c.cat)}.webp" alt="" width="64" height="48"><div><b>${esc(cat ? catLabel(cat) : c.cat)}</b>
      <div dir="ltr" class="small">${esc(c.title)}<br>© ${esc(c.author || "unknown")} · ${c.license_url ? `<a href="${esc(c.license_url)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}<br><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.source.replace(/^https?:\/\//, ""))}</a></div></div></li>`; }).join("")}</ul>
    <button class="cta" data-close>OK</button></div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; };
}
const CAT_IMG = id => `img/cat/${id}.webp`;
function quickMeta(q) {
  const out = [];
  if (q.km != null) out.push(ltr(q.km + " km")); else if (q.walk_min != null) out.push(ltr(`🚶 ${q.walk_min} ${MIN()}`));
  if (q.rs && (!q.rc || q.rc >= 20)) out.push(`<span class="rt">${ltr("★ " + Number(q.rs).toLocaleString(LOC[S.lang] || "en-US", {minimumFractionDigits: 1, maximumFractionDigits: 1}))}</span>`);
  return out.join('<span class="dot">·</span>');
}
function viewHome() {
  const cats = S.meta.categories;
  const pdf = S.meta.pdfs[S.lang] || S.meta.pdfs.en;
  const anyFeatured = S.places.some(q => q.featured);
  const picks0 = S.places.filter(q => !q.outside_area && (anyFeatured ? q.featured : q.top) && q.category !== "practical_emergency")
    .sort((a, b) => dist(a) - dist(b)).reduce((acc, q) => { (acc[q.category] = acc[q.category] || []).push(q); return acc; }, {});
  const picks = []; const pools = cats.map(c => picks0[c.id] || []); for (let i = 0; picks.length < 10 && pools.some(p => p.length > i); i++) pools.forEach(p => { if (p[i] && picks.length < 10) picks.push(p[i]); });
  return `<section class="hello">
      <h1>${esc((T().brand || {}).guide_title || (EN().brand || {}).guide_title || t("guide"))}</h1>
      <p class="loc" dir="ltr">📍 Hồ Chí Minh City · Quận 4 &amp; Quận 7</p>
      <p class="tl" dir="ltr" lang="en">Built for Groups. Designed for Comfort. <b>Stay Better. Live ASCON.</b></p>
    </section>
    <div class="sbar"><form class="search" id="sform" role="search"><span class="sic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></span><input id="sq" type="search" placeholder="${esc(t("search"))}" value="${esc(S.q)}" enterkeyhint="search" aria-label="${esc(t("search"))}"><button aria-label="${esc(t("search"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></form>
    <div class="chips quick" role="group"><a class="chip" href="#/halal">☪️ ${esc(halalLbl())}</a><a class="chip" href="#/map">🗺️ ${esc(t("mapAll"))}</a>${pdf ? `<a class="chip" href="${pdf}" download>📄 ${esc(t("pdf"))}</a>` : ""}<a class="chip" href="#/c/practical_emergency">🆘 ${esc(catLabel(catOf("practical_emergency") || {id: "practical_emergency"}))}</a><button class="chip" data-credits>📷 ${esc(creditsLbl())}</button><button class="chip" id="instBtn" hidden>⬇️ ${esc(t("install"))}</button></div></div>
    <h2 class="sec">${esc(t("categories"))}</h2>
    <nav class="tiles">${cats.map(c => `<a class="tile ${c.count || c.id === "practical_emergency" ? "" : "soon"}" href="#/c/${c.id}">
        <span class="ph"><img src="${CAT_IMG(c.id)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="ic">${catIcon(c)}</span></span>
        <span class="lb">${esc(catLabel(c))}</span>
        <span class="ct">${c.count ? c.count + " " + esc(t("places")) : c.id === "practical_emergency" ? "&nbsp;" : esc(t("soonCat"))}</span></a>`).join("")}</nav>
    ${noticesHtml()}`;
}
function layerExtras(cid, list) {
  const layers = [...new Set(list.map(q => q.layer))];
  let maps = [], tips = [];
  for (const L of layers) {
    const im = (S.meta.images[L] || {}); (im[S.lang] || im.en || []).forEach(i => maps.push(i));
    const lt = (T().layers || {})[L] || (EN().layers || {})[L];
    if (lt) { if (lt.intro) tips.push(`<p>${rich(lt.intro)}</p>`); (lt.tips || []).forEach(x => tips.push(`<dt>${rich(x[0])}</dt><dd>${rich(x[1])}</dd>`)); }
  }
  let h = "";
  if (maps.length) h += `<details class="box"><summary>🗺️ ${esc(t("mapsImg"))} (${maps.length})</summary><div class="maps">${maps.map(i => `<a href="${i.src}" target="_blank" rel="noopener"><img loading="lazy" src="${i.sm}" alt="${esc(i.name)}"></a>`).join("")}</div></details>`;
  if (tips.length) h += `<details class="box"><summary>💡 ${esc(t("tips"))}</summary><dl class="tips">${tips.join("")}</dl></details>`;
  return h;
}
function practicalHtml() {
  const p = T().practical || EN().practical; if (!p) return "";
  const block = v => {
    if (typeof v === "string") return `<p>${rich(v)}</p>`;
    if (Array.isArray(v)) {
      if (v.length && Array.isArray(v[0])) return v.length && v.every(r => r.length === 2) ? `<dl>${v.map(r => `<dt>${rich(r[0])}</dt><dd>${rich(r[1])}</dd>`).join("")}</dl>` : `<table>${v.map(r => `<tr>${r.map(c => `<td>${rich(c)}</td>`).join("")}</tr>`).join("")}</table>`;
      return v.map(block).join("");
    }
    if (v && typeof v === "object") return Object.entries(v).filter(([k]) => k !== "id").map(([k, x]) => /^(h2|h3|title)$/.test(k) ? `<h3>${rich(x)}</h3>` : block(x)).join("");
    return "";
  };
  const secs = (p.sections || []).map(s => `<details class="box" id="pr-${esc(s.id)}"><summary>${rich(s.h2 || s.title || s.id)}</summary>${block(Object.fromEntries(Object.entries(s).filter(([k]) => !["h2", "title", "id"].includes(k))))}</details>`).join("");
  return `<section class="prac"><h2>${rich(p.title || "")}</h2>${p.intro ? `<p class="small">${rich(p.intro)}</p>` : ""}${secs}${p.admin_reform ? `<details class="box"><summary>${rich(p.admin_reform.h3)}</summary>${block({text: p.admin_reform.text, examples: p.admin_reform.examples})}</details>` : ""}</section>`;
}
function pagedList(key, list, pre) {
  const lim = S.limit[key] || PAGE, shown = list.slice(0, lim);
  return shown.map(q => card(q, pre)).join("") + (list.length > lim ? `<button class="pill more-btn" data-more="${esc(key)}">${esc(t("showMore"))} (${list.length - lim})</button>` : "");
}
function viewCat(cid) {
  const c = catOf(cid); if (!c) return viewHome();
  const all = S.places.filter(q => q.category === cid).sort((a, b) => dist(a) - dist(b));
  const anyFeatured = S.places.some(q => q.featured);
  const near = all.filter(q => !q.outside_area), far = all.filter(q => q.outside_area);
  const top = (anyFeatured ? all.filter(q => q.featured) : near.filter(q => q.top)).slice(0, 10);
  const list = applyFilters(cid, near), flist = applyFilters(cid, far);
  const f = S.filters[cid] || {sub: "all", tags: []}, filtered = f.sub !== "all" || f.tags.length;
  return `<a class="back" href="#/"><span class="arr">←</span> ${esc(t("back"))}</a>
    <div class="ch-h"><img class="bn" src="${CAT_IMG(cid)}" alt="" onerror="this.remove()"><div class="cap"><span class="ic">${catIcon(c)}</span><h1>${esc(catLabel(c))}</h1></div></div>
    ${all.length ? `<p class="sub">${all.length} ${esc(t("places"))} · ${esc(t("sorted"))} · <a href="#/map/${cid}">🗺️ ${esc(t("map"))}</a>${S.meta.time_footer && S.lang === "en" ? `<br><span class="small">${esc(S.meta.time_footer)}</span>` : ""}</p>` : ""}
    ${cid === "practical_emergency" ? practicalHtml() : ""}
    ${top.length >= 3 && !filtered ? `<h2 class="sec">★ ${esc(t("topPicks"))}</h2><div class="toplist">${top.map(q => card(q, "t")).join("")}</div>` : ""}
    ${layerExtras(cid, all)}
    ${all.length ? `<h2 class="sec">${esc(t("allPlaces"))}</h2>` : ""}
    ${filterBar(cid, all, cid)}
    <div id="list">${pagedList(cid, list, "p") || (all.length ? (flist.length ? "" : `<p class="empty">${esc(t("none"))} <button class="pill" data-clear="${cid}">${esc(t("clear"))}</button></p>`) : `<p class="empty">${esc(t("soonCat"))}</p>`)}</div>
    ${flist.length ? `<h2 class="sec">🚗 ${esc(t("worthTrip"))}</h2><div id="far">${pagedList(cid + ":far", flist, "f")}</div>` : ""}`;
}
function viewHalal() {
  const all = S.places.filter(q => (q.tags || []).includes("halal") || q.subcategory === "halal" || q.subcategory === "mosque").sort((a, b) => dist(a) - dist(b));
  const mosques = all.filter(q => q.subcategory === "mosque"), food = all.filter(q => q.subcategory !== "mosque");
  return `<a class="back" href="#/"><span class="arr">←</span> ${esc(t("back"))}</a>
    <div class="ch-h"><span class="ic">☪️</span><h1>${esc(halalLbl())}</h1></div>
    <p class="sub">${all.length} ${esc(t("places"))} · ${esc(t("sorted"))}</p>
    ${mosques.length ? `<h2 class="sec">🕌 ${esc(subLabel("sights_culture", "mosque"))}</h2>${mosques.map(q => card(q, "p")).join("")}` : ""}
    ${food.length ? `<h2 class="sec">🍽️ ${esc(tagLabel("halal"))}</h2>${food.map(q => card(q, "f")).join("")}` : ""}`;
}
function viewSearch() {
  const q = S.q.trim().toLowerCase();
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const nq = norm(q);
  const all = !q ? [] : S.places.filter(p => { const x = ptext(p), e = (EN().places || {})[p.uid] || {};
    return norm([p.name, p.addr, x.name, x.name_note, x.type, x.note, e.name, e.type, e.note, subLabel(p.category, p.subcategory), catLabel(catOf(p.category) || {id: ""})].join(" ")).includes(nq); }).sort((a, b) => dist(a) - dist(b));
  const list = applyFilters("search", all);
  return `<a class="back" href="#/"><span class="arr">←</span> ${esc(t("back"))}</a>
   <form class="search" id="sform" role="search"><span>🔎</span><input id="sq" type="search" placeholder="${esc(t("search"))}" value="${esc(S.q)}" enterkeyhint="search"><button>${esc(t("search").replace(/…|\.\.\./, ""))}</button></form>
   ${q ? `<p class="sub">${all.length} ${esc(t("results"))} · ${esc(t("sorted"))}</p>` : ""}${filterBar("search", all, null)}
   <div id="list">${pagedList("search:" + q, list, "p") || (q ? `<p class="empty">${esc(t("none"))}</p>` : "")}</div>`;
}
const COLORS = {food: "#F06E1E", cafes_desserts: "#8B5A2B", bars_nightlife: "#7B3FA0", kids_family: "#E0457B", sights_culture: "#00243C", activities: "#1E88E5", relaxation: "#00A39A", shopping: "#008448", day_trips: "#555", practical_emergency: "#D32F2F"};
function viewMap(cid) {
  return `<a class="back" href="${cid ? "#/c/" + cid : "#/"}"><span class="arr">←</span> ${esc(t("back"))}</a>
    <div class="chips" id="mapChips">${S.meta.categories.filter(c => c.count).map(c => `<button class="chip" data-mcat="${c.id}" aria-pressed="${!cid || cid === c.id}"><span style="color:${COLORS[c.id] || "#333"}">●</span> ${esc(catLabel(c))}</button>`).join("")}</div>
    <div id="map" role="application" aria-label="${esc(t("map"))}"></div>
    <p class="small">${rich(((T().common || {}).osm) || (EN().common || {}).osm || "© OpenStreetMap contributors")}</p>`;
}
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletP) return leafletP;
  const css = h => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = h; document.head.appendChild(l); };
  const js = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  ["vendor/leaflet.css", "vendor/MarkerCluster.css", "vendor/MarkerCluster.Default.css"].forEach(css);
  leafletP = js("vendor/leaflet.js").then(() => js("vendor/leaflet.markercluster.js"));
  return leafletP;
}
async function initMap(cid) {
  await loadLeaflet();
  const o = S.meta.origin || {lat: 10.7518, lng: 106.7105};
  const map = L.map("map", {zoomControl: true}).setView([o.lat, o.lng], 14);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap contributors"}).addTo(map);
  if (S.meta.origin) L.marker([o.lat, o.lng], {icon: L.divIcon({className: "home-pin", iconSize: [22, 22]}), zIndexOffset: 1000}).addTo(map)
    .bindPopup(`<b>ASCON LIVING</b><br>${esc(((T().brand || {}).legend_home) || (EN().brand || {}).legend_home || "")}`);
  const groups = {};
  for (const q of S.places) {
    if (q.lat == null) continue;
    const g = groups[q.category] || (groups[q.category] = (L.markerClusterGroup ? L.markerClusterGroup({disableClusteringAtZoom: 17, maxClusterRadius: 45, showCoverageOnHover: false}) : L.layerGroup()));
    const x = ptext(q);
    L.circleMarker([q.lat, q.lng], {radius: q.top ? 8 : 6, color: "#fff", weight: 2, fillColor: COLORS[q.category] || "#333", fillOpacity: .95})
      .bindPopup(`<b>${ltr(esc(q.name))}</b>${x.name && x.name !== q.name ? "<br>" + esc(x.name) : ""}<br><span class="small">${esc(subLabel(q.category, q.subcategory))}</span>${distLine(q)}
        <a class="btn route" style="color:#fff" href="${esc(routeUrl(q))}" target="_blank" rel="noopener">🧭 ${esc(t("route"))}</a>
        <a class="btn sm" href="#/c/${q.category}?p=${encodeURIComponent(q.uid)}">${esc(t("more"))}</a>`).addTo(g);
  }
  // market streets & halls
  try {
    const geo = await getJSON("data/market-geo.json");
    const mg = L.geoJSON(geo, {style: f => ({color: "#008448", weight: f.geometry.type.includes("Line") ? 5 : 2, opacity: .8, fillOpacity: .25}),
      onEachFeature: (f, l) => l.bindPopup(esc(f.properties.street_name || f.properties.market_name || ""))});
    groups._markets = mg; 
  } catch (e) {}
  const show = new Set(cid ? [cid] : Object.keys(groups)); if (!cid || cid === "shopping") show.add("_markets");
  const sync = () => Object.entries(groups).forEach(([k, g]) => show.has(k) ? g.addTo(map) : map.removeLayer(g));
  sync();
  if (cid && groups[cid]) { const pts = S.places.filter(q => q.category === cid && q.lat != null).map(q => [q.lat, q.lng]); if (pts.length) map.fitBounds(L.latLngBounds(pts.concat([[o.lat, o.lng]])).pad(.1), {maxZoom: 15}); }
  $("#mapChips").addEventListener("click", e => { const b = e.target.closest("[data-mcat]"); if (!b) return; const k = b.dataset.mcat;
    show.has(k) ? show.delete(k) : show.add(k); if (k === "shopping") show.has(k) ? show.add("_markets") : show.delete("_markets"); b.setAttribute("aria-pressed", show.has(k)); sync(); });
}

/* ---------- emergency (SOS) ---------- */
function openSos() {
  const m = $("#sosModal");
  const nums = [["113", t("police"), "👮"], ["114", t("fire"), "🚒"], ["115", t("ambulance"), "🚑"], ["112", t("rescue"), "🆘"]];
  const is24 = q => { const x = ptext(q); return !!q.emergency_24h || /24\s*(h|\/7|giờ)/i.test([q.name, x.name, x.hours, x.note].join(" ")); };
  const help = S.places.filter(q => q.category === "practical_emergency" && /hospital|pharmacy|clinic/.test(q.subcategory || ""))
    .sort((a, b) => (is24(b) - is24(a)) || (dist(a) - dist(b))).slice(0, 4).sort((a, b) => dist(a) - dist(b));
  m.innerHTML = `<div class="sheet"><h2>🆘 ${esc(t("emergency"))}</h2>
    <div class="sosgrid">${nums.map(n => `<a class="sosnum" href="tel:${n[0]}"><span class="big">${n[2]} ${n[0]}</span><span>${esc(n[1])}</span></a>`).join("")}</div>
    <p class="small"><a href="#/c/practical_emergency" data-close="1">ℹ️ ${esc(catLabel(catOf("practical_emergency") || {id: "practical_emergency"}))}</a></p>
    ${help.length ? `<h3 class="sec">${esc(t("nearestHelp"))}</h3>${help.map(q => card(q, "s")).join("")}` : ""}
    <button class="cta" data-close="1">✕</button></div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; };
}

/* ---------- notices (data/notices.json from practical/notices.json) ---------- */
function noticeList() {
  const N = S.notices; if (!N) return [];
  let L = Array.isArray(N) ? N : (N.notices || N.items || []);
  const today = new Date().toLocaleDateString("sv-SE");  // YYYY-MM-DD local
  const pick = (o, base) => { if (!o) return ""; const v = o[base]; if (v && typeof v === "object") return v[S.lang] || v.en || ""; return o[base + "_" + S.lang] || o[base + "_en"] || (typeof v === "string" ? v : ""); };
  return L.map(n => {
    const from = String(n.valid_from || n.from || n.date || "").slice(0, 10), until = String(n.valid_until || n.until || n.expires || "").slice(0, 10);
    const state = until && today > until ? "expired" : from && today < from ? "upcoming" : "active";
    return {state, from, until, title: pick(n, "title"), text: pick(n, "text") || pick(n, "body"), asof: pick(n, "as_of_label") || pick(n, "as_of") || (N.as_of_label || N.as_of || ""), icon: n.icon || "📢"};
  }).filter(n => n.state !== "expired" && (n.title || n.text)).sort((a, b) => (a.state > b.state ? 1 : -1) || a.from.localeCompare(b.from));
}
function noticesHtml() {
  const L = noticeList(); if (!L.length) return "";
  return `<section class="notices"><h2 class="sec">📢 ${esc(t("notices"))}</h2>${L.map(n => `<div class="notice ${n.state}">
    ${n.state === "upcoming" ? `<span class="badge">${esc(t("upcoming"))}${n.from ? " · " + esc(n.from) : ""}</span>` : ""}
    <div dir="auto">${n.title ? `<b>${rich(n.title)}</b>` : ""}</div>${n.text ? `<div dir="auto">${rich(n.text)}</div>` : ""}
    ${n.asof ? `<div class="small">${rich(n.asof)}</div>` : ""}</div>`).join("")}</section>`;
}

/* ---------- router ---------- */
function parse() {
  const h = location.hash.replace(/^#\/?/, ""); const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean); const params = new URLSearchParams(qs || "");
  return {parts, params};
}
function render(keepScroll) {
  const y = window.scrollY;
  const {parts, params} = parse();
  let html, after = null;
  if (parts[0] === "c") { html = viewCat(parts[1]); const f = params.get("p"); if (f) { S.open.add(f); const ix = S.places.filter(q => q.category === parts[1] && !q.outside_area).sort((a, b) => dist(a) - dist(b)).findIndex(q => q.uid === f); if (ix >= (S.limit[parts[1]] || PAGE)) S.limit[parts[1]] = ix + 1; S.limit[parts[1] + ":far"] = 999; html = viewCat(parts[1]); after = () => { const el = document.getElementById("p-" + f) || document.getElementById("f-" + f); if (el) { el.classList.add("focus"); el.scrollIntoView({block: "center"}); } }; } }
  else if (parts[0] === "halal") html = viewHalal();
  else if (parts[0] === "s") { if (params.get("q") != null) S.q = params.get("q"); html = viewSearch(); }
  else if (parts[0] === "map") { html = viewMap(parts[1]); after = () => initMap(parts[1]).catch(e => { $("#map").innerHTML = `<p class="empty">Map unavailable offline: ${esc(e.message || e)}</p>`; }); }
  else html = viewHome();
  $("#app").innerHTML = html;
  applyDir(S.lang);
  updateChrome();
  if (keepScroll) window.scrollTo(0, y); else if (!after) window.scrollTo(0, 0);
  if (after) setTimeout(after, 30);
  wireInstall();
  if ("IntersectionObserver" in window) { const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.disconnect(); const k = en.target.dataset.more; S.limit[k] = (S.limit[k] || PAGE) + PAGE; render(true); } }), {rootMargin: "200px"});
    document.querySelectorAll(".more-btn").forEach(b => io.observe(b)); }
}
function updateChrome() {
  const li = langInfo(S.lang);
  $("#langFlag").textContent = li.flag; $("#langCode").textContent = S.lang.toUpperCase();
  $("#langBtn").setAttribute("aria-label", t("language") + ": " + li.name);
  const n = $("#notice");
  if (!hasGuide(S.lang)) { n.textContent = "ℹ️ " + fmt(t("fallback"), {lang: li.name}); n.hidden = false; } else n.hidden = true;
  $("#sosTxt").textContent = t("sos"); $("#sosBtn").setAttribute("aria-label", t("emergency"));
  $("#tabHomeTxt").textContent = EXPLORE[S.lang] || EXPLORE.en; $("#tabMapTxt").textContent = t("map"); $("#tabSosTxt").textContent = t("sos"); $("#tabLangTxt").textContent = li.flag + " " + S.lang.toUpperCase();
  $("#tabLang").setAttribute("aria-label", t("language") + ": " + li.name); $("#tabSos").setAttribute("aria-label", t("emergency"));
  const pp = parse().parts[0]; $("#tabHome").classList.toggle("on", pp !== "map"); $("#tabMap").classList.toggle("on", pp === "map");
  $("#ftrCred").textContent = "📷 " + creditsLbl();
  $("#ftrInfo").textContent = `${t("offline")} · ${S.meta.built} · v${S.meta.version}`;
}

/* ---------- language picker ---------- */
function langGrid(sel) {
  return `<div class="lgrid" role="radiogroup">${LANGS.map(l => `<button class="lopt" role="radio" aria-checked="${l.code === sel}" data-lang="${l.code}" lang="${l.code}" dir="${dirOf(l.code)}">
    <span class="fl" aria-hidden="true">${l.flag}</span><span><span class="nm">${esc(l.name)}</span>${hasGuide(l.code) ? "" : `<span class="sn">${esc((UI[l.code] || UI.en).soon)}</span>`}</span></button>`).join("")}</div>`;
}
function showWelcome() {
  let sel = suggestLang();
  const w = $("#welcome");
  const draw = () => {
    const u = UI[sel] || UI.en;
    w.dir = dirOf(sel); w.lang = sel;
    w.innerHTML = `<div class="wl">
      <img class="wlogo" src="icons/logo-welcome.png" alt="ASCON LIVING">
      <p class="motto" lang="en" dir="ltr"><span>Built for Groups.</span><span>Designed for Comfort.</span><span>Stay Better.</span><span>Live ASCON.</span></p>
      <div class="bar"></div>
      <h2>🌐 ${esc(u.choose)}</h2>${sel !== "en" ? `<p class="h2en" lang="en" dir="ltr">${esc(UI.en.choose)}</p>` : ""}
      <p class="hint">${esc(u.hint)}</p>
      ${langGrid(sel)}
      <button class="cta" id="wGo">${esc(u.cont)} →</button></div>`;
  };
  draw(); w.hidden = false; document.body.style.overflow = "hidden";
  w.onclick = async e => {
    const b = e.target.closest("[data-lang]");
    if (b) { sel = b.dataset.lang; draw(); return; }
    if (e.target.closest("#wGo")) { await setLang(sel); w.hidden = true; document.body.style.overflow = ""; showChrome(); render(); maybeIosHint(); }
  };
}
function openLangModal() {
  const m = $("#langModal");
  m.innerHTML = `<div class="sheet"><h2>🌐 ${esc(t("choose"))}</h2>${langGrid(S.lang)}</div>`;
  m.hidden = false;
  m.onclick = async e => {
    const b = e.target.closest("[data-lang]");
    if (b) { m.hidden = true; await setLang(b.dataset.lang); render(true); return; }
    if (e.target === m) m.hidden = true;
  };
}
async function setLang(c) {
  S.lang = c; applyDir(c); LS.set("ascon.lang", c);
  await loadText("en"); await loadText(c);
}
function showChrome() { $("#hdr").hidden = false; $("#ftr").hidden = false; $("#tabbar").hidden = false; document.body.classList.add("has-tabs"); }

/* ---------- events ---------- */
function toast(s) { const el = $("#toast"); el.textContent = s; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600); }
document.addEventListener("click", async e => {
  const tg = e.target.closest("[data-toggle]");
  if (tg) { const id = tg.dataset.toggle; S.open.has(id) ? S.open.delete(id) : S.open.add(id); const q = S.places.find(p => p.uid === id); const el = tg.closest("article"); if (q && el) el.outerHTML = card(q, el.dataset.pre); return; }
  if (e.target.closest("[data-credits]")) { e.preventDefault(); openCredits(); return; }
  const mb = e.target.closest("[data-more]");
  if (mb) { const k = mb.dataset.more; S.limit[k] = (S.limit[k] || PAGE) + PAGE; render(true); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp) { const s = cp.dataset.copy; try { await navigator.clipboard.writeText(s); } catch (err) { const ta = document.createElement("textarea"); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) {} ta.remove(); } toast(t("copied")); return; }
  const key = (parse().parts[0] === "s") ? "search" : parse().parts[1];
  const sb = e.target.closest("[data-sub]");
  if (sb && key) { S.filters[key].sub = sb.dataset.sub; render(true); return; }
  const tb = e.target.closest("[data-tag]");
  if (tb && key) { const f = S.filters[key], x = tb.dataset.tag; f.tags = f.tags.includes(x) ? f.tags.filter(y => y !== x) : f.tags.concat(x); render(true); return; }
  const cl = e.target.closest("[data-clear]");
  if (cl) { S.filters[cl.dataset.clear] = {sub: "all", tags: []}; render(true); }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "sform") return; e.preventDefault();
  S.q = $("#sq").value; const h = "#/s?q=" + encodeURIComponent(S.q);
  if (location.hash === h) render(); else location.hash = h;
});
window.addEventListener("hashchange", () => render());

/* ---------- install hints ---------- */
let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; wireInstall(); });
function wireInstall() {
  const b = $("#instBtn"); if (!b) return;
  b.hidden = !deferred; b.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; b.hidden = true; };
}
function maybeIosHint() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  if (!ios || standalone || LS.get("ascon.iosHint")) return;
  const h = $("#iosHint"); h.innerHTML = `📲 ${esc(t("iosHint"))} <b>⬆︎</b><button aria-label="close">×</button>`; h.hidden = false;
  h.querySelector("button").onclick = () => { h.hidden = true; LS.set("ascon.iosHint", "1"); };
}

/* ---------- boot ---------- */
async function boot() {
  $("#langBtn").addEventListener("click", openLangModal);
  $("#sosBtn").addEventListener("click", openSos);
  $("#tabSos").addEventListener("click", openSos); $("#tabLang").addEventListener("click", openLangModal);
  try {
    [S.meta, S.places] = await Promise.all([getJSON("data/meta.json"), getJSON("data/places.json")]);
  } catch (e) { $("#app").innerHTML = `<p class="empty">Could not load the guide data. ${esc(e.message)}</p>`; return; }
  if (S.meta.notices) S.notices = await getJSON("data/notices.json").catch(() => null);
  const saved = LS.get("ascon.lang");
  if (saved && UI[saved]) { await setLang(saved); showChrome(); render(); maybeIosHint(); }
  else { await loadText("en"); showWelcome(); }
  if ("serviceWorker" in navigator) {
    const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js", {updateViaCache: "none"}).then(reg => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  }
}
boot();
})();
