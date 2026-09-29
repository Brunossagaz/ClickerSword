/*
 * grid_monster_sheet.js
 * Monta a spritesheet de um monstro desenhado à mão no formato GridFab
 * (art/<pasta>/grid.txt + palette.txt, 64x64) no mesmo formato que
 * gen_monsters.py gera: 3 quadros de 128x128 (arte 64x64 ampliada 2x)
 * [ parado | piscando | flash de dano ].
 *
 * Piscar: os pixels com os aliases de olho viram pálpebra (lid) e a linha
 * de baixo de cada coluna do olho vira contorno.
 *
 * Sem dependências (só Node):
 *   node tools/grid_monster_sheet.js            # gera todos da tabela
 *   node tools/grid_monster_sheet.js fire_lizard
 *   node tools/grid_monster_sheet.js fire_lizard --palette x   # usa palette-x.txt em vez de palette.txt
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const UP = 2;
const OUTLINE = 'OL';

const SPRITES = {
  fire_lizard: { art: 'monster-fire-lizard', eyes: ['E1', 'E2', 'PU'], lid: 'C2' },
  // alternativa em 3/4 (ainda não usada no jogo)
  fire_lizard_34: { art: 'monster-fire-lizard-34', eyes: ['E1', 'E2', 'PU'], lid: 'C2' },
};

function readArt(dir, variant) {
  const palette = {};
  for (const line of fs.readFileSync(path.join(dir, variant ? `palette-${variant}.txt` : 'palette.txt'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s][^=\s]?)\s*=\s*#([0-9a-fA-F]{6})/);
    if (m) palette[m[1]] = m[2];
  }
  const grid = fs.readFileSync(path.join(dir, 'grid.txt'), 'utf8').trim().split(/\r?\n/)
    .map(r => r.trim().split(/\s+/).map(v => v.replace(/\./g, '') || null));
  return { palette, grid };
}

function blinkFrame(grid, eyes, lid) {
  const eyeSet = new Set(eyes);
  const isEye = (x, y) => grid[y] && eyeSet.has(grid[y][x]);
  return grid.map((row, y) => row.map((a, x) => {
    if (!eyeSet.has(a)) return a;
    return isEye(x, y + 1) ? lid : OUTLINE;
  }));
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePng(file, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // 8 bits
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

function build(key, variant) {
  const cfg = SPRITES[key];
  const { palette, grid } = readArt(path.join(ROOT, 'art', cfg.art), variant || cfg.palette);
  const N = grid.length;
  const frames = [grid, blinkFrame(grid, cfg.eyes, cfg.lid), grid.map(r => r.map(a => a && 'FLASH'))];
  const pal = { ...palette, FLASH: 'FFFFFF' };
  const W = N * frames.length * UP, H = N * UP;
  const rgba = Buffer.alloc(W * H * 4);
  frames.forEach((f, fi) => f.forEach((row, y) => row.forEach((a, x) => {
    if (!a) return;
    const hex = pal[a];
    if (!hex) throw new Error(`${key}: alias "${a}" sem cor na paleta (${x},${y})`);
    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let j = 0; j < UP; j++) for (let i = 0; i < UP; i++) {
      rgba.set([...rgb, 255], ((y * UP + j) * W + (fi * N + x) * UP + i) * 4);
    }
  })));
  const out = path.join(ROOT, 'assets', 'sprites', `${key}.png`);
  writePng(out, W, H, rgba);
  console.log(`${key}: ${path.relative(ROOT, out)} (${W}x${H})`);
}

const args = process.argv.slice(2);
const pi = args.indexOf('--palette');
const variant = pi >= 0 ? args.splice(pi, 2)[1] : null;
for (const key of args.length ? args : Object.keys(SPRITES)) build(key, variant);
