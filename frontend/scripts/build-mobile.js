/**
 * Capacitor build helper.
 *
 * Next.js `output: 'export'` cannot coexist with API routes.
 * This script temporarily hides app/api/, runs the static export build,
 * then restores the directory.
 *
 * Usage: node scripts/build-mobile.js
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const apiDir = path.resolve(__dirname, '..', 'src', 'app', 'api');
const bakDir = path.resolve(__dirname, '..', 'src', 'app', '_api_bak');
let didRename = false;

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, bakDir);
    didRename = true;
    console.log('[build-mobile] Temporarily hid src/app/api/');
  }

  execSync('npx next build', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, CAPACITOR_BUILD: 'true' },
  });
} finally {
  if (didRename && fs.existsSync(bakDir)) {
    fs.renameSync(bakDir, apiDir);
    console.log('[build-mobile] Restored src/app/api/');
  }
}
