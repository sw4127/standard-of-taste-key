// Draws the toolbar icon as PNGs (Chrome needs PNG): a card on the ground, with one line of ink and
// one of quiet ink, as on every song card. No dependency: a PNG is written by hand with zlib.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const GROUND = [0xe4, 0xec, 0xe8], CARD = [0xf3, 0xf6, 0xf2], HAIR = [0x9f, 0xae, 0xa6];
const INK = [0x1b, 0x22, 0x20], QUIET = [0x45, 0x4f, 0x4a];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = (x, y) => {
    const u = (v) => Math.round(v * size);
    const inCard = x >= u(0.12) && x < u(0.88) && y >= u(0.22) && y < u(0.78);
    const onEdge = inCard && (x === u(0.12) || x === u(0.88) - 1 || y === u(0.22) || y === u(0.78) - 1);
    if (!inCard) return GROUND;
    if (onEdge) return HAIR;
    if (x >= u(0.24) && x < u(0.76) && y >= u(0.36) && y < Math.max(u(0.36) + 1, u(0.46))) return INK;
    if (x >= u(0.24) && x < u(0.6) && y >= u(0.56) && y < Math.max(u(0.56) + 1, u(0.62))) return QUIET;
    return CARD;
  };
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = new URL("../public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(new URL(`${s}.png`, dir), png(s));
console.log("icons: 16 32 48 128");
