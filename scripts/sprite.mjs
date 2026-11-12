// Sprite do jacarezinho (pixel art, olhando para a direita), usado pelos geradores de SVG.

export const SPRITE_COLORS = {
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
export const FRAMES = [
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

export function spriteRects(frame, pixel) {
  let out = '';
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        out += `<rect x="${x * pixel}" y="${y * pixel}" width="${(end - x) * pixel}" height="${pixel}" fill="${SPRITE_COLORS[ch]}"/>`;
      }
      x = end;
    }
  });
  return out;
}
