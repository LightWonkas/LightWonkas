// Generates the profile README cards as static SVGs in ./assets.
// No dependencies, no third-party card services: data comes straight from the
// GitHub REST API and the public contributions calendar. GITHUB_TOKEN is
// optional and only raises the API rate limit.

import { mkdir, writeFile } from "node:fs/promises";

const USER = process.env.PROFILE_USER || "LightWonkas";
const PINNED = (process.env.PINNED_REPOS || "argus,avizi-showcase").split(",");
const OUT = new URL("../assets/", import.meta.url);

const C = {
  bg: "#0d1117",
  border: "#30363d",
  accent: "#D4878A",
  text: "#c9d1d9",
  muted: "#8b949e",
  white: "#ffffff",
};
const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif";

const LANG_COLORS = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", HTML: "#e34c26",
  CSS: "#563d7c", Shell: "#89e051", Go: "#00ADD8", Rust: "#dea584", "C++": "#f34b7d",
  C: "#555555", Java: "#b07219", Kotlin: "#A97BFF", Swift: "#F05138", Dart: "#00B4AB",
  Vue: "#41b883", Svelte: "#ff3e00", Dockerfile: "#384d54", PLpgSQL: "#336790",
};

// ---------- data ----------

async function api(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-cards" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function contributionDays(fromYear) {
  const days = new Map();
  const thisYear = new Date().getUTCFullYear();
  for (let y = fromYear; y <= thisYear; y++) {
    const url = `https://github.com/users/${USER}/contributions?from=${y}-01-01&to=${y}-12-31`;
    const html = await (await fetch(url, { headers: { "User-Agent": "profile-cards" } })).text();
    const counts = new Map();
    for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
      const n = m[2].match(/^(\d[\d,]*) contribution/);
      counts.set(m[1], n ? Number(n[1].replace(/,/g, "")) : 0);
    }
    for (const m of html.matchAll(/<td[^>]*ContributionCalendar-day[^>]*>/g)) {
      const date = m[0].match(/data-date="([^"]+)"/)?.[1];
      const id = m[0].match(/id="([^"]+)"/)?.[1];
      if (date) days.set(date, counts.get(id) ?? 0);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return [...days.entries()].filter(([d]) => d <= today).sort(([a], [b]) => a.localeCompare(b));
}

function streaks(days) {
  let longest = { len: 0 }, run = { len: 0 };
  for (const [date, n] of days) {
    if (n > 0) {
      run = run.len ? { ...run, len: run.len + 1, end: date } : { len: 1, start: date, end: date };
      if (run.len > longest.len) longest = run;
    } else run = { len: 0 };
  }
  // Today without contributions yet doesn't break the current streak.
  let i = days.length - 1;
  if (i >= 0 && days[i][1] === 0) i--;
  let current = { len: 0 };
  for (; i >= 0 && days[i][1] > 0; i--) {
    current = { len: current.len + 1, start: days[i][0], end: current.end ?? days[i][0] };
  }
  return { current, longest };
}

