/**
 * Build favicon.ico from the Group ERP mark (same geometry as erp-logo.svg).
 * Pure Node — no extra packages.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../app/favicon.ico");

const BRAND = [0xf1, 0x5a, 0x43, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];
const CLEAR = [0, 0, 0, 0];

function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = ~0;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c0 = n;
      for (let k = 0; k < 8; k++) c0 = c0 & 1 ? 0xedb88320 ^ (c0 >>> 1) : c0 >>> 1;
      t[n] = c0 >>> 0;
    }
    return t;
  })();
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function circleStroke(size, cx, cy, r, stroke) {
  const out = new Array(size * size).fill(false);
  const rIn = r - stroke / 2;
  const rOut = r + stroke / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= rIn && d <= rOut) out[y * size + x] = true;
    }
  }
  return out;
}

function roundedRectMask(size, radius) {
  const mask = new Array(size * size).fill(false);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xi = Math.min(x, size - 1 - x);
      const yi = Math.min(y, size - 1 - y);
      let inside = true;
      if (xi < radius && yi < radius) {
        const dx = radius - xi - 0.5;
        const dy = radius - yi - 0.5;
        inside = dx * dx + dy * dy <= radius * radius;
      }
      mask[y * size + x] = inside;
    }
  }
  return mask;
}

function renderPng(size) {
  const scale = size / 64;
  const radius = 16 * scale;
  const stroke = Math.max(1.2, 3.25 * scale);
  const bg = roundedRectMask(size, radius);
  const c1 = circleStroke(size, 25.5 * scale, 26 * scale, 8.4 * scale, stroke);
  const c2 = circleStroke(size, 38.5 * scale, 26 * scale, 8.4 * scale, stroke);
  const c3 = circleStroke(size, 32 * scale, 36.5 * scale, 8.4 * scale, stroke);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let rgba = CLEAR;
      if (bg[i]) rgba = BRAND;
      if (c1[i] || c2[i] || c3[i]) rgba = WHITE;
      raw[o++] = rgba[0];
      raw[o++] = rgba[1];
      raw[o++] = rgba[2];
      raw[o++] = rgba[3];
    }
  }

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  for (const png of pngBuffers) {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry[0] = w >= 256 ? 0 : w;
    entry[1] = h >= 256 ? 0 : h;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

const ico = buildIco([16, 32, 48].map(renderPng));
fs.writeFileSync(outPath, ico);
console.log("Wrote", outPath, "bytes", ico.length);
