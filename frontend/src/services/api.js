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

export const DataFlowAPI = {
  // Flows
  listFlows: async () => {
    const res = await api.get('/flows');
    return res.data;
  },

  createFlow: async (req) => {
    const res = await api.post('/flows', req);
    return res.data;
  },

  getFlow: async (id) => {
    const res = await api.get(`/flows/${id}`);
    return res.data;
  },

  deleteFlow: async (id) => {
    const res = await api.delete(`/flows/${id}`);
    return res.data;
  },

  // Sources & Saved Connections
  getSavedConnections: async (sourceType = null) => {
    const url = sourceType ? `/sources/connections?source_type=${sourceType}` : '/sources/connections';
    const res = await api.get(url);
    return res.data;
  },

  saveConnection: async (connDict) => {
    const res = await api.post('/sources/connections', connDict);
    return res.data;
  },

  deleteSavedConnection: async (connId) => {
    const res = await api.delete(`/sources/connections/${connId}`);
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
    const res = await api.get('/schema/spark-types');
    return res.data;
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
    return res.data;
  },

  listStagedDatasets: async (flowId = null) => {
    const url = flowId ? `/staging/datasets?flow_id=${flowId}` : '/staging/datasets';
    const res = await api.get(url);
    return res.data;
  },

  getStagedDataset: async (id) => {
    const res = await api.get(`/staging/datasets/${id}`);
    return res.data;
  },

  getDatasetPreview: async (id, page = 1, pageSize = 50, search) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (search) params.append('search', search);
    const res = await api.get(`/staging/datasets/${id}/preview?${params.toString()}`);
    return res.data;
  },

  deleteStagedDataset: async (id) => {
    const res = await api.delete(`/staging/datasets/${id}`);
    return res.data;
  },

  // Transformations
  previewTransformation: async (req) => {
    const res = await api.post('/transform/preview', req);
    return res.data;
  },

  executePipeline: async (req) => {
    const res = await api.post('/transform/execute', req);
    return res.data;
  },

  testDestination: async (destReq) => {
    const res = await api.post('/transform/test-destination', destReq);
    return res.data;
  },

  // Jobs
  listJobs: async (flowId = null) => {
    const url = flowId ? `/jobs?flow_id=${flowId}` : '/jobs';
    const res = await api.get(url);
    return res.data;
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
    const res = await api.get('/history/summary');
    return res.data;
  },

  getAuditLogs: async (limit = 100) => {
    const res = await api.get(`/history/audit-logs?limit=${limit}`);
    return res.data;
  },

  getIngestionHistory: async (limit = 50) => {
    const res = await api.get(`/history/ingestions?limit=${limit}`);
    return res.data;
  },

  getTransformationHistory: async (limit = 50) => {
    const res = await api.get(`/history/transformations?limit=${limit}`);
    return res.data;
  },

  clearAllHistory: async () => {
    const res = await api.post('/history/clear');
    return res.data;
  },

  getMetadataCredentials: async () => {
    const res = await api.get('/history/credentials');
    return res.data;
  },

  updateMetadataCredentials: async (creds) => {
    const res = await api.post('/history/credentials', creds);
    return res.data;
  },
};