// ---------- svg helpers ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const fmt = (n) => Number(n).toLocaleString("en-US");
const fmtDate = (d) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
const fmtRange = (r) => (r?.len ? (r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} – ${fmtDate(r.end)}`) : "No streak yet");

const ICON = {
  commit: "M10.5 7.75a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm1.43.75a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32Z",
  pr: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z",
  repo: "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z",
  star: "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z",
  fork: "M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z",
  people: "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z",
  calendar: "M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z",
  flame: "M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 6-6.5 6S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862 0 1.035.454C4.46 8.487 5.581 9.5 6.5 9.5c.462 0 .865-.272 1.02-.72.373-1.077-.208-2.288-.672-3.333C6.302 4.234 5.951 2.89 6.36 1.71 6.78.495 7.926.035 9.007.025a.53.53 0 0 1 .526.728Z",
};

const icon = (name, x, y, color = C.accent, size = 16) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16"><path fill="${color}" d="${ICON[name]}"/></svg>`;

const frame = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
  text { font-family: ${FONT}; }
  .fade { animation: fade .6s ease-out backwards; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes grow { from { stroke-dashoffset: var(--len); } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
${body}
</svg>
`;

function wrap(text, max, lines) {
  const out = [];
  let line = "";
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > max) {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    } else line = (line + " " + word).trim();
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && out.join(" ").length < String(text).trim().length) out[lines - 1] = out[lines - 1].replace(/\W*\S*$/, "") + "…";
  return out;
}

// ---------- cards ----------

function statsCard(s) {
  const W = 470, H = 200;
  const rows = [
    ["calendar", `Contributions (${s.year})`, s.yearTotal],
    ["commit", "Public commits", s.commits],
    ["pr", "Pull requests", s.prs],
    ["repo", "Public repositories", s.repos],
    ["people", "Followers", s.followers],
  ];
  const list = rows.map(([ic, label, val], i) => {
    const y = 58 + i * 24;
    return `<g class="fade" style="animation-delay:${150 + i * 120}ms">
  ${icon(ic, 25, y - 12)}
  <text x="50" y="${y}" fill="${C.text}" font-size="14">${esc(label)}:</text>
  <text x="235" y="${y}" fill="${C.white}" font-size="14" font-weight="700">${fmt(val)}</text>
</g>`;
  }).join("\n");

  // Ring: share of days with at least one contribution, this year.
  const r = 46, len = 2 * Math.PI * r, pct = s.activeDays / Math.max(1, s.daysThisYear);
  const ring = `<g transform="translate(365 103)">
  <circle r="${r}" fill="none" stroke="${C.border}" stroke-width="7"/>
  <circle r="${r}" fill="none" stroke="${C.accent}" stroke-width="7" stroke-linecap="round" transform="rotate(-90)"
    stroke-dasharray="${len.toFixed(2)}" stroke-dashoffset="${(len * (1 - pct)).toFixed(2)}"
    style="--len:${len.toFixed(2)};animation:grow 1.2s ease-out"/>
  <text y="2" text-anchor="middle" fill="${C.white}" font-size="24" font-weight="700">${s.activeDays}</text>
  <text y="20" text-anchor="middle" fill="${C.muted}" font-size="11">active days</text>
</g>`;

  // Language bar from public repos (by bytes).
  const total = s.languages.reduce((a, [, b]) => a + b, 0) || 1;
  let x = 25;
  const bar = s.languages.map(([name, bytes]) => {
    const w = Math.max(2, (bytes / total) * 420);
    const seg = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="8" fill="${LANG_COLORS[name] || C.muted}"/>`;
    x += w;
    return seg;
  }).join("");
  let lx = 25;
  const legend = s.languages.filter(([, b]) => b / total >= 0.01).slice(0, 5).map(([name, bytes]) => {
    const label = `${name} ${((bytes / total) * 100).toFixed(1)}%`;
    const g = `<circle cx="${lx + 4}" cy="-4" r="4" fill="${LANG_COLORS[name] || C.muted}"/><text x="${lx + 12}" y="0" fill="${C.text}" font-size="11">${esc(label)}</text>`;
    lx += 20 + label.length * 6;
    return g;
  }).join("");

  return frame(W, H, `<text x="25" y="32" fill="${C.accent}" font-size="18" font-weight="600">GitHub Stats</text>
${list}
${ring}
<clipPath id="bar"><rect x="25" y="0" width="420" height="8" rx="4"/></clipPath>
<g transform="translate(0 172)" class="fade" style="animation-delay:800ms"><g clip-path="url(#bar)">${bar}</g></g>
<g transform="translate(0 192)" class="fade" style="animation-delay:900ms">${legend}</g>`, `${USER} GitHub stats`);
}

function streakCard(s) {
  const W = 470, H = 200;
  const col = (cx, value, label, sub, color, delay) => `<g class="fade" style="animation-delay:${delay}ms">
  <text x="${cx}" y="96" text-anchor="middle" fill="${C.white}" font-size="28" font-weight="700">${value}</text>
  <text x="${cx}" y="128" text-anchor="middle" fill="${color}" font-size="14" font-weight="600">${esc(label)}</text>
  <text x="${cx}" y="150" text-anchor="middle" fill="${C.muted}" font-size="12">${esc(sub)}</text>
</g>`;
  const r = 40, len = 2 * Math.PI * r;
  return frame(W, H, `<line x1="157" y1="40" x2="157" y2="165" stroke="${C.border}"/>
<line x1="313" y1="40" x2="313" y2="165" stroke="${C.border}"/>
${col(79, fmt(s.total), "Total Contributions", `${fmtDate(s.first)} – Present`, C.text, 100)}
<g transform="translate(235 86)">
  <circle r="${r}" fill="none" stroke="${C.accent}" stroke-width="5" stroke-dasharray="${len.toFixed(2)}" style="--len:${len.toFixed(2)};animation:grow 1s ease-out" transform="rotate(-90)"/>
  <rect x="-13" y="-${r + 13}" width="26" height="26" fill="${C.bg}"/>
  ${icon("flame", -9, -(r + 10), C.accent, 18)}
</g>
<g class="fade" style="animation-delay:300ms">
  <text x="235" y="96" text-anchor="middle" fill="${C.white}" font-size="28" font-weight="700">${s.current.len}</text>
  <text x="235" y="155" text-anchor="middle" fill="${C.accent}" font-size="14" font-weight="700">Current Streak</text>
  <text x="235" y="175" text-anchor="middle" fill="${C.muted}" font-size="12">${esc(fmtRange(s.current))}</text>
</g>
${col(391, s.longest.len, "Longest Streak", fmtRange(s.longest), C.text, 500)}`, `${USER} contribution streak`);
}

