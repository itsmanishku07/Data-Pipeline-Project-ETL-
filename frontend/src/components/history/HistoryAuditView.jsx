import React, { useState, useEffect } from 'react';
import { 
  History, 
  Database, 
  Layers, 
  Sliders, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Code, 
  ChevronRight, 
  Server,
  Trash2,
  Key,
  Save
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';

export const HistoryAuditView = () => {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit', 'ingestion', 'transform', 'credentials', 'schema'
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ingestionLogs, setIngestionLogs] = useState([]);
  const [transformLogs, setTransformLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // Metadata Credentials Form State
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPort, setDbPort] = useState(3306);
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbDatabase, setDbDatabase] = useState('dataflow_metadata');
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsStatus, setCredsStatus] = useState(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [sumRes, audRes, ingRes, txRes, credRes] = await Promise.all([
        DataFlowAPI.getMetadataSummary(),
        DataFlowAPI.getAuditLogs(100),
        DataFlowAPI.getIngestionHistory(50),
        DataFlowAPI.getTransformationHistory(50),
        DataFlowAPI.getMetadataCredentials().catch(() => null),
      ]);
      setSummary(sumRes);
      setAuditLogs(audRes);
      setIngestionLogs(ingRes);
      setTransformLogs(txRes);
      if (credRes) {
        setDbHost(credRes.host || 'localhost');
        setDbPort(credRes.port || 3306);
        setDbUser(credRes.user || 'root');
        setDbDatabase(credRes.database || 'dataflow_metadata');
      }
    } catch (err) {
      console.error('Failed to load history data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setSavingCreds(true);
    setCredsStatus(null);
    try {
      const res = await DataFlowAPI.updateMetadataCredentials({
        host: dbHost.trim(),
        port: Number(dbPort),
        user: dbUser.trim(),
        password: dbPassword,
        database: dbDatabase.trim(),
      });
      setCredsStatus(res);
      fetchAllData();
    } catch (err) {
      setCredsStatus({
        success: false,
        message: err?.response?.data?.detail || err.message || 'Failed to update MySQL metadata credentials',
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all metadata, staged datasets, jobs, and audit logs? This will reset the workspace to a completely blank slate.')) {
      return;
    }
    setLoading(true);
    try {
      await DataFlowAPI.clearAllHistory();
      fetchAllData();
    } catch (err) {
      console.error('Failed to clear history', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.event_type.toLowerCase().includes(term) ||
      log.summary.toLowerCase().includes(term) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Metadata Engine Summary Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <History className="w-4 h-4 text-zinc-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Application History & Metadata Catalog
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Database: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{summary?.mysql_database || dbDatabase}</span> • Engine: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{summary?.metadata_storage_engine || 'MySQL & SQLite'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleClearAllHistory}
              disabled={loading}
              className="flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900/40 bg-red-50/50 hover:bg-red-100/50 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-400 flex items-center space-x-1.5 transition-colors"
              title="Clear all staged datasets, jobs, and audit logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>

            <button
              type="button"
              onClick={fetchAllData}
              disabled={loading}
              className="flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5">
            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-medium text-zinc-400 uppercase">Audit Events</span>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {summary.audit_logs_count}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-medium text-zinc-400 uppercase">Staged Sets</span>
              <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {summary.staged_datasets_count}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-medium text-zinc-400 uppercase">Ingestions</span>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {summary.ingestion_events_count}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-medium text-zinc-400 uppercase">Pipelines Run</span>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                {summary.pipeline_jobs_count}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-md border border-zinc-200 dark:border-zinc-700/60 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ingestion')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'ingestion'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Ingestions ({ingestionLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transform')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'transform'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Transformations ({transformLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'credentials'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            MySQL Database Store
          </button>
        </div>

        {activeTab === 'audit' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-52 font-sans"
            />
          </div>
        )}
      </div>

      {/* 1. Audit Trail View */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs space-y-2 transition-colors">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2">
              Chronological Audit Trail
            </h4>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredAuditLogs.length === 0 ? (
                <p className="text-xs text-zinc-400 py-10 text-center font-mono">No audit events recorded yet.</p>
              ) : (
                filteredAuditLogs.map((log) => {
                  const isSel = selectedLog?.id === log.id;
                  let badgeColor = 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
                  if (log.event_type.includes('INGEST') || log.event_type.includes('SOURCE')) {
                    badgeColor = 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';
                  } else if (log.event_type.includes('STAGED')) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40';
                  } else if (log.event_type.includes('TRANSFORM')) {
                    badgeColor = 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';
                  } else if (log.event_type.includes('ERROR') || log.event_type.includes('FAILED')) {
                    badgeColor = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40';
                  }

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-2.5 rounded-md border cursor-pointer transition-colors flex items-center justify-between ${
                        isSel
                          ? 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 shadow-xs'
                          : 'bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border uppercase ${badgeColor}`}>
                            {log.event_type}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200 mt-1 truncate">
                          {log.summary}
                        </p>
                      </div>

                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Event Details Inspector */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-3 transition-colors">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Event Details Inspector
            </h4>

            {selectedLog ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Event ID:</span>
                    <span className="text-zinc-900 dark:text-white font-medium">{selectedLog.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Type:</span>
                    <span className="text-zinc-900 dark:text-white font-medium">{selectedLog.event_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Entity ID:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{selectedLog.entity_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Timestamp:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">{new Date(selectedLog.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Summary:</span>
                  <p className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {selectedLog.summary}
                  </p>
                </div>

                {selectedLog.details && (
                  <div>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">JSON Metadata:</span>
                    <pre className="p-3 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-200 font-mono text-xs max-h-44 overflow-y-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-10 text-center text-zinc-400 text-xs">
                Select an audit record on the left to inspect its parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MySQL Metadata Credentials Config View */}
      {activeTab === 'credentials' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-4 transition-colors max-w-2xl">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-zinc-500" />
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              MySQL Metadata Store Connection Credentials
            </h4>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Configure your MySQL server credentials to persist all pipeline lineage, staged dataset catalogs, and audit logs.
          </p>

          <form onSubmit={handleSaveCredentials} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">MySQL Host *</label>
                <input
                  type="text"
                  required
                  placeholder="localhost or 127.0.0.1"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Port *</label>
                <input
                  type="number"
                  required
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Database Name *</label>
                <input
                  type="text"
                  required
                  placeholder="dataflow_metadata"
                  value={dbDatabase}
                  onChange={(e) => setDbDatabase(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="root"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
              <input
                type="password"
                placeholder="Enter MySQL Password"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {credsStatus && (
              <div className={`p-3 rounded-md border text-xs font-mono flex items-start space-x-2 ${
                credsStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
              }`}>
                {credsStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{credsStatus.success ? 'MySQL Connected' : 'MySQL Notice'}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{credsStatus.message}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingCreds}
                className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingCreds ? 'Saving & Testing...' : 'Save & Connect MySQL Metadata'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Ingestion Events Table */}
      {activeTab === 'ingestion' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Ingest ID</th>
                  <th className="py-2.5 px-3">Source Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Rows</th>
                  <th className="py-2.5 px-3">Cols</th>
                  <th className="py-2.5 px-3">Duration (ms)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/40">
                {ingestionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 font-sans">
                      No ingestion history recorded yet.
                    </td>
                  </tr>
                ) : (
                  ingestionLogs.map((ing) => (
                    <tr key={ing.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="py-2 px-3 text-zinc-500">{ing.id}</td>
                      <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100 font-sans">{ing.source_name}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] uppercase">
                          {ing.source_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100 font-medium">{ing.row_count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{ing.column_count}</td>
                      <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{Math.round(ing.duration_ms)} ms</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium uppercase ${
                          ing.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        }`}>
                          {ing.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500">{new Date(ing.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Transformation History */}
      {activeTab === 'transform' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Execution ID</th>
                  <th className="py-2.5 px-3">Target Staged Set</th>
                  <th className="py-2.5 px-3">Rules Count</th>
                  <th className="py-2.5 px-3">Initial Rows</th>
                  <th className="py-2.5 px-3">Output Rows</th>
                  <th className="py-2.5 px-3">Exec Time</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/40">
                {transformLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                      No transformation history recorded yet.
                    </td>
                  </tr>
                ) : (
                  transformLogs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="py-2 px-3 text-zinc-500">{tx.id}</td>
                      <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100 font-sans">{tx.staging_dataset_id}</td>
                      <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 font-medium">{tx.rule_count} steps</td>
                      <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">{tx.initial_rows.toLocaleString()}</td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-medium">{tx.transformed_rows.toLocaleString()}</td>
                      <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">{Math.round(tx.execution_time_ms)} ms</td>
                      <td className="py-2 px-3 text-zinc-500">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
