// A content script is a classic script: it cannot import. If the bundler split a shared helper out of
// content.js, the script would fail to load on Bilibili and nothing would be read or recorded (T1.2,
// T1.9). This check fails the build instead.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "../dist/content.js"), "utf8");
if (/(^|[;\s])import[\s{*"']/.test(src) || /\bimport\(/.test(src)) {
  console.error("dist/content.js imports another file; a content script must stand alone. Keep what content.ts uses out of any module the panel or the background part also imports.");
  process.exit(1);
}
console.log("content.js stands alone.");
