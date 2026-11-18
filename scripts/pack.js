const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.resolve(process.argv[2] || path.join(root, '..', 'vyumi-shop-with-me.zip'));
if (fs.existsSync(target)) throw new Error('Archive already exists. Choose a new output filename.');
const excluded = new Set(['node_modules', '.git', '.agents', '.codex', '.impeccable', 'dist', 'coverage', 'uploads', 'backups', 'test-results', 'playwright-report', 'work', '.superdesign']);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    const relativeDirectory = path.relative(root, filename).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      // Keep source catalogs such as backend/src/data; omit only runtime data stores.
      if (excluded.has(entry.name) || relativeDirectory === 'data' || relativeDirectory === 'backend/data') return [];
      return walk(filename);
    }
    if (entry.name === '.env' || /\.(sqlite|db)(-|$)|\.zip$|\.log$/.test(entry.name)) return [];
    return [path.relative(root, filename)];
  });
}
const files = walk(root);
let result;
if (process.platform === 'win32') {
  const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($env:VYUMI_PACK_TARGET, 'Create')
try {
  $files = $env:VYUMI_PACK_FILES | ConvertFrom-Json
  foreach ($file in $files) {
    $entry = $file.Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $env:VYUMI_PACK_ROOT $file), $entry) | Out-Null
  }
} finally { $zip.Dispose() }`;
  result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio:'inherit', env:{ ...process.env, VYUMI_PACK_ROOT:root, VYUMI_PACK_TARGET:target, VYUMI_PACK_FILES:JSON.stringify(files) } });
} else {
  result = spawnSync('zip', ['-q', target, ...files], { cwd:root, stdio:'inherit' });
}
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Packaged ${files.length} source files: ${target}`);
