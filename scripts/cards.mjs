#!/usr/bin/env node
// Gera os cards de estatísticas e de linguagens mais usadas no tema azul-marinho do perfil.
//
// Uso:
//   GITHUB_TOKEN=... node scripts/cards.mjs --user <login> [--name "Nome"] --out dist
//   node scripts/cards.mjs --demo --out dist   (dados de exemplo, sem rede)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRAMES, spriteRects } from './sprite.mjs';

const THEME = {
  bg: '#0D1B2A',
  border: '#1B3A5C',
  title: '#4FA3E0',
  text: '#C9D1D9',
  muted: '#8B9BB4',
  icon: '#4FA3E0'
};
const FONT = `'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif`;
const CARD_H = 175;
const TOP_LANGS = 6;
// Linguagens que não devem entrar no card (ex.: 'Jupyter Notebook').
const HIDDEN_LANGS = new Set([]);

// ---------- Dados ----------

async function fetchStats(user, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      name
      login
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
      contributionsCollection { totalCommitContributions restrictedContributionsCount }
      pullRequests { totalCount }
      issues { totalCount }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'totodile-profile-cards'
    },
    body: JSON.stringify({ query, variables: { login: user } })
  });
  const body = await res.json();
  if (!res.ok || body.errors || !body.data?.user) {
    throw new Error(`GitHub API: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  }
  const u = body.data.user;
  const langs = new Map();
  for (const repo of u.repositories.nodes) {
    for (const { size, node } of repo.languages.edges) {
      if (HIDDEN_LANGS.has(node.name)) continue;
      const cur = langs.get(node.name) ?? { name: node.name, color: node.color, size: 0 };
      cur.size += size;
      langs.set(node.name, cur);
    }
  }
  const cc = u.contributionsCollection;
  return {
    name: u.name || u.login,
    stars: u.repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0),
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    repos: u.repositories.totalCount,
    langs: [...langs.values()]
  };
}

function demoStats() {
  return {
    name: 'Aurelio Almeida',
    stars: 12,
    commits: 248,
    prs: 9,
    issues: 4,
    repos: 17,
    langs: [
      { name: 'PHP', color: '#4F5D95', size: 42000 },
      { name: 'C#', color: '#178600', size: 31000 },
      { name: 'Kotlin', color: '#A97BFF', size: 18000 },
      { name: 'Dart', color: '#00B4AB', size: 15000 },
      { name: 'C++', color: '#f34b7d', size: 9000 },
      { name: 'C', color: '#555555', size: 6000 },
      { name: 'HTML', color: '#e34c26', size: 3000 }
    ]
  };
}

// ---------- SVG ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function cardShell(width, title, body, extraCss = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CARD_H}" viewBox="0 0 ${width} ${CARD_H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
.t{font:600 18px ${FONT};fill:${THEME.title}}
.l{font:400 14px ${FONT};fill:${THEME.text}}
.v{font:700 14px ${FONT};fill:${THEME.text}}
.s{font:400 12px ${FONT};fill:${THEME.text}}
.p{fill:${THEME.muted}}
.row{opacity:0;animation:in .4s ease-out forwards}
@keyframes in{to{opacity:1}}
${extraCss}
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${CARD_H - 1}" rx="6" fill="${THEME.bg}" stroke="${THEME.border}"/>
<text class="t" x="25" y="35">${esc(title)}</text>
${body}
</svg>
`;
}

function statsCard(stats) {
  const rows = [
    ['Total Stars Earned', stats.stars],
    ['Commits (last year)', stats.commits],
    ['Total PRs', stats.prs],
    ['Total Issues', stats.issues],
    ['Public Repos', stats.repos]
  ];
  const body = rows
    .map(([label, value], i) => {
      const y = 68 + i * 22;
      return `<g class="row" style="animation-delay:${(i * 0.12).toFixed(2)}s">
<rect x="25" y="${y - 9}" width="8" height="8" fill="${THEME.icon}"/>
<text class="l" x="44" y="${y}">${label}:</text>
<text class="v" x="215" y="${y}">${value.toLocaleString('en-US')}</text>
</g>`;
    })
    .join('\n');

  // Jacarezinho mastigando no canto direito.
  const pixel = 4;
  const spriteW = FRAMES[0][0].length * pixel;
  const spriteH = FRAMES[0].length * pixel;
  const croc = `<g transform="translate(${467 - 30 - spriteW} ${(CARD_H - spriteH) / 2 + 12})" shape-rendering="crispEdges">${FRAMES.map(
    (f, i) => `<g class="f${i}">${spriteRects(f, pixel)}</g>`
  ).join('')}</g>`;
  const css = `.f0{animation:f0 .8s linear infinite}.f1{animation:f1 .8s linear infinite}
@keyframes f0{0%,49.9%{opacity:1}50%,100%{opacity:0}}
@keyframes f1{0%,49.9%{opacity:0}50%,100%{opacity:1}}`;

  return cardShell(467, `${stats.name}'s GitHub Stats`, `${body}\n${croc}`, css);
}

function langsCard(stats) {
  const width = 300;
  const top = [...stats.langs].sort((a, b) => b.size - a.size).slice(0, TOP_LANGS);
  const total = top.reduce((sum, l) => sum + l.size, 0);
  if (total === 0) {
    return cardShell(width, 'Most Used Languages', `<text class="s p" x="25" y="80">No public code yet.</text>`);
  }
  const barW = width - 50;
  let x = 25;
  const bar = top
    .map((l) => {
      const w = (l.size / total) * barW;
      const seg = `<rect x="${x.toFixed(2)}" y="50" width="${w.toFixed(2)}" height="8" fill="${l.color ?? THEME.muted}"/>`;
      x += w;
      return seg;
    })
    .join('');
  const legend = top
    .map((l, i) => {
      const lx = 25 + (i % 2) * 135;
      const ly = 88 + Math.floor(i / 2) * 25;
      const pct = ((l.size / total) * 100).toFixed(2);
      return `<g class="row" style="animation-delay:${(i * 0.1).toFixed(2)}s">
<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color ?? THEME.muted}"/>
<text class="s" x="${lx + 15}" y="${ly}">${esc(l.name)} <tspan class="p">${pct}%</tspan></text>
</g>`;
    })
    .join('\n');
  const body = `<clipPath id="bar"><rect x="25" y="50" width="${barW}" height="8" rx="4"/></clipPath>
<g clip-path="url(#bar)">${bar}</g>
${legend}`;
  return cardShell(width, 'Most Used Languages', body);
}

// ---------- CLI ----------

function parseArgs(argv) {
  const opts = { out: 'dist', demo: false, user: null, name: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--demo') opts.demo = true;
    else if (argv[i] === '--user') opts.user = argv[++i];
    else if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--name') opts.name = argv[++i];
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
let stats;
if (opts.demo) {
  stats = demoStats();
} else {
  if (!opts.user) throw new Error('Informe --user <login> ou use --demo');
  if (!process.env.GITHUB_TOKEN) throw new Error('Defina a variável GITHUB_TOKEN');
  stats = await fetchStats(opts.user, process.env.GITHUB_TOKEN);
}
if (opts.name) stats.name = opts.name;

mkdirSync(opts.out, { recursive: true });
for (const [file, svg] of [['stats.svg', statsCard(stats)], ['top-langs.svg', langsCard(stats)]]) {
  writeFileSync(join(opts.out, file), svg);
  console.log(`gerado ${join(opts.out, file)}`);
}
