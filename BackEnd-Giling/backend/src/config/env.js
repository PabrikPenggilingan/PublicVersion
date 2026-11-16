const path = require('path');

// Try multiple .env locations so it works both locally and inside Docker.
// When running inside Docker, env vars are injected by docker-compose.yml,
// so dotenv just won't find a file and won't override anything — which is fine.
const envLocations = [
  path.join(__dirname, '../../../.env'),  // BackEnd-Giling/.env (dev lokal)
  path.join(__dirname, '../../.env'),     // backend/.env (fallback)
  path.join(process.cwd(), '.env'),       // wherever node is run from
];
for (const envPath of envLocations) {
  const result = require('dotenv').config({ path: envPath });
  if (!result.error) break; // stop at first .env file found
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

if (nodeEnv === 'production' && jwtSecret === 'your-secret-key') {
  console.warn('⚠️ SECURITY WARNING: Using default JWT_SECRET in production mode! Set JWT_SECRET in environment variables.');
}

module.exports = {
  nodeEnv,
  port: process.env.PORT || 3000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  database: {
    url: process.env.DATABASE_URL,
    logUrl: process.env.LOG_DATABASE_URL
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'https://proomdjnrxdptdtbkvgv.supabase.co',
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'gabah-files'
  },
  // Supabase Admin (service_role key) — for storage monitoring only.
  // serviceRoleKey bypasses RLS and can read storage.objects table.
  // Never expose this key to the client side.
  supabaseAdmin: {
    url: process.env.SUPABASE_URL || 'https://proomdjnrxdptdtbkvgv.supabase.co',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'gabah-files',
  },
  // GCP Configuration — for Cloud Run monitoring metrics.
  // In production (Cloud Run), auth is handled by Workload Identity — no key needed.
  // For local dev, set GCP_SERVICE_ACCOUNT_KEY as a JSON string in .env.
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    serviceAccountKey: process.env.GCP_SERVICE_ACCOUNT_KEY || null,
    cloudRunService: process.env.GCP_CLOUD_RUN_SERVICE || 'gabah-api',
    cloudRunServiceStaging: process.env.GCP_CLOUD_RUN_SERVICE_STAGING || 'gabah-api-staging',
    region: process.env.GCP_REGION || 'asia-southeast1',
  },
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  timezone: 'Asia/Jakarta'
};
