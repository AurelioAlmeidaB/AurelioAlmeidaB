#!/usr/bin/env node
// Gera um SVG animado de um jacarezinho azul comendo o gráfico de contribuições do GitHub.
//
// Uso:
//   GITHUB_TOKEN=... node scripts/totodile.mjs --user <login> --out dist
//   node scripts/totodile.mjs --demo --out dist   (dados aleatórios, sem rede)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- Sprite (pixel art, olhando para a direita) ----------

const SPRITE_COLORS = {
  'o': '#0a2342',
  'b': '#3e8ede',
  'h': '#8fd0ff',
  'd': '#2a64ad',
  'c': '#f6e3a1',
  'r': '#e2453c',
  'w': '#ffffff',
  'k': '#7a1222',
  't': '#ffffff',
  'm': '#9c2b3a'
};

// Frame 0: boca fechada / passo A. Frame 1: boca aberta / passo B.
const FRAMES = [
  [
    '...........oooooooo.....',
    '..........obbbbbbbbo....',
    '.........obhhbbbbbbbo...',
    '.........obhbbbwwbbbbo..',
    '.........obbbbbwkkbbbbo.',
    '...r.r.r.obbbbbwkkbbbbbo',
    '..orororoobbbbbbbbbbbbbo',
    '.obbbbbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbotototototo',
    '.obbbbbbbbbbbcccccccccco',
    '..odbbbbbbbbccoooooooooo',
    '...odbbccbbbcco.........',
    '....odbbccccccbo........',
    '.....obbddddbbo.........',
    '.....obbo..obbo.........',
    '.....ooo...ooo..........'
  ],
  [
    '...........oooooooo.....',
    '..........obbbbbbbbo....',
    '.........obhhbbbbbbbo...',
    '.........obhbbbwwbbbbo..',
    '.........obbbbbwkkbbbbo.',
    '...r.r.r.obbbbbwkkbbbbbo',
    '..orororoobbbbbbbbbbbbbo',
    '.obbbbbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbotototototo',
    '.obbbbbbbbbbbommmmmmmmmo',
    '..odbbbbbbbbbomtmtmtmtmo',
    '...odbbccbbbbcccccccccco',
    '....odbbccccccoooooooooo',
    '.....obbddddbbo.........',
    '....obbo....obbo........',
    '....ooo.....ooo.........'
  ]
];

// ---------- Temas do gráfico ----------

const THEMES = {
  'totodile-contribution-grid.svg': {
    empty: '#e1eaf5',
    levels: ['#a8cdf2', '#5a9fe3', '#2766b8', '#0b3a75']
  },
  'totodile-contribution-grid-dark.svg': {
    empty: '#111d2e',
    levels: ['#0f3b6e', '#1a5fae', '#2f86e0', '#7cc4ff']
  }
};

// ---------- Geometria e tempo ----------

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const PIXEL = 2;
const SPRITE_W = FRAMES[0][0].length * PIXEL;
const SPRITE_H = FRAMES[0].length * PIXEL;
const MOUTH = SPRITE_W / 2 - PIXEL; // distância do centro do sprite até a boca
const PAD_X = SPRITE_W + 8;
const PAD_Y = SPRITE_H / 2;
const SPEED = 230; // px/s
const TURN = 0.35; // s para virar e descer uma linha
const HOLD_EMPTY = 0.8; // s com o gráfico vazio depois que o jacaré sai
const REFILL = 0.6; // s para o gráfico reaparecer

// ---------- Dados ----------

const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4
};

