// public/icon.svg を元に PWA 用の各サイズ PNG アイコンを生成する一度きりのスクリプト。
// 実行: npm run generate-icons
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const THEME = "#ea580c"; // primary-600 (orange)

const svg = await readFile(join(publicDir, "icon.svg"));

// 通常アイコン（角丸＋透明コーナーをそのまま使う purpose: any 用）
const square = [
  { size: 192, file: "pwa-192x192.png" },
  { size: 512, file: "pwa-512x512.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

for (const { size, file } of square) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));
  console.log(`generated ${file} (${size}x${size})`);
}

// maskable アイコン: 全面塗りの青背景に、内側80%へ縮小したアイコンを合成してセーフゾーンを確保
const MASK_SIZE = 512;
const INNER = Math.round(MASK_SIZE * 0.8); // 410px
const inner = await sharp(svg, { density: 384 }).resize(INNER, INNER).png().toBuffer();
const maskable = await sharp({
  create: {
    width: MASK_SIZE,
    height: MASK_SIZE,
    channels: 4,
    background: THEME,
  },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toBuffer();
await writeFile(join(publicDir, "maskable-512x512.png"), maskable);
console.log("generated maskable-512x512.png (512x512)");

console.log("done.");
