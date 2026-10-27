import { demoConfigurationIssues } from '../src/config/startup.js';

// Hosting injects configuration. Do not open private files or print their contents.
const issues = demoConfigurationIssues();
if (issues.length) {
  console.error('FAIL: demo configuration is incomplete. Set these on the backend process:');
  for (const issue of issues) console.error(`- ${issue}`);
  console.error('Redeploy/restart after setting configuration. No credential values were printed.');
  process.exitCode = 1;
} else {
  console.log('PASS: required demo variable names are present and origin/account formats passed.');
  console.log('This does not verify credentials, bucket permissions, model access or Atlas indexes.');
  console.log('Next: node scripts/checkStorage.mjs');
  console.log('Then: node scripts/checkAiAccess.mjs');
  console.log('Then: node scripts/searchIndexes.mjs');
  console.log('Finally: complete the hosted note/image/PDF, search, Ask and account-isolation checks in docs/demo-readiness.md.');
}