function pinCard(repo) {
  const W = 400, H = 130;
  const desc = wrap(repo.description || "No description provided.", 58, 2)
    .map((l, i) => `<text x="25" y="${68 + i * 19}" fill="${C.text}" font-size="13">${esc(l)}</text>`).join("\n");
  const lang = repo.language
    ? `<circle cx="31" cy="-4" r="6" fill="${LANG_COLORS[repo.language] || C.muted}"/><text x="43" y="0" fill="${C.text}" font-size="12">${esc(repo.language)}</text>`
    : "";
  const lx = repo.language ? 60 + repo.language.length * 7 : 25;
  return frame(W, H, `${icon("repo", 25, 22, C.muted)}
<text x="48" y="35" fill="${C.accent}" font-size="17" font-weight="600">${esc(repo.name)}</text>
<g class="fade" style="animation-delay:150ms">${desc}</g>
<g transform="translate(0 112)" class="fade" style="animation-delay:300ms">
  ${lang}
  ${icon("star", lx, -12, C.muted, 14)}<text x="${lx + 19}" y="0" fill="${C.text}" font-size="12">${fmt(repo.stargazers_count)}</text>
  ${icon("fork", lx + 50, -12, C.muted, 14)}<text x="${lx + 69}" y="0" fill="${C.text}" font-size="12">${fmt(repo.forks_count)}</text>
</g>`, `${repo.name} repository`);
}

// Typing intro: each line is revealed left-to-right in its own time slot.
function headerCard(lines) {
  const W = 620, H = 50, slot = 3.6, cycle = slot * lines.length;
  const typeEnd = (1.6 / cycle) * 100, hideStart = ((slot - 0.4) / cycle) * 100, hideEnd = (slot / cycle) * 100;
  const texts = lines.map((l, i) => `<text x="50%" y="34" text-anchor="middle" class="line" style="animation-delay:${(i * slot).toFixed(1)}s">${esc(l)}</text>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lines.join(" · "))}">
<title>${esc(lines.join(" · "))}</title>
<style>
  .line { font-family: ${FONT}; font-size: 26px; font-weight: 600; fill: ${C.accent};
    animation: slot ${cycle}s infinite both; opacity: 0; }
  .line:first-of-type { opacity: 1; }
  @keyframes slot {
    0% { clip-path: inset(0 100% 0 0); opacity: 1; animation-timing-function: steps(28, end); }
    ${typeEnd.toFixed(2)}% { clip-path: inset(0 0 0 0); opacity: 1; }
    ${hideStart.toFixed(2)}% { clip-path: inset(0 0 0 0); opacity: 1; }
    ${hideEnd.toFixed(2)}%, 100% { clip-path: inset(0 0 0 0); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .line { animation: none; } }
</style>
${texts}
</svg>
`;
}

// ---------- main ----------

const user = await api(`/users/${USER}`);
const repos = (await api(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork);
const [commits, prs] = await Promise.all([
  api(`/search/commits?q=author:${USER}&per_page=1`).then((r) => r.total_count),
  api(`/search/issues?q=author:${USER}+type:pr&per_page=1`).then((r) => r.total_count),
]);

const langBytes = new Map();
for (const r of repos) {
  for (const [name, bytes] of Object.entries(await api(`/repos/${USER}/${r.name}/languages`))) {
    langBytes.set(name, (langBytes.get(name) || 0) + bytes);
  }
}
const languages = [...langBytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

const days = await contributionDays(new Date(user.created_at).getUTCFullYear());
const year = new Date().getUTCFullYear();
const thisYear = days.filter(([d]) => d.startsWith(String(year)) && d >= user.created_at.slice(0, 10));
const firstActive = days.find(([, n]) => n > 0)?.[0] ?? user.created_at.slice(0, 10);

const stats = {
  year,
  yearTotal: thisYear.reduce((a, [, n]) => a + n, 0),
  activeDays: thisYear.filter(([, n]) => n > 0).length,
  daysThisYear: thisYear.length,
  commits, prs,
  repos: user.public_repos,
  followers: user.followers,
  languages,
};
const streak = { total: days.reduce((a, [, n]) => a + n, 0), first: firstActive, ...streaks(days) };

await mkdir(OUT, { recursive: true });
await writeFile(new URL("header.svg", OUT), headerCard([
  "Hi, I'm Emin 👋",
  "Full-stack & Product Developer",
  "Co-founder @ Avizi",
  "Building AI-assisted products from Istanbul",
]));
await writeFile(new URL("stats.svg", OUT), statsCard(stats));
await writeFile(new URL("streak.svg", OUT), streakCard(streak));
for (const name of PINNED) {
  const repo = await api(`/repos/${USER}/${name}`);
  await writeFile(new URL(`pin-${name}.svg`, OUT), pinCard(repo));
}
console.log(JSON.stringify({ stats, streak: { ...streak, current: streak.current, longest: streak.longest } }, null, 2));
