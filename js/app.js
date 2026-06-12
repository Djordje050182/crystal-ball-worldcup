/* Crystal Ball — World Cup 2026 Oracle */
(() => {
"use strict";

const LS_PICKS = "cb_picks_v1";
const LS_BRACKET = "cb_bracket_v1";
const LS_PROPHECY = "cb_prophecy_v1";

let DATA = null;
let currentView = "today";
let fixtureFilter = "all";
let bracketMode = "oracle"; // 'oracle' | 'you'

const picks = load(LS_PICKS, {});       // { matchId: [h, a] }
const bracketPicks = load(LS_BRACKET, {}); // { matchId: teamName }
const prophecy = load(LS_PROPHECY, {});  // { champion, goldenBoot }

function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- flags ---------- */
const FLAG_SPECIAL = {
  "GB-ENG": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "GB-SCT": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "GB-WLS": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};
function flag(teamName) {
  const t = DATA.teams[teamName];
  if (!t || !t.iso2) return "🏳️";
  if (FLAG_SPECIAL[t.iso2]) return FLAG_SPECIAL[t.iso2];
  const cc = t.iso2.toUpperCase();
  if (cc.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/* ---------- dates ---------- */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso) {
  if (!iso) return "TBC";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
const STAGE_LABEL = { GROUP: g => `Group ${g}`, R32: () => "Round of 32", R16: () => "Round of 16", QF: () => "Quarter-final", SF: () => "Semi-final", "3RD": () => "Third place", FINAL: () => "🏆 THE FINAL" };
function stageLabel(m) { return (STAGE_LABEL[m.stage] || (() => m.stage))(m.group); }

/* ---------- scoring ---------- */
function parseScore(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
function outcome([h, a]) { return h > a ? "H" : h < a ? "A" : "D"; }
function points(predArr, actArr) {
  if (!predArr || !actArr) return null;
  if (predArr[0] === actArr[0] && predArr[1] === actArr[1]) return 3;
  return outcome(predArr) === outcome(actArr) ? 1 : 0;
}
function tallies() {
  let oracle = 0, you = 0, graded = 0;
  for (const m of DATA.matches) {
    if (!m.played || !m.actualScore) continue;
    const act = parseScore(m.actualScore);
    if (!act) continue;
    graded++;
    const op = points(parseScore(m.predictedScore), act);
    if (op != null) oracle += op;
    const up = points(picks[m.id], act);
    if (up != null) you += up;
  }
  return { oracle, you, graded };
}
function verdictBadge(m) {
  const act = parseScore(m.actualScore);
  const pred = parseScore(m.predictedScore);
  if (!act || !pred) return "";
  const p = points(pred, act);
  if (p === 3) return `<span class="verdict exact">✨ Exact prophecy</span>`;
  if (p === 1) return `<span class="verdict result">✓ Right outcome</span>`;
  return `<span class="verdict miss">✗ The mist deceived</span>`;
}

/* ---------- match card ---------- */
function teamCell(name, side, slotText) {
  if (!name) return `<div class="team ${side}"><span class="flag">❔</span><span class="tname tbd">${esc(slotText || "TBD")}</span></div>`;
  return `<div class="team ${side}"><span class="flag">${flag(name)}</span><span class="tname">${esc(name)}</span></div>`;
}
function matchCard(m, opts = {}) {
  const home = m.home || m.predHome, away = m.away || m.predAway;
  const isProj = !m.home && m.predHome; // knockout projection
  const act = m.played && m.actualScore ? m.actualScore : null;
  const userPick = picks[m.id];
  const scoreHtml = act
    ? `<div class="pred-score"><span class="score actual">${esc(act)}</span><span class="lbl">Final</span></div>`
    : `<div class="pred-score"><span class="score">${esc(m.predictedScore || "–")}</span><span class="lbl">${isProj ? "Projected" : "Foreseen"}</span></div>`;
  const conf = m.confidence != null ? `
    <div class="conf-wrap">
      <div class="conf-bar"><div class="conf-fill" style="width:${Math.max(4, Math.min(100, m.confidence))}%"></div></div>
      <span class="conf-num">${m.confidence}% certainty</span>
    </div>` : "";
  const verdicts = act ? `<div class="verdict-row">
      ${verdictBadge(m)}
      ${userPick ? (() => { const p = points(userPick, parseScore(act)); return p === 3 ? `<span class="verdict exact">🫵 You: exact! +3</span>` : p === 1 ? `<span class="verdict result">🫵 You: +1</span>` : `<span class="verdict miss">🫵 You: 0</span>`; })() : ""}
    </div>` : (userPick ? `<div class="verdict-row"><span class="verdict result">🫵 Your call: ${userPick[0]}-${userPick[1]}</span></div>` : "");
  const predNote = act ? `<div class="key-factor"><span class="kf-ico">🔮</span><span>The orb foresaw <strong>${esc(m.predictedScore)}</strong> (${m.confidence}% certainty)</span></div>` : "";

  return `
  <article class="match-card ${m.played ? "played" : ""}" data-mid="${esc(m.id)}">
    <button class="match-head" data-expand="${esc(m.id)}">
      <div class="match-meta">
        <span class="stage-tag">${esc(stageLabel(m))}</span>
        <span>${esc(fmtDate(m.date))}${m.time ? " · " + esc(m.time) : ""}</span>
      </div>
      <div class="match-row">
        ${teamCell(home, "home", m.homeSlot)}
        ${scoreHtml}
        ${teamCell(away, "away", m.awaySlot)}
      </div>
      ${conf}
      ${verdicts}
    </button>
    <div class="match-body">
      ${m.reading ? `<div class="reading">${esc(m.reading)}</div>` : ""}
      ${m.keyFactor ? `<div class="key-factor"><span class="kf-ico">🗝️</span><span>${esc(m.keyFactor)}</span></div>` : ""}
      ${predNote}
      ${m.venue ? `<div class="key-factor"><span class="kf-ico">🏟️</span><span>${esc(m.venue)}</span></div>` : ""}
      ${!m.played && home && away && !isProj ? pickZone(m) : ""}
      ${!m.played && isProj ? `<div class="key-factor"><span class="kf-ico">🌫️</span><span>Teams projected from the Oracle's group forecasts — the true names will appear as the groups resolve.</span></div>` : ""}
    </div>
  </article>`;
}
function pickZone(m) {
  const p = picks[m.id] || ["", ""];
  return `
  <div class="pick-zone" data-pick="${esc(m.id)}">
    <div class="pick-title">🫵 Your prophecy</div>
    <div class="pick-row">
      <div class="stepper" data-side="0">
        <button data-d="-1" aria-label="decrease">−</button>
        <span class="val">${p[0] === "" ? "·" : p[0]}</span>
        <button data-d="1" aria-label="increase">+</button>
      </div>
      <span class="pick-sep">:</span>
      <div class="stepper" data-side="1">
        <button data-d="-1" aria-label="decrease">−</button>
        <span class="val">${p[1] === "" ? "·" : p[1]}</span>
        <button data-d="1" aria-label="increase">+</button>
      </div>
    </div>
    <div class="pick-saved"></div>
  </div>`;
}

/* ---------- views ---------- */
function renderToday() {
  const t = todayStr();
  const todays = DATA.matches.filter(m => m.date === t);
  const played = DATA.matches.filter(m => m.played && m.actualScore && m.date < t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const upcoming = DATA.matches.filter(m => m.date > t && !m.played).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  let html = "";
  html += `<h2 class="section-title">🌙 The Orb Gazes Upon ${esc(fmtDate(t))}</h2>`;
  html += todays.length
    ? todays.map(m => matchCard(m)).join("")
    : `<div class="empty-note">The mists are quiet today — no matches scheduled.<br>Peer ahead in the Matches tab. 🔮</div>`;
  if (played.length) {
    html += `<h2 class="section-title">📜 Recent Visions, Judged</h2>`;
    html += played.map(m => matchCard(m)).join("");
  }
  if (upcoming.length) {
    html += `<h2 class="section-title">⏳ Next In The Mist</h2>`;
    html += upcoming.map(m => matchCard(m)).join("");
  }
  html += `<div class="updated-chip">Crystal last polished: ${esc(DATA.meta.updated)} · prophecies refresh daily</div>`;
  return html;
}

function renderFixtures() {
  const groups = DATA.groups.map(g => g.group);
  const chips = [["all", "All"], ...groups.map(g => [g, `Grp ${g}`]), ["ko", "Knockout 🏆"]];
  let html = `<div class="chips">${chips.map(([v, l]) =>
    `<button class="chip ${fixtureFilter === v ? "active" : ""}" data-filter="${v}">${l}</button>`).join("")}</div>`;
  let list = DATA.matches;
  if (fixtureFilter === "ko") list = list.filter(m => m.stage !== "GROUP");
  else if (fixtureFilter !== "all") list = list.filter(m => m.group === fixtureFilter);
  list = [...list].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.matchNo || 0) - (b.matchNo || 0));
  let lastDate = null;
  for (const m of list) {
    if (m.date !== lastDate) { html += `<div class="date-divider">${esc(fmtDate(m.date))}</div>`; lastDate = m.date; }
    html += matchCard(m);
  }
  if (!list.length) html += `<div class="empty-note">Nothing in the mist for this filter.</div>`;
  return html;
}

function renderGroups() {
  let html = `<h2 class="section-title">🏆 The Twelve Circles <small>tap a team for its dossier</small></h2>`;
  for (const g of DATA.groups) {
    const order = g.predictedOrder || [];
    html += `
    <section class="group-card" data-group="${esc(g.group)}">
      <button class="group-head" data-gtoggle="${esc(g.group)}">
        <h3>Group ${esc(g.group)}</h3>
        <span style="display:flex;gap:6px;align-items:center;">
          <span style="font-size:18px;">${order.slice(0, 4).map(t => flag(t)).join(" ")}</span>
          <span class="chev">▾</span>
        </span>
      </button>
      <div class="group-body">
        <div class="legend">
          <span><span class="dot" style="background:var(--gold)"></span>Advances</span>
          <span><span class="dot" style="background:var(--violet)"></span>Possible best-3rd</span>
        </div>
        ${order.map((t, i) => {
          const team = DATA.teams[t] || {};
          const cls = i < 2 ? "advance" : i === 2 ? "maybe" : "";
          return `<button class="standing-row ${cls}" data-team="${esc(t)}">
            <span class="pos">${i + 1}</span><span class="flag">${flag(t)}</span>
            <span class="sname">${esc(t)}</span>
            <span class="srank">${team.fifaRank ? "FIFA #" + team.fifaRank : ""}</span>
          </button>`;
        }).join("")}
        ${g.groupReading ? `<div class="group-reading">🔮 ${esc(g.groupReading)}</div>` : ""}
      </div>
    </section>`;
  }
  return html;
}

function renderBracket() {
  const stages = [["R32", "Round of 32"], ["R16", "Round of 16"], ["QF", "Quarter-finals"], ["SF", "Semi-finals"], ["FINAL", "Final · Jul 19"]];
  const ko = DATA.matches.filter(m => m.stage !== "GROUP");
  const third = ko.find(m => m.stage === "3RD");
  let html = `<h2 class="section-title">🌳 The Path Of Fates</h2>
  <div class="chips">
    <button class="chip ${bracketMode === "oracle" ? "active" : ""}" data-bmode="oracle">🔮 Oracle's vision</button>
    <button class="chip ${bracketMode === "you" ? "active" : ""}" data-bmode="you">🫵 Your bracket</button>
  </div>
  <div class="bracket-hint">${bracketMode === "you" ? "Tap a team in each tie to send them through — your picks ripple forward." : "Swipe → to follow the Oracle's projected road to MetLife."}</div>
  <div class="bracket-scroll"><div class="bracket-cols">`;
  for (const [st, label] of stages) {
    html += `<div class="bracket-col"><h4>${label}</h4>`;
    for (const m of ko.filter(x => x.stage === st)) html += bkMatch(m);
    if (st === "FINAL" && third) html += `<h4 style="margin-top:8px;">Bronze · Jul 18</h4>` + bkMatch(third);
    html += `</div>`;
  }
  html += `</div></div>`;
  return html;
}
function resolveBkTeam(m, side) {
  // side: 'home'|'away'. In 'you' mode, propagate user picks through feeder matches.
  const slot = side === "home" ? m.homeSlot : m.awaySlot;
  const oracleTeam = side === "home" ? m.predHome : m.predAway;
  if (bracketMode === "oracle") return { team: oracleTeam, slot };
  const ref = (slot || "").match(/(Winner|Loser)\s+(R32-\d+|R16-\d+|QF-\d+|SF-\d+)/);
  if (ref) {
    const feeder = DATA.matches.find(x => x.id === ref[2]);
    if (feeder) {
      const fh = resolveBkTeam(feeder, "home").team, fa = resolveBkTeam(feeder, "away").team;
      const w = bracketPicks[feeder.id];
      if (w && (w === fh || w === fa)) return { team: ref[1] === "Winner" ? w : (w === fh ? fa : fh), slot };
      return { team: null, slot: ref[1] + " " + ref[2] };
    }
  }
  return { team: oracleTeam, slot }; // R32: group slots — seed from oracle projection
}
function bkMatch(m) {
  const h = resolveBkTeam(m, "home"), a = resolveBkTeam(m, "away");
  const youPick = bracketPicks[m.id];
  const pred = parseScore(m.predictedScore);
  const oracleWinner = pred && m.predHome && m.predAway ? (pred[0] > pred[1] ? m.predHome : m.predAway) : null;
  const row = (r, isWinner) => `
    <div class="bk-team ${isWinner ? "winner" : ""}" data-bkpick="${esc(m.id)}" data-team="${esc(r.team || "")}">
      <span class="flag">${r.team ? flag(r.team) : "❔"}</span>
      <span class="nm ${r.team ? "" : "slot"}">${esc(r.team || r.slot || "TBD")}</span>
      ${bracketMode === "oracle" && r.team && m.predictedScore && pred ? `<span class="sc">${r === h ? pred[0] : pred[1]}</span>` : ""}
      ${bracketMode === "you" && youPick && youPick === r.team ? `<span class="sc">✓</span>` : ""}
    </div>`;
  const hWin = bracketMode === "oracle" ? (oracleWinner && h.team === oracleWinner) : (youPick && youPick === h.team);
  const aWin = bracketMode === "oracle" ? (oracleWinner && a.team === oracleWinner) : (youPick && youPick === a.team);
  return `<div class="bk-match ${m.stage === "FINAL" ? "final-match" : ""}" data-bkexpand="${esc(m.id)}">
    ${row(h, hWin)}${row(a, aWin)}
    <div class="bk-meta"><span>${esc(fmtDate(m.date))}</span><span>${esc((m.venue || "").split(",")[0])}</span></div>
  </div>`;
}

function renderOracle() {
  const o = DATA.oracle;
  const teamNames = Object.keys(DATA.teams).sort();
  const maxProb = Math.max(...(o.championOdds || []).map(x => x.impliedProb || 0), 1);
  let html = `
  <div class="hero-card">
    <div class="crown">👑</div>
    <div class="hc-label">The Orb Has Spoken — Champion</div>
    <div class="hc-team">${flag(o.champion.team)} ${esc(o.champion.team)}</div>
    <div class="reading">${esc(o.champion.reading)}</div>
  </div>
  <div class="mini-grid">
    <div class="mini-card"><div class="mc-label">Runner-up</div><div class="mc-val">${flag(o.runnerUp.team)} ${esc(o.runnerUp.team)}</div></div>
    <div class="mini-card"><div class="mc-label">Semi-finalists</div><div class="mc-val" style="font-size:12.5px;">${(o.semifinalists || []).map(t => `${flag(t)} ${esc(t)}`).join("<br>")}</div></div>
    <div class="mini-card"><div class="mc-label">Golden Boot</div><div class="mc-val" style="font-size:13px;">${esc(o.goldenBoot.player)}</div><div class="mc-sub">${flag(o.goldenBoot.team)} ${esc(o.goldenBoot.team)}</div></div>
    <div class="mini-card"><div class="mc-label">Final</div><div class="mc-val" style="font-size:12px;">MetLife Stadium</div><div class="mc-sub">July 19, 2026</div></div>
  </div>
  ${o.runnerUp.reading ? `<div class="story-card"><strong>The silver thread:</strong> ${esc(o.runnerUp.reading)}</div>` : ""}
  ${o.goldenBoot.reading ? `<div class="story-card"><strong>⚽ Golden Boot vision:</strong> ${esc(o.goldenBoot.reading)}</div>` : ""}
  ${o.boldPrediction ? `<div class="bold-pred">${esc(o.boldPrediction)}</div>` : ""}

  <h2 class="section-title">📊 How The Powers Align</h2>
  <div class="story-card" style="padding:14px 10px;">
    ${(o.championOdds || []).slice(0, 12).map(x => `
      <div class="odds-row">
        <span class="flag">${flag(x.team)}</span><span class="nm">${esc(x.team)}</span>
        <span class="bar"><i style="width:${(x.impliedProb / maxProb) * 100}%"></i></span>
        <span class="pct">${x.impliedProb}%</span>
      </div>`).join("")}
  </div>

  <h2 class="section-title">🐎 Dark Horses In The Mist</h2>
  ${(o.darkHorses || []).map(d => `<div class="story-card"><strong>${flag(d.team)} ${esc(d.team)}</strong> — ${esc(d.why)}</div>`).join("")}

  <h2 class="section-title">📖 The Threads Of Fate</h2>
  ${(o.narratives || []).map(n => `<div class="story-card">${esc(n)}</div>`).join("")}

  <h2 class="section-title">🫵 Cast Your Own Prophecy</h2>
  <div class="prophecy-zone">
    <label>Your champion</label>
    <select id="prophChampion">
      <option value="">— gaze into the orb —</option>
      ${teamNames.map(t => `<option ${prophecy.champion === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
    </select>
    <label>Your Golden Boot</label>
    <select id="prophBoot">
      <option value="">— choose a marksman —</option>
      ${(o.goldenBoot.candidates || []).map(c => `<option ${prophecy.goldenBoot === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
    </select>
    <button class="btn-gold" id="shareProphecy">Share your prophecy with friends ⤴</button>
  </div>
  <div class="updated-chip">Crystal last polished: ${esc(DATA.meta.updated)}</div>`;
  return html;
}

/* ---------- team dossier sheet ---------- */
function openDossier(name) {
  const t = DATA.teams[name];
  if (!t) return;
  $("#sheet").innerHTML = `
    <div class="grab"></div>
    <h2>${flag(name)} ${esc(name)}</h2>
    <div class="sub">Group ${esc(t.group)}${t.fifaRank ? " · FIFA Rank #" + t.fifaRank : ""}${t.manager ? " · " + esc(t.manager) : ""}</div>
    ${t.style ? `<div class="dossier-row"><div class="dr-label">Tactical identity</div>${esc(t.style)}</div>` : ""}
    ${t.form ? `<div class="dossier-row"><div class="dr-label">Form entering the tournament</div>${esc(t.form)}</div>` : ""}
    ${t.keyPlayers && t.keyPlayers.length ? `<div class="dossier-row"><div class="dr-label">Ones to watch</div>${t.keyPlayers.map(p => `<span class="player-chip">⭐ ${esc(p)}</span>`).join("")}</div>` : ""}
    ${t.outlook ? `<div class="dossier-row"><div class="dr-label">The Oracle's outlook</div>${esc(t.outlook)}</div>` : ""}`;
  $("#sheet").hidden = false;
  $("#sheetBackdrop").hidden = false;
}
function closeSheet() { $("#sheet").hidden = true; $("#sheetBackdrop").hidden = true; }

/* ---------- render root ---------- */
function render() {
  const v = $("#view");
  if (currentView === "today") v.innerHTML = renderToday();
  else if (currentView === "fixtures") v.innerHTML = renderFixtures();
  else if (currentView === "groups") v.innerHTML = renderGroups();
  else if (currentView === "bracket") v.innerHTML = renderBracket();
  else v.innerHTML = renderOracle();
  updateStrip();
}
function updateStrip() {
  const { oracle, you, graded } = tallies();
  $("#scoreStrip").hidden = graded === 0;
  $("#oraclePts").textContent = oracle;
  $("#youPts").textContent = you;
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const nav = e.target.closest(".nav-btn");
  if (nav) {
    currentView = nav.dataset.view;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b === nav));
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  const chip = e.target.closest("[data-filter]");
  if (chip) { fixtureFilter = chip.dataset.filter; render(); return; }
  const bmode = e.target.closest("[data-bmode]");
  if (bmode) { bracketMode = bmode.dataset.bmode; render(); return; }

  // bracket team pick (you mode)
  const bkTeam = e.target.closest("[data-bkpick]");
  if (bkTeam && bracketMode === "you") {
    const team = bkTeam.dataset.team;
    if (team) {
      const mid = bkTeam.dataset.bkpick;
      if (bracketPicks[mid] === team) delete bracketPicks[mid]; else bracketPicks[mid] = team;
      save(LS_BRACKET, bracketPicks);
      render();
    }
    return;
  }

  // steppers
  const stepBtn = e.target.closest(".stepper button");
  if (stepBtn) {
    const zone = stepBtn.closest("[data-pick]");
    const mid = zone.dataset.pick;
    const side = Number(stepBtn.closest(".stepper").dataset.side);
    const cur = picks[mid] || [0, 0];
    const next = [...cur.map(x => x === "" ? 0 : x)];
    next[side] = Math.max(0, Math.min(9, (next[side] || 0) + Number(stepBtn.dataset.d)));
    picks[mid] = next;
    save(LS_PICKS, picks);
    zone.querySelectorAll(".stepper").forEach((st, i) => st.querySelector(".val").textContent = next[i]);
    zone.querySelector(".pick-saved").textContent = "✨ Prophecy sealed";
    setTimeout(() => { const el = zone.querySelector(".pick-saved"); if (el) el.textContent = ""; }, 1600);
    updateStrip();
    return;
  }

  // expand match card
  const head = e.target.closest("[data-expand]");
  if (head) { head.closest(".match-card").classList.toggle("expanded"); return; }

  const gt = e.target.closest("[data-gtoggle]");
  if (gt) { gt.closest(".group-card").classList.toggle("open"); return; }

  const teamRow = e.target.closest("[data-team].standing-row");
  if (teamRow) { openDossier(teamRow.dataset.team); return; }

  if (e.target.closest("#sheetBackdrop")) { closeSheet(); return; }

  if (e.target.closest("#shareBtn") || e.target.closest("#shareProphecy")) {
    const champ = prophecy.champion ? `My champion: ${prophecy.champion} 🏆 ` : "";
    const txt = `🔮 The Crystal Ball — World Cup 2026 Oracle. ${champ}Can you out-predict the orb?`;
    if (navigator.share) navigator.share({ title: "Crystal Ball — WC2026 Oracle", text: txt, url: location.href }).catch(() => {});
    else { navigator.clipboard?.writeText(txt + " " + location.href); alert("Link copied — send it to your rivals 🔮"); }
    return;
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "prophChampion") { prophecy.champion = e.target.value; save(LS_PROPHECY, prophecy); }
  if (e.target.id === "prophBoot") { prophecy.goldenBoot = e.target.value; save(LS_PROPHECY, prophecy); }
});

/* ---------- boot ---------- */
fetch("data/predictions.json")
  .then(r => r.json())
  .then(d => { DATA = d; render(); })
  .catch(() => { $("#view").innerHTML = `<div class="empty-note">The orb is clouded… could not load prophecy data.</div>`; });
})();
