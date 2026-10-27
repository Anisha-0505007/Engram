export function requireStartupConfig(env = process.env) {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter(key => !env[key]?.trim());
  if (missing.length) {
    const error = new Error('Missing server configuration');
    error.code = 'MISSING_CONFIG';
    error.missingKeys = missing;
    throw error;
  }
}

export function demoConfigurationIssues(env = process.env) {
  // Report names and fixed advice only. Values can include credentials or private URLs.
  const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN', 'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
  const issues = required.filter(key => !env[key]?.trim()).map(key => `${key} is missing`);
  for (const key of ['CLIENT_ORIGIN', 'SUPABASE_URL']) {
    if (!env[key]?.trim()) continue;
    try {
      const url = new URL(env[key]);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
          (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'http:'))) {
        throw new Error('invalid origin');
      }
    } catch { issues.push(`${key} must be a valid origin URL without credentials, a path or a query`); }
  }
  if (env.CLOUDFLARE_ACCOUNT_ID?.trim() && !/^[a-f\d]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)) {
    issues.push('CLOUDFLARE_ACCOUNT_ID must contain 32 hexadecimal characters');
  }
  return issues;
}

export function startupFailureMessage(error, stage) {
  // Never print raw driver errors: they can include a URI, username or hostname.
  if (error.code === 'MISSING_CONFIG') return `Missing required environment variables: ${error.missingKeys.join(', ')}. Add them to the hosting project's environment settings and redeploy.`;
  if ([18, 8000].includes(error.code) || /authentication failed|bad auth/i.test(error.message || '')) {
    return 'Atlas authentication failed. Check the Atlas database user/password in MONGODB_URI and URL-encode special characters in the password.';
  }
  if (error.code === 13) return 'Atlas permissions denied. The database user needs read/write and index-creation access for the application database.';
  if (error.code === 11000) return 'Index initialization found duplicate data. Inspect duplicate keys before creating unique indexes; no records were removed.';
  if ([85, 86].includes(error.code)) return 'An existing MongoDB index conflicts with a model index. Compare index definitions before making changes; no indexes were removed.';
  if (/parse|invalid.*(uri|scheme)|connection string/i.test(`${error.name} ${error.message || ''}`)) {
    return 'MONGODB_URI is not a valid MongoDB connection string. Check its format in the hosting environment settings; do not include surrounding quotes.';
  }
  if (stage === 'database connection') {
    return 'Atlas connection failed. Check Network Access for this Render service’s outbound IP ranges, cluster availability, DNS and database credentials.';
  }
  if (stage === 'index initialization') return 'MongoDB index initialization failed. Check database permissions and existing unique/index definitions.';
  return `Startup failed during ${stage}. Credential and connection details are hidden.`;
}
