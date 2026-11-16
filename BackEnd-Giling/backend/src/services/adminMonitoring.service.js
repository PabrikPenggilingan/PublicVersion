/**
 * Admin Monitoring Service
 *
 * Provides three monitoring domains:
 *   1. Database Stats   — PostgreSQL table sizes, row counts, growth trends (internal, no extra deps)
 *   2. Supabase Storage — Bucket usage via storage.objects SQL query (requires service_role key)
 *   3. GCP Computing    — Cloud Run CPU/Memory/Requests/Latency (requires @google-cloud/monitoring)
 *
 * Each domain fails gracefully — if a service key is missing or an API call fails,
 * the domain returns { available: false, reason: '...' } instead of crashing the whole overview.
 *
 * Caching: all results are cached via adminMonitoring.cache.js to avoid hitting
 * external APIs on every request.
 */

const adminMonitoringModel = require('../models/adminMonitoring.model');
const cache = require('./adminMonitoring.cache');
const config = require('../config/env');

// ─── Cache TTL constants (seconds) ───────────────────────────────────────────
const TTL = {
  OVERVIEW:  120,  // 2 minutes
  USERS:     300,  // 5 minutes
  DATABASE:  300,  // 5 minutes
  STORAGE:   600,  // 10 minutes
  COMPUTING: 120,  // 2 minutes
};

// ─── Supabase Admin Client (lazy init) ───────────────────────────────────────
let _supabaseAdminClient = null;

function getSupabaseAdminClient() {
  if (_supabaseAdminClient) return _supabaseAdminClient;

  const { url, serviceRoleKey } = config.supabaseAdmin;
  if (!url || !serviceRoleKey) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    _supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return _supabaseAdminClient;
  } catch (err) {
    console.error('[AdminMonitoring] Failed to init Supabase admin client:', err.message);
    return null;
  }
}

// ─── GCP Monitoring Client (lazy init) ───────────────────────────────────────
let _gcpMonitoringClient = null;

