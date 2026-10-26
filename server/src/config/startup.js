export function requireStartupConfig(env = process.env) {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter(key => !env[key]?.trim());
  if (missing.length) {
    const error = new Error('Missing server configuration');
    error.code = 'MISSING_CONFIG';
    error.missingKeys = missing;
    throw error;
  }
}

export function startupFailureMessage(error, stage) {
  // Never print raw driver errors: they can include a URI, username or hostname.
  if (error.code === 'MISSING_CONFIG') return `Missing required Render environment variables: ${error.missingKeys.join(', ')}. Add them to the web service and save/deploy.`;
  if ([18, 8000].includes(error.code) || /authentication failed|bad auth/i.test(error.message || '')) {
    return 'Atlas authentication failed. Check the Atlas database user/password in MONGODB_URI and URL-encode special characters in the password.';
  }
  if (error.code === 13) return 'Atlas permissions denied. The database user needs read/write and index-creation access for the application database.';
  if (error.code === 11000) return 'Index initialization found duplicate data. Inspect duplicate keys before creating unique indexes; no records were removed.';
  if ([85, 86].includes(error.code)) return 'An existing MongoDB index conflicts with a model index. Compare index definitions before making changes; no indexes were removed.';
  if (/parse|invalid.*(uri|scheme)|connection string/i.test(`${error.name} ${error.message || ''}`)) {
    return 'MONGODB_URI is not a valid MongoDB connection string. Check its format in Render Environment; do not include surrounding quotes.';
  }
  if (stage === 'database connection') {
    return 'Atlas connection failed. Check Network Access for this Render service’s outbound IP ranges, cluster availability, DNS and database credentials.';
  }
  if (stage === 'index initialization') return 'MongoDB index initialization failed. Check database permissions and existing unique/index definitions.';
  return `Startup failed during ${stage}. Credential and connection details are hidden.`;
}
