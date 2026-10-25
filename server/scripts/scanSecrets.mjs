import { execFileSync } from 'node:child_process';

// Print only paths/counts, never matching lines or possible credential values.
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const commits = git(['rev-list', '--all']).trim().split('\n').filter(Boolean);
const seen = new Set();
const findings = new Set();
const patterns = [
  /AIza[0-9A-Za-z_-]{35}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /mongodb(?:\+srv)?:\/\/(?!username:|<)[^\s"'<>:]+:[^\s"'<>@]+@/,
  /(?:sk_live_|ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
];
for (const commit of commits) {
  const entries = git(['ls-tree', '-r', commit]).trim().split('\n');
  for (const entry of entries) {
    const match = entry.match(/^\d+ blob ([a-f\d]+)\t(.+)$/);
    if (!match) continue;
    const [, blob, path] = match;
    if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.example')) {
      findings.add(`tracked environment file: ${path}`); continue;
    }
    if (seen.has(blob) || /(?:package-lock\.json|\.(?:png|jpg|pdf|zip|woff2?))$/.test(path)) continue;
    seen.add(blob);
    const content = git(['cat-file', 'blob', blob]);
    if (patterns.some(pattern => pattern.test(content))) findings.add(`credential pattern: ${path}`);
  }
}
console.log(`Scanned ${commits.length} commits and ${seen.size} unique text blobs.`);
if (findings.size) { console.log([...findings].join('\n')); process.exitCode = 1; }
else console.log('No tracked environment files or covered credential patterns found. This pattern scan cannot prove the absence of every secret.');
