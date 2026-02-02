import fs from 'node:fs';
import path from 'node:path';

/**
 * Cloudflare Workers Static Assets expects a top-level `index.html` for `/`.
 * Angular's application builder (with SSR/prerender) can emit `index.csr.html`
 * instead. This script makes the output compatible by copying it to `index.html`.
 */

const browserDir = path.join(process.cwd(), 'dist', '3dwebsite', 'browser');
const csrIndex = path.join(browserDir, 'index.csr.html');
const indexHtml = path.join(browserDir, 'index.html');

if (!fs.existsSync(browserDir)) {
  throw new Error(`Expected build output directory not found: ${browserDir}`);
}

if (fs.existsSync(indexHtml)) {
  // Nothing to do.
  process.exit(0);
}

if (!fs.existsSync(csrIndex)) {
  const files = fs.readdirSync(browserDir).slice(0, 50).join(', ');
  throw new Error(
    `Expected ${csrIndex} to exist, but it does not. Found (first 50): ${files}`
  );
}

fs.copyFileSync(csrIndex, indexHtml);
console.log(`Created ${path.relative(process.cwd(), indexHtml)} from index.csr.html`);

