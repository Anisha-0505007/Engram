import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Credentials come from the invoking shell, never from a committed file or log.
const base = process.env.EVAL_BASE_URL || 'http://localhost:8000';
const casesPath = process.argv[2];
if (!casesPath || !process.env.EVAL_EMAIL || !process.env.EVAL_PASSWORD) {
  console.error('Set EVAL_EMAIL and EVAL_PASSWORD, then run: node scripts/evaluate.mjs ../docs/eval-cases.json');
  process.exit(1);
}
const cases = JSON.parse(await readFile(resolve(casesPath), 'utf8'));
if (!Array.isArray(cases) || cases.length < 25 || cases.some(c => !c.query || !Array.isArray(c.expectedItemIds) || !c.expectedItemIds.length || c.expectedItemIds.some(id => !/^[a-f\d]{24}$/i.test(id)))) {
  console.error('Provide at least 25 queries with real expectedItemIds from the evaluation account. No placeholder IDs.');
  process.exit(1);
}
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.EVAL_EMAIL, password: process.env.EVAL_PASSWORD }) });
if (!login.ok) throw new Error('Evaluation login failed');
const cookie = login.headers.get('set-cookie')?.split(';')[0];
const rows = [];
const totals = { keyword: 0, vector: 0, hybrid: 0 };
for (const entry of cases) {
  const row = { query: entry.query };
  for (const mode of Object.keys(totals)) {
    const query = new URLSearchParams({ q: entry.query, mode });
    let response = await fetch(`${base}/api/items/search?${query}`, { headers: { Cookie: cookie } });
    // Respect the public search limiter; waiting is explicit in this standalone script.
    if (response.status === 429) {
      const delay = Number(response.headers.get('retry-after'));
      if (!delay) throw new Error('Daily AI quota reached; evaluation is incomplete');
      await new Promise(resolve => setTimeout(resolve, delay * 1000 + 100));
      response = await fetch(`${base}/api/items/search?${query}`, { headers: { Cookie: cookie } });
    }
    if (!response.ok) throw new Error(`Evaluation stopped: HTTP ${response.status}`);
    const result = await response.json();
    if (result.warnings?.length) throw new Error('Search dependency unavailable; refusing to publish incomplete scores');
    const top = result.items.slice(0, 5).map(item => String(item._id));
    row[mode] = entry.expectedItemIds.some(id => top.includes(id));
    totals[mode] += Number(row[mode]);
  }
  rows.push(row);
}
const escape = text => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = rows.map((r, i) => `| ${i + 1} | ${escape(r.query)} | ${r.keyword ? 'hit' : 'miss'} | ${r.vector ? 'hit' : 'miss'} | ${r.hybrid ? 'hit' : 'miss'} |`).join('\n');
const summary = Object.entries(totals).map(([mode, hits]) => `| ${mode} | ${hits}/${cases.length} (${(100 * hits / cases.length).toFixed(1)}%) |`).join('\n');
const report = `# Evaluation results\n\nMeasured ${new Date().toISOString()} against ${new URL(base).origin}.\nMetric: top-5 hit rate (at least one expected item found), not multi-relevant-item recall.\n\n| # | Query | Keyword | Vector | Hybrid |\n|---|---|---|---|---|\n${table}\n\n| Mode | Hit rate@5 |\n|---|---|\n${summary}\n\nThese are measured results for this dataset; RRF has no guarantee of beating both inputs.\n`;
await writeFile(new URL('../../docs/evaluation.md', import.meta.url), report);
console.log(`Wrote measured results for ${cases.length} cases to docs/evaluation.md`);
