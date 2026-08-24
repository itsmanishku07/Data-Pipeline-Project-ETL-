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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Metadata Engine Summary Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Application History & Metadata Store
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Target Database: <strong className="text-sky-600 dark:text-sky-300">{summary?.mysql_database || dbDatabase}</strong> • Engine: <strong className="text-emerald-600 dark:text-emerald-400">{summary?.metadata_storage_engine || 'MySQL & SQLite'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClearAllHistory}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center space-x-1.5 transition-colors"
              title="Clear all staged datasets, jobs, and audit logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All History</span>
            </button>

            <button
              type="button"
              onClick={fetchAllData}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Audit Events</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                {summary.audit_logs_count}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Staged Sets</span>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {summary.staged_datasets_count}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Ingestions</span>
              <p className="text-lg font-extrabold text-sky-600 dark:text-sky-400 font-mono mt-0.5">
                {summary.ingestion_events_count}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Pipelines Run</span>
              <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {summary.pipeline_jobs_count}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ingestion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ingestion'
                ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ingestion Events ({ingestionLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transform')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'transform'
                ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Transformation History ({transformLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'credentials'
                ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            MySQL Credentials
          </button>
        </div>

        {activeTab === 'audit' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 w-52"
            />
          </div>
        )}
      </div>

      {/* 1. Audit Trail View */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-2 transition-colors">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Chronological Audit Trail
            </h4>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredAuditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">No audit events recorded yet. Connect a source to begin.</p>
              ) : (
                filteredAuditLogs.map((log) => {
                  const isSel = selectedLog?.id === log.id;
                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                  if (log.event_type.includes('INGEST') || log.event_type.includes('SOURCE')) {
                    badgeColor = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20';
                  } else if (log.event_type.includes('STAGED')) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
                  } else if (log.event_type.includes('TRANSFORM')) {
                    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
                  } else if (log.event_type.includes('ERROR') || log.event_type.includes('FAILED')) {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
                  }

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isSel
                          ? 'bg-slate-100 border-slate-900 dark:bg-slate-800 dark:border-sky-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${badgeColor}`}>
                            {log.event_type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-200 mt-1 truncate">
                          {log.summary}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Event Details Inspector */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3 transition-colors">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Event Details Inspector
            </h4>

            {selectedLog ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Event ID:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{selectedLog.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="text-sky-600 dark:text-sky-400 font-bold">{selectedLog.event_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Entity ID:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedLog.entity_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timestamp:</span>
                    <span className="text-slate-700 dark:text-slate-300">{new Date(selectedLog.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Summary:</span>
                  <p className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                    {selectedLog.summary}
                  </p>
                </div>

                {selectedLog.details && (
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">JSON Metadata:</span>
                    <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-sky-300 font-mono text-[11px] max-h-44 overflow-y-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-400 text-xs">
                Select an audit record on the left to inspect its parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MySQL Metadata Credentials Config View */}
      {activeTab === 'credentials' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 transition-colors max-w-2xl">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              MySQL Metadata Store Connection Credentials
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure your MySQL server credentials to persist all pipeline lineage, staged dataset catalogs, and audit logs.
          </p>

          <form onSubmit={handleSaveCredentials} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">MySQL Host *</label>
                <input
                  type="text"
                  required
                  placeholder="localhost or 127.0.0.1"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Port *</label>
                <input
                  type="number"
                  required
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Database Name *</label>
                <input
                  type="text"
                  required
                  placeholder="dataflow_metadata"
                  value={dbDatabase}
                  onChange={(e) => setDbDatabase(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="root"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                placeholder="Enter MySQL Password"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {credsStatus && (
              <div className={`p-3 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                credsStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
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
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {ingestionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No ingestion history recorded yet.
                    </td>
                  </tr>
                ) : (
                  ingestionLogs.map((ing) => (
                    <tr key={ing.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-500">{ing.id}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white font-sans">{ing.source_name}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase">
                          {ing.source_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{ing.row_count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{ing.column_count}</td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-400">{Math.round(ing.duration_ms)} ms</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ing.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                        }`}>
                          {ing.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{new Date(ing.created_at).toLocaleString()}</td>
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {transformLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No transformation history recorded yet.
                    </td>
                  </tr>
                ) : (
                  transformLogs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-500">{tx.id}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white font-sans">{tx.staging_dataset_id}</td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-400 font-bold">{tx.rule_count} steps</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{tx.initial_rows.toLocaleString()}</td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{tx.transformed_rows.toLocaleString()}</td>
                      <td className="py-2 px-3 text-amber-600 dark:text-amber-400">{Math.round(tx.execution_time_ms)} ms</td>
                      <td className="py-2 px-3 text-slate-500">{new Date(tx.created_at).toLocaleString()}</td>
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