async function fetchGrid(user, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks { contributionDays { contributionLevel weekday } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'totodile-contribution-grid'
    },
    body: JSON.stringify({ query, variables: { login: user } })
  });
  const body = await res.json();
  if (!res.ok || body.errors || !body.data?.user) {
    throw new Error(`GitHub API: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  }
  const weeks = body.data.user.contributionsCollection.contributionCalendar.weeks;
  return weeks.map((w) => {
    const col = new Array(7).fill(null);
    for (const d of w.contributionDays) col[d.weekday] = LEVELS[d.contributionLevel] ?? 0;
    return col;
  });
}

function demoGrid() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 53 }, (_, c) =>
    Array.from({ length: 7 }, (_, r) => {
      if (c === 52 && r > 3) return null;
      const x = rand();
      return x < 0.45 ? 0 : x < 0.7 ? 1 : x < 0.85 ? 2 : x < 0.95 ? 3 : 4;
    })
  );
}

// ---------- Trajeto ----------

// O jacaré percorre as linhas em zigue-zague: linha 0 da esquerda para a direita,
// linha 1 da direita para a esquerda, e assim por diante. Cada keyframe guarda o
// centro do sprite (x, y) e a direção (sx = 1 direita, -1 esquerda).
function buildPath(cols) {
  const gridW = cols * PITCH - GAP;
  const rowY = (r) => r * PITCH + CELL / 2;
  const keys = [];
  const walks = [];
  let t = 0;
  let x = -PAD_X - SPRITE_W / 2;
  keys.push({ t, x, y: rowY(0), sx: 1 });

  for (let r = 0; r < 7; r++) {
    const dir = r % 2 === 0 ? 1 : -1;
    const last = r === 6;
    // Boca 4px depois da última célula, ou totalmente fora da tela no fim.
    const mouthEnd = dir === 1 ? gridW + 4 : -4;
    const xEnd = last ? (dir === 1 ? gridW + PAD_X + SPRITE_W / 2 : -PAD_X - SPRITE_W / 2) : mouthEnd - dir * MOUTH;
    const dt = Math.abs(xEnd - x) / SPEED;
    walks.push({ row: r, dir, t0: t, x0: x, t1: t + dt, x1: xEnd });
    t += dt;
    x = xEnd;
    keys.push({ t, x, y: rowY(r), sx: dir });
    if (last) break;
    // Vira no lugar da boca: o sprite gira em torno da cabeça e desce uma linha.
    x = x + 2 * dir * MOUTH;
    t += TURN;
    keys.push({ t, x, y: rowY(r + 1), sx: -dir });
  }
  return { keys, walks, walkEnd: t, total: t + HOLD_EMPTY + REFILL, gridW };
}

function eatTime(walk, cellCenterX) {
  const mouthX0 = walk.x0 + walk.dir * MOUTH;
  const dist = (cellCenterX - mouthX0) * walk.dir;
  return walk.t0 + Math.max(0, dist) / SPEED;
}

// ---------- SVG ----------

const pct = (t, total) => `${((t / total) * 100).toFixed(3)}%`;

function spriteRects(frame) {
  let out = '';
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        out += `<rect x="${x * PIXEL}" y="${y * PIXEL}" width="${(end - x) * PIXEL}" height="${PIXEL}" fill="${SPRITE_COLORS[ch]}"/>`;
      }
      x = end;
    }
  });
  return out;
}

function render(grid, theme) {
  const cols = grid.length;
  const { keys, walks, walkEnd, total, gridW } = buildPath(cols);
  const gridH = 7 * PITCH - GAP;
  const vbX = -PAD_X;
  const vbY = -PAD_Y;
  const vbW = gridW + 2 * PAD_X;
  const vbH = gridH + 2 * PAD_Y;
  const refillStart = pct(walkEnd + HOLD_EMPTY, total);

  let css = `
    .e{fill:${theme.empty}}
    ${theme.levels.map((c, i) => `.l${i + 1}{fill:${c}}`).join('')}
    #croc{animation:move ${total.toFixed(3)}s linear infinite}
    .f0{animation:f0 .36s linear infinite}
    .f1{animation:f1 .36s linear infinite}
    @keyframes f0{0%,49.9%{opacity:1}50%,100%{opacity:0}}
    @keyframes f1{0%,49.9%{opacity:0}50%,100%{opacity:1}}
    @keyframes move{${keys
      .map((k) => `${pct(k.t, total)}{transform:translate(${k.x.toFixed(1)}px,${k.y.toFixed(1)}px) scale(${k.sx},1)}`)
      .join('')}100%{transform:translate(${keys.at(-1).x.toFixed(1)}px,${keys.at(-1).y.toFixed(1)}px) scale(1,1)}}`;

  let cells = '';
  let eaten = '';
  let n = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const level = grid[c][r];
      if (level === null || level === undefined) continue;
      const x = c * PITCH;
      const y = r * PITCH;
      cells += `<rect class="e" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
      if (level === 0) continue;
      const te = eatTime(walks[r], x + CELL / 2);
      const a = pct(te, total);
      const b = pct(te + 0.08, total);
      css += `@keyframes k${n}{0%,${a}{opacity:1}${b},${refillStart}{opacity:0}100%{opacity:1}}`;
      eaten += `<rect class="l${level}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" style="animation:k${n} ${total.toFixed(3)}s linear infinite"/>`;
      n++;
    }
  }

  const sprite = FRAMES.map((f, i) => `<g class="f${i}">${spriteRects(f)}</g>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
<desc>Jacarezinho azul comendo o gráfico de contribuições do GitHub</desc>
<style>${css.replace(/\n\s*/g, '')}</style>
<g shape-rendering="crispEdges">${cells}${eaten}</g>
<g id="croc"><g transform="translate(${-SPRITE_W / 2} ${-SPRITE_H / 2})" shape-rendering="crispEdges">${sprite}</g></g>
</svg>
`;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const opts = { out: 'dist', demo: false, user: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--demo') opts.demo = true;
    else if (argv[i] === '--user') opts.user = argv[++i];
    else if (argv[i] === '--out') opts.out = argv[++i];
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
let grid;
if (opts.demo) {
  grid = demoGrid();
} else {
  if (!opts.user) throw new Error('Informe --user <login> ou use --demo');
  if (!process.env.GITHUB_TOKEN) throw new Error('Defina a variável GITHUB_TOKEN');
  grid = await fetchGrid(opts.user, process.env.GITHUB_TOKEN);
}

mkdirSync(opts.out, { recursive: true });
for (const [file, theme] of Object.entries(THEMES)) {
  writeFileSync(join(opts.out, file), render(grid, theme));
  console.log(`gerado ${join(opts.out, file)}`);
}