function getGcpMonitoringClient() {
  if (_gcpMonitoringClient) return _gcpMonitoringClient;

  try {
    const { MetricServiceClient } = require('@google-cloud/monitoring');

    const clientOptions = {};

    // In Cloud Run (production): Workload Identity handles auth automatically.
    // For local dev: pass GCP_SERVICE_ACCOUNT_KEY as a JSON string in .env.
    if (config.gcp.serviceAccountKey) {
      try {
        const keyJson = JSON.parse(config.gcp.serviceAccountKey);
        clientOptions.credentials = keyJson;
      } catch {
        console.warn('[AdminMonitoring] GCP_SERVICE_ACCOUNT_KEY is not valid JSON, ignoring.');
      }
    }

    _gcpMonitoringClient = new MetricServiceClient(clientOptions);
    return _gcpMonitoringClient;
  } catch (err) {
    // @google-cloud/monitoring not installed or other init error
    console.warn('[AdminMonitoring] GCP Monitoring client unavailable:', err.message);
    return null;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetch a single GCP Cloud Run metric time series.
 * @param {object} client   MetricServiceClient instance
 * @param {string} metricType  e.g. 'run.googleapis.com/request_count'
 * @param {string} aligner     e.g. 'ALIGN_SUM', 'ALIGN_MEAN', 'ALIGN_PERCENTILE_99'
 * @param {number} windowMinutes  look-back window in minutes
 * @returns {Array} array of { timestamp, value } objects
 */
async function fetchGcpMetric(client, metricType, aligner, windowMinutes = 60, targetServiceName = null) {
  const projectId = config.gcp.projectId;
  const serviceName = targetServiceName || config.gcp.cloudRunService;

  if (!projectId) return [];

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - windowMinutes * 60;

  try {
    const [timeSeries] = await client.listTimeSeries({
      name: `projects/${projectId}`,
      filter:
        `metric.type="${metricType}" ` +
        `AND resource.labels.service_name="${serviceName}"`,
      interval: {
        startTime: { seconds: startTime },
        endTime:   { seconds: endTime },
      },
      aggregation: {
        alignmentPeriod: { seconds: 60 },
        perSeriesAligner: aligner,
      },
    });

    if (!timeSeries || timeSeries.length === 0) return [];

    // Flatten all time series points into a simple array
    const points = [];
    for (const series of timeSeries) {
      for (const point of series.points || []) {
        const ts = point.interval?.endTime?.seconds;
        const val =
          point.value?.doubleValue ??
          point.value?.int64Value ??
          point.value?.distributionValue?.mean ??
          null;

        if (ts !== undefined && val !== null) {
          points.push({ timestamp: Number(ts) * 1000, value: Number(val) });
        }
      }
    }

    return points.sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) {
    throw err;
  }
}

// ─── Service Methods ──────────────────────────────────────────────────────────

const adminMonitoringService = {

  // ────────────────────────────────────────────────────────── Per-User Stats ──

  async getUserStats() {
    return cache.getOrFetch('admin:users', TTL.USERS, async () => {
      const rows = await adminMonitoringModel.getAllUserStats();
      return rows.map(u => ({
        ...u,
        total_file_size_mb: u.total_file_size_bytes
          ? (Number(u.total_file_size_bytes) / 1048576).toFixed(2)
          : '0.00',
      }));
    });
  },

  async getUserDetail(userId) {
    return cache.getOrFetch(`admin:user:${userId}`, TTL.USERS, async () => {
      const { user, weeklyTrend } = await adminMonitoringModel.getUserDetail(userId);
      if (!user) return null;
      return {
        ...user,
        total_file_size_mb: user.total_file_size_bytes
          ? (Number(user.total_file_size_bytes) / 1048576).toFixed(2)
          : '0.00',
        weeklyTrend,
      };
    });
  },

  // ─────────────────────────────────────────────────────── Database Stats ─────

  async getDatabaseStats() {
    return cache.getOrFetch('admin:database', TTL.DATABASE, async () => {
      const [overview, tableSizes, rowCounts, growthTrend] = await Promise.all([
        adminMonitoringModel.getDatabaseOverview(),
        adminMonitoringModel.getDatabaseTableSizes(),
        adminMonitoringModel.getKeyTableRowCounts(),
        adminMonitoringModel.getDataGrowthTrend(),
      ]);

      return {
        available: true,
        overview,
        tableSizes,
        rowCounts,
        growthTrend,
      };
    });
  },

  // ──────────────────────────────────────────────── Supabase Storage Stats ────

  async getStorageStats() {
    return cache.getOrFetch('admin:storage', TTL.STORAGE, async () => {
      const supabase = getSupabaseAdminClient();
      const configuredBucket = config.supabaseAdmin.bucketName || 'gabah-files';

      // ── Fallback: use trx.files metadata if Supabase admin not configured ──
      if (!supabase) {
        const dbStats = await adminMonitoringModel.getStorageStatsFromDb();
        return {
          available: true,
          source: 'database_metadata',
          note: 'SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terkonfigurasi. Menampilkan estimasi dari database (trx.files).',
          ...dbStats,
        };
      }

      // ── Primary: use Supabase Storage JS API (service_role) ──
      try {
        // 1. Verify connection & discover existing buckets
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          throw new Error(`listBuckets failed: ${bucketError.message}`);
        }

        let targetBucket = configuredBucket;
        const bucketNames = (buckets || []).map(b => b.name || b.id);
        if (!bucketNames.includes(configuredBucket)) {
          if (bucketNames.length > 0) {
            targetBucket = bucketNames[0];
            console.warn(`[AdminMonitoring] Bucket '${configuredBucket}' tidak ditemukan, menggunakan '${targetBucket}'`);
          } else {
            // Auto-create configured bucket in Supabase via Admin API
            try {
              console.log(`[AdminMonitoring] Mencoba membuat bucket '${configuredBucket}' di Supabase Storage...`);
              const { data: createdBucket, error: createError } = await supabase.storage.createBucket(configuredBucket, {
                public: false,
                fileSizeLimit: 26214400, // 25MB limit
              });
              if (createError) throw createError;
              targetBucket = configuredBucket;
              console.log(`[AdminMonitoring] Berhasil membuat bucket '${configuredBucket}' di Supabase Storage.`);
            } catch (createErr) {
              console.warn('[AdminMonitoring] Auto-create bucket gagal:', createErr.message);
              const dbStats = await adminMonitoringModel.getStorageStatsFromDb();
              return {
                available: true,
                source: 'database_metadata',
                note: `Belum ada bucket di Supabase Storage. Buat bucket bernama '${configuredBucket}' di Supabase Dashboard → Storage. (${createErr.message})`,
                ...dbStats,
              };
            }
          }
        }

        // 2. Discover root items & subfolders
        const { data: rootItems, error: rootError } = await supabase.storage
          .from(targetBucket)
          .list('', { limit: 1000, offset: 0 });

        if (rootError) {
          throw new Error(`list root failed: ${rootError.message}`);
        }

        let totalBytes = 0;
        let totalCount = 0;
        const byFolder = {};
        const allFiles = [];

        // Known default folders + any folders detected dynamically from root
        const folderSet = new Set(['struk', 'gabah', 'proses', 'hasil', 'retur']);

        // Process any files directly in root & register subfolders
        (rootItems || []).forEach(item => {
          if (!item.name) return;
          if (item.id === null || !item.metadata || item.metadata.mimetype === undefined) {
            // It's a folder
            folderSet.add(item.name);
          } else {
            // It's a root-level file
            const size = Number(item.metadata?.size || 0);
            totalBytes += size;
            totalCount++;
            if (!byFolder['root']) byFolder['root'] = { folder: 'root', file_count: 0, total_bytes: 0 };
            byFolder['root'].file_count++;
            byFolder['root'].total_bytes += size;
            allFiles.push({ name: item.name, size_bytes: size, created_at: item.created_at });
          }
        });

        // 3. Query all discovered folders concurrently
        const foldersToScan = Array.from(folderSet);
        const folderResults = await Promise.allSettled(
          foldersToScan.map(folder =>
            supabase.storage.from(targetBucket).list(folder, { limit: 1000, offset: 0 })
          )
        );

        foldersToScan.forEach((folder, idx) => {
          const result = folderResults[idx];
          if (result.status !== 'fulfilled' || result.value.error) return;

          const files = result.value.data || [];
          if (!byFolder[folder]) byFolder[folder] = { folder, file_count: 0, total_bytes: 0 };

          files.forEach(file => {
            if (!file.name || file.id === null) return; // skip folder placeholders
            const size = Number(file.metadata?.size || 0);
            totalBytes += size;
            totalCount++;
            byFolder[folder].file_count++;
            byFolder[folder].total_bytes += size;
            allFiles.push({ name: `${folder}/${file.name}`, size_bytes: size, created_at: file.created_at });
          });
        });

        const topFiles = allFiles
          .sort((a, b) => b.size_bytes - a.size_bytes)
          .slice(0, 10);

        // Per-user breakdown and monthly trends from DB metadata
        const dbStats = await adminMonitoringModel.getStorageStatsFromDb();

        return {
          available: true,
          source: 'supabase_storage',
          bucket: targetBucket,
          summary: {
            total_file_count: totalCount,
            total_size_bytes: totalBytes,
            total_size_mb: (totalBytes / 1048576).toFixed(2),
            total_size_gb: (totalBytes / 1073741824).toFixed(3),
          },
          byFolder: Object.values(byFolder)
            .filter(f => f.file_count > 0)
            .sort((a, b) => b.total_bytes - a.total_bytes),
          topFiles,
          byUser: dbStats.byUser,
          monthlyGrowth: dbStats.monthlyGrowth,
        };

      } catch (err) {
        console.error('[AdminMonitoring] Supabase storage query failed:', err.message);
        const dbStats = await adminMonitoringModel.getStorageStatsFromDb();
        return {
          available: true,
          source: 'database_metadata',
          note: `Supabase Storage query gagal (${err.message}). Menampilkan estimasi dari database (trx.files).`,
          ...dbStats,
        };
      }
    });
  },

  // ──────────────────────────────────────────── GCP Cloud Run Computing ────────

  async getComputingMetrics(windowMinutes = 60, requestedService = null) {
    const targetService = requestedService || config.gcp.cloudRunService;
    const cacheKey = `admin:computing:${targetService}:${windowMinutes}`;
    return cache.getOrFetch(cacheKey, TTL.COMPUTING, async () => {
      try {
        if (!config.gcp.projectId) {
          return {
            available: false,
            reason: 'GCP_PROJECT_ID belum dikonfigurasi di file .env.',
          };
        }

        // Check if GCP credentials exist on this machine
        const fs = require('fs');
        const path = require('path');
        const hasServiceAccountKey = !!config.gcp.serviceAccountKey;
        const hasGoogleAppCredsEnv = !!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        const isCloudRun = !!process.env.K_SERVICE; // Standard Cloud Run environment variable

        const adcWindows = process.env.APPDATA ? path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json') : null;
        const adcLinux = process.env.HOME ? path.join(process.env.HOME, '.config', 'gcloud', 'application_default_credentials.json') : null;
        const hasAdc = (adcWindows && fs.existsSync(adcWindows)) || (adcLinux && fs.existsSync(adcLinux));

        if (!hasServiceAccountKey && !hasGoogleAppCredsEnv && !isCloudRun && !hasAdc) {
          return {
            available: false,
            reason: 'GCP credentials belum aktif di komputer lokal. Jalankan "gcloud auth application-default login" di terminal kamu, atau isi GCP_SERVICE_ACCOUNT_KEY di .env.',
          };
        }

        const client = getGcpMonitoringClient();
        if (!client) {
          return {
            available: false,
            reason: '@google-cloud/monitoring tidak dapat diinisialisasi.',
          };
        }

        // Fire all metric fetches concurrently; use allSettled so one failure doesn't block others
        const [requests, cpu, memory, instances, latency] = await Promise.allSettled([
          fetchGcpMetric(client, 'run.googleapis.com/request_count',                   'ALIGN_SUM',            windowMinutes, targetService),
          fetchGcpMetric(client, 'run.googleapis.com/container/cpu/utilizations',      'ALIGN_MEAN',           windowMinutes, targetService),
          fetchGcpMetric(client, 'run.googleapis.com/container/memory/utilizations',   'ALIGN_MEAN',           windowMinutes, targetService),
          fetchGcpMetric(client, 'run.googleapis.com/container/instance_count',        'ALIGN_MEAN',           windowMinutes, targetService),
          fetchGcpMetric(client, 'run.googleapis.com/request_latencies',               'ALIGN_PERCENTILE_99',  windowMinutes, targetService),
        ]);

        // Check if all metric fetches failed (e.g. invalid permissions, service not found)
        const allSettledList = [requests, cpu, memory, instances, latency];
        const allFailed = allSettledList.every(r => r.status === 'rejected');
        if (allFailed) {
          const firstError = requests.reason?.message || cpu.reason?.message || 'GCP API error';
          return {
            available: false,
            reason: `GCP API error: ${firstError}. Pastikan service '${targetService}' ada di project '${config.gcp.projectId}' dan akun memiliki role Monitoring Viewer.`,
          };
        }

        const lastVal = (settled) => {
          if (settled.status !== 'fulfilled') return null;
          const pts = settled.value;
          return pts && pts.length > 0 ? pts[pts.length - 1].value : null;
        };

        const cpuPoints     = cpu.status     === 'fulfilled' && Array.isArray(cpu.value)     ? cpu.value     : [];
        const memPoints     = memory.status  === 'fulfilled' && Array.isArray(memory.value)  ? memory.value  : [];
        const reqPoints     = requests.status === 'fulfilled' && Array.isArray(requests.value) ? requests.value : [];
        const instPoints    = instances.status === 'fulfilled' && Array.isArray(instances.value) ? instances.value : [];
        const latencyPoints = latency.status  === 'fulfilled' && Array.isArray(latency.value)  ? latency.value  : [];

        const availableServices = [config.gcp.cloudRunService, config.gcp.cloudRunServiceStaging].filter(Boolean);

        return {
          available: true,
          service:   targetService,
          availableServices,
          region:    config.gcp.region,
          windowMinutes,
          summary: {
            cpu_percent_latest:    lastVal(cpu)       !== null ? (lastVal(cpu) * 100).toFixed(1) : null,
            memory_percent_latest: lastVal(memory)    !== null ? (lastVal(memory) * 100).toFixed(1) : null,
            request_count_total:   lastVal(requests),
            active_instances:      lastVal(instances),
            p99_latency_ms:        lastVal(latency),
          },
          timeSeries: {
            cpu:       cpuPoints.map(p => ({ ...p, value: (p.value * 100) })),
            memory:    memPoints.map(p => ({ ...p, value: (p.value * 100) })),
            requests:  reqPoints,
            instances: instPoints,
            latency:   latencyPoints,
          },
        };
      } catch (gcpErr) {
        console.error('[AdminMonitoring] GCP metrics fetch failed:', gcpErr.message);
        return {
          available: false,
          reason: `GCP error: ${gcpErr.message}`,
        };
      }
    });
  },

  // ──────────────────────────────────────────────────── Overview (all in one) ──

  async getOverview() {
    return cache.getOrFetch('admin:overview', TTL.OVERVIEW, async () => {
      // Run all domains concurrently; failures per domain are isolated
      const [usersResult, dbResult, storageResult, computingResult] = await Promise.allSettled([
        adminMonitoringModel.getAllUserStats(),
        adminMonitoringModel.getDatabaseOverview(),
        adminMonitoringModel.getStorageStatsFromDb(),
        this.getComputingMetrics(60),
      ]);

      const users    = usersResult.status    === 'fulfilled' ? usersResult.value    : [];
      const db       = dbResult.status       === 'fulfilled' ? dbResult.value       : null;
      const storage  = storageResult.status  === 'fulfilled' ? storageResult.value  : null;
      const computing = computingResult.status === 'fulfilled' ? computingResult.value : null;

      const totalStorageBytes = storage?.byFileType
        ? storage.byFileType.reduce((sum, t) => sum + Number(t.total_bytes || 0), 0)
        : 0;

      return {
        users: {
          total: users.length,
          by_role: users.reduce((acc, u) => {
            acc[u.role] = (acc[u.role] || 0) + 1;
            return acc;
          }, {}),
          total_uploads: users.reduce((sum, u) => sum + Number(u.file_count || 0), 0),
        },
        database: db
          ? { size_pretty: db.db_size_pretty, size_bytes: db.db_size_bytes, active_connections: db.active_connections }
          : null,
        storage: {
          total_size_bytes: totalStorageBytes,
          total_size_mb: (totalStorageBytes / 1048576).toFixed(2),
          source: storage?.source || 'unavailable',
        },
        computing: computing?.available
          ? {
              cpu_percent:    computing.summary?.cpu_percent_latest,
              memory_percent: computing.summary?.memory_percent_latest,
              active_instances: computing.summary?.active_instances,
            }
          : { available: false, reason: computing?.reason },
        generated_at: new Date().toISOString(),
      };
    });
  },
};

module.exports = adminMonitoringService;
