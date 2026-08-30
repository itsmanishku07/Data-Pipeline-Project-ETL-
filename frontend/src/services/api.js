import axios from 'axios';

// Dynamically resolve Backend API Base URL from VITE_API_BASE_URL env variable
const resolveApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) {
    return '/api';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  // If the user configured root URL (e.g. https://my-backend.vercel.app), append /api
  if (!clean.endsWith('/api')) {
    return `${clean}/api`;
  }
  return clean;
};

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Client-side In-Memory SWR Cache for Instant UI Navigation (0ms Latency)
const memoryCache = new Map();
const CACHE_TTL_MS = 25000; // 25s TTL

const cachedGet = async (key, fetcher) => {
  const now = Date.now();
  const cached = memoryCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetcher();
  memoryCache.set(key, { data, timestamp: now });
  return data;
};

export const invalidateDataFlowCache = (prefix = null) => {
  if (!prefix) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
};

export const DataFlowAPI = {
  // Flows
  listFlows: async () => {
    return cachedGet('flows_list', async () => {
      const res = await api.get('/flows');
      return res.data;
    });
  },

  createFlow: async (req) => {
    const res = await api.post('/flows', req);
    invalidateDataFlowCache('flows');
    return res.data;
  },

  getFlow: async (id) => {
    return cachedGet(`flow_${id}`, async () => {
      const res = await api.get(`/flows/${id}`);
      return res.data;
    });
  },

  deleteFlow: async (id) => {
    const res = await api.delete(`/flows/${id}`);
    invalidateDataFlowCache('flows');
    return res.data;
  },

  getFlowRules: async (flowId) => {
    return cachedGet(`flow_rules_${flowId}`, async () => {
      const res = await api.get(`/flows/${flowId}/rules`);
      return res.data;
    });
  },

  saveFlowRules: async (flowId, rules) => {
    const res = await api.put(`/flows/${flowId}/rules`, { rules });
    invalidateDataFlowCache(`flow_${flowId}`);
    invalidateDataFlowCache(`flow_rules_${flowId}`);
    invalidateDataFlowCache('flows_list');
    return res.data;
  },

  // Sources & Saved Connections
  getSavedConnections: async (sourceType = null) => {
    const cacheKey = `conn_${sourceType || 'all'}`;
    return cachedGet(cacheKey, async () => {
      const url = sourceType ? `/sources/connections?source_type=${sourceType}` : '/sources/connections';
      const res = await api.get(url);
      return res.data;
    });
  },

  listSavedConnections: async (sourceType = null) => {
    const cacheKey = `conn_${sourceType || 'all'}`;
    return cachedGet(cacheKey, async () => {
      const url = sourceType ? `/sources/connections?source_type=${sourceType}` : '/sources/connections';
      const res = await api.get(url);
      return res.data;
    });
  },

  saveConnection: async (connDict) => {
    const res = await api.post('/sources/connections', connDict);
    invalidateDataFlowCache('conn');
    return res.data;
  },

  deleteSavedConnection: async (connId) => {
    const res = await api.delete(`/sources/connections/${connId}`);
    invalidateDataFlowCache('conn');
    return res.data;
  },

  testConnection: async (req) => {
    const res = await api.post('/sources/test', req);
    return res.data;
  },

  listDatabaseTables: async (req) => {
    const res = await api.post('/sources/db/tables', req);
    return res.data;
  },

  browseAzureContainer: async (payload) => {
    const res = await api.post('/sources/azure/browse', payload);
    return res.data;
  },

  inspectSource: async (req, limit = 100) => {
    const res = await api.post(`/sources/inspect?limit=${limit}`, req);
    return res.data;
  },

  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/sources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Schema & Types
  getSparkTypes: async () => {
    return cachedGet('spark_types', async () => {
      const res = await api.get('/schema/spark-types');
      return res.data;
    });
  },

  validateCast: async (sourceRequest, castRules) => {
    const res = await api.post('/schema/validate-cast', {
      source_request: sourceRequest,
      cast_rules: castRules,
    });
    return res.data;
  },

  // Staging
  stageDataset: async (req) => {
    const res = await api.post('/staging/stage', req);
    invalidateDataFlowCache('staging');
    invalidateDataFlowCache('history');
    return res.data;
  },

  listStagedDatasets: async (flowId = null) => {
    const cacheKey = `staging_list_${flowId || 'all'}`;
    return cachedGet(cacheKey, async () => {
      const url = flowId ? `/staging/datasets?flow_id=${flowId}` : '/staging/datasets';
      const res = await api.get(url);
      return res.data;
    });
  },

  getStagedDataset: async (id) => {
    return cachedGet(`staging_item_${id}`, async () => {
      const res = await api.get(`/staging/datasets/${id}`);
      return res.data;
    });
  },

  getDatasetPreview: async (id, page = 1, pageSize = 50, search) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (search) params.append('search', search);
    const cacheKey = `preview_${id}_p${page}_s${pageSize}_q${search || ''}`;
    return cachedGet(cacheKey, async () => {
      const res = await api.get(`/staging/datasets/${id}/preview?${params.toString()}`);
      return res.data;
    });
  },

  deleteStagedDataset: async (id) => {
    const res = await api.delete(`/staging/datasets/${id}`);
    invalidateDataFlowCache('staging');
    invalidateDataFlowCache('preview');
    invalidateDataFlowCache('history');
    return res.data;
  },

  // Transformations
  previewTransformation: async (req) => {
    const res = await api.post('/transform/preview', req);
    return res.data;
  },

  previewTransform: async (stagingDatasetIdOrReq, rules = [], limit = 50) => {
    if (typeof stagingDatasetIdOrReq === 'object' && stagingDatasetIdOrReq !== null) {
      const res = await api.post('/transform/preview', stagingDatasetIdOrReq);
      return res.data;
    }
    const res = await api.post('/transform/preview', {
      staging_dataset_id: stagingDatasetIdOrReq,
      rules: rules,
      limit: limit,
    });
    return res.data;
  },

  executePipeline: async (req) => {
    const res = await api.post('/transform/execute', req);
    invalidateDataFlowCache('staging');
    invalidateDataFlowCache('jobs');
    invalidateDataFlowCache('history');
    return res.data;
  },

  testDestination: async (destReq) => {
    const res = await api.post('/transform/test-destination', destReq);
    return res.data;
  },

  // Jobs
  listJobs: async (flowId = null) => {
    const cacheKey = `jobs_list_${flowId || 'all'}`;
    return cachedGet(cacheKey, async () => {
      const url = flowId ? `/jobs?flow_id=${flowId}` : '/jobs';
      const res = await api.get(url);
      return res.data;
    });
  },

  getJobStatus: async (jobId) => {
    const res = await api.get(`/jobs/${jobId}`);
    return res.data;
  },

  getExportDownloadUrl: (filename) => {
    return `${API_BASE_URL}/jobs/download/${filename}`;
  },

  // Metadata & History
  getMetadataSummary: async () => {
    return cachedGet('history_summary', async () => {
      const res = await api.get('/history/summary');
      return res.data;
    });
  },

  getAuditLogs: async (limit = 100) => {
    return cachedGet(`audit_logs_${limit}`, async () => {
      const res = await api.get(`/history/audit-logs?limit=${limit}`);
      return res.data;
    });
  },

  getIngestionHistory: async (limit = 50) => {
    return cachedGet(`ingest_history_${limit}`, async () => {
      const res = await api.get(`/history/ingestions?limit=${limit}`);
      return res.data;
    });
  },

  getTransformationHistory: async (limit = 50) => {
    return cachedGet(`transform_history_${limit}`, async () => {
      const res = await api.get(`/history/transformations?limit=${limit}`);
      return res.data;
    });
  },

  clearAllHistory: async () => {
    const res = await api.post('/history/clear');
    invalidateDataFlowCache(); // Clear everything
    return res.data;
  },

  getMetadataCredentials: async () => {
    return cachedGet('creds_meta', async () => {
      const res = await api.get('/history/credentials');
      return res.data;
    });
  },

  updateMetadataCredentials: async (creds) => {
    const res = await api.post('/history/credentials', creds);
    invalidateDataFlowCache();
    return res.data;
  },

  // Cron Schedules & Automated Triggers
  listSchedules: async (flowId = null) => {
    const url = flowId && flowId !== 'all' ? `/schedules?flow_id=${encodeURIComponent(flowId)}` : '/schedules';
    const res = await api.get(url);
    return res.data;
  },

  getSchedule: async (scheduleId) => {
    const res = await api.get(`/schedules/${scheduleId}`);
    return res.data;
  },

  previewCron: async (cron) => {
    const res = await api.get(`/schedules/preview-cron?cron=${encodeURIComponent(cron)}`);
    return res.data;
  },

  createSchedule: async (payload) => {
    const res = await api.post('/schedules', payload);
    invalidateDataFlowCache('sched');
    return res.data;
  },

  updateSchedule: async (scheduleId, payload) => {
    const res = await api.put(`/schedules/${scheduleId}`, payload);
    invalidateDataFlowCache('sched');
    return res.data;
  },

  toggleSchedule: async (scheduleId) => {
    const res = await api.post(`/schedules/${scheduleId}/toggle`);
    invalidateDataFlowCache('sched');
    return res.data;
  },

  runScheduleNow: async (scheduleId) => {
    const res = await api.post(`/schedules/${scheduleId}/run-now`);
    invalidateDataFlowCache('jobs');
    return res.data;
  },

  deleteSchedule: async (scheduleId) => {
    const res = await api.delete(`/schedules/${scheduleId}`);
    invalidateDataFlowCache('sched');
    return res.data;
  },
};

/**
 * Safely parse any API error (FastAPI 422 list, object, string, or network exception)
 * into a safe, human-readable string to guarantee React never throws 'Objects are not valid as React child'.
 */
export const extractErrorMessage = (err, fallback = 'An unexpected error occurred') => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d;
        const loc = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body').join('.') : '';
        const msg = d.msg || d.message || JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  if (err.message && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
};
