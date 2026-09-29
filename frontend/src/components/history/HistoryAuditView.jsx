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
  Save,
  HardDrive,
  Check
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useTimezone } from '../../context/TimezoneContext';

export const HistoryAuditView = () => {
  const { formatDateTime, formatTime, timezoneShort } = useTimezone();
  const [activeTab, setActiveTab] = useState('audit'); // 'audit', 'ingestion', 'transform', 'credentials'
  const [summary, setSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ingestionLogs, setIngestionLogs] = useState([]);
  const [transformLogs, setTransformLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // Storage Engine State
  const [selectedEngine, setSelectedEngine] = useState('mysql'); // 'mysql' | 'postgres'
  const [activeServerEngine, setActiveServerEngine] = useState('mysql');
  
  // MySQL Settings State
  const [mysqlHost, setMysqlHost] = useState('localhost');
  const [mysqlPort, setMysqlPort] = useState(3306);
  const [mysqlUser, setMysqlUser] = useState('root');
  const [mysqlPassword, setMysqlPassword] = useState('');
  const [mysqlDatabase, setMysqlDatabase] = useState('dataflow_metadata');

  // PostgreSQL Settings State
  const [pgHost, setPgHost] = useState('localhost');
  const [pgPort, setPgPort] = useState(5432);
  const [pgUser, setPgUser] = useState('postgres');
  const [pgPassword, setPgPassword] = useState('');
  const [pgDatabase, setPgDatabase] = useState('dataflow_metadata');
  const [pgSchema, setPgSchema] = useState('public');
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
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
        const engine = credRes.active_engine === 'postgres' ? 'postgres' : 'mysql';
        setSelectedEngine(engine);
        setActiveServerEngine(engine);
        if (credRes.mysql) {
          setMysqlHost(credRes.mysql.host || 'localhost');
          setMysqlPort(credRes.mysql.port || 3306);
          setMysqlUser(credRes.mysql.user || 'root');
          setMysqlDatabase(credRes.mysql.database || 'dataflow_metadata');
        }
        if (credRes.postgres) {
          setPgHost(credRes.postgres.host || 'localhost');
          setPgPort(credRes.postgres.port || 5432);
          setPgUser(credRes.postgres.user || 'postgres');
          setPgDatabase(credRes.postgres.database || 'dataflow_metadata');
          setPgSchema(credRes.postgres.schema || 'public');
        }
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

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const payload = selectedEngine === 'mysql' ? {
        engine: 'mysql',
        host: mysqlHost.trim(),
        port: Number(mysqlPort),
        user: mysqlUser.trim(),
        password: mysqlPassword,
        database: mysqlDatabase.trim(),
      } : {
        engine: 'postgres',
        host: pgHost.trim(),
        port: Number(pgPort),
        user: pgUser.trim(),
        password: pgPassword,
        database: pgDatabase.trim(),
        schema_name: pgSchema.trim(),
      };
      const res = await DataFlowAPI.testDatabaseConnection(payload);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err?.response?.data?.detail || err.message || `${selectedEngine === 'mysql' ? 'MySQL' : 'PostgreSQL'} test connection failed`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCredentials = async (e) => {
    if (e) e.preventDefault();
    setSavingCreds(true);
    setCredsStatus(null);
    try {
      const payload = {
        active_engine: selectedEngine,
        ...(selectedEngine === 'mysql' ? {
          host: mysqlHost.trim(),
          port: Number(mysqlPort),
          user: mysqlUser.trim(),
          password: mysqlPassword,
          database: mysqlDatabase.trim(),
          mysql_host: mysqlHost.trim(),
          mysql_port: Number(mysqlPort),
          mysql_user: mysqlUser.trim(),
          mysql_password: mysqlPassword,
          mysql_database: mysqlDatabase.trim(),
        } : {
          host: pgHost.trim(),
          port: Number(pgPort),
          user: pgUser.trim(),
          password: pgPassword,
          database: pgDatabase.trim(),
          schema_name: pgSchema.trim(),
          postgres_host: pgHost.trim(),
          postgres_port: Number(pgPort),
          postgres_user: pgUser.trim(),
          postgres_password: pgPassword,
          postgres_database: pgDatabase.trim(),
          postgres_schema: pgSchema.trim(),
        })
      };
      const res = await DataFlowAPI.updateMetadataCredentials(payload);
      setCredsStatus(res);
      setActiveServerEngine(res.active_engine);
      fetchAllData();
    } catch (err) {
      setCredsStatus({
        success: false,
        message: err?.response?.data?.detail || err.message || 'Failed to update metadata store configuration',
      });
    } finally {
      setSavingCreds(false);
    }
  };

  // Clear History Confirmation Modal State
  const [clearConfirmModal, setClearConfirmModal] = useState({
    isOpen: false,
    loading: false
  });

  const promptClearAllHistory = () => {
    setClearConfirmModal({ isOpen: true, loading: false });
  };

  const confirmClearAllHistory = async () => {
    setClearConfirmModal((prev) => ({ ...prev, loading: true }));
    setLoading(true);
    try {
      await DataFlowAPI.clearAllHistory();
      setClearConfirmModal({ isOpen: false, loading: false });
      fetchAllData();
    } catch (err) {
      console.error('Failed to clear history', err);
      setClearConfirmModal({ isOpen: false, loading: false });
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
                Database: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{summary?.active_database || (activeServerEngine === 'mysql' ? mysqlDatabase : pgDatabase)}</span> • Engine: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{summary?.metadata_storage_engine || (activeServerEngine === 'mysql' ? 'MySQL Database' : 'PostgreSQL Database')}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={promptClearAllHistory}
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
            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'credentials'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Storage Engine & DB</span>
          </button>
        </div>

        {activeTab === 'audit' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search audit trail..."
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
                            {formatTime(log.created_at, true)}
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
                    <span className="text-zinc-700 dark:text-zinc-300">{formatDateTime(selectedLog.created_at, true)}</span>
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

      {/* 2. Metadata Storage Engine & Credentials Config View */}
      {activeTab === 'credentials' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-4 transition-colors max-w-3xl">
          
          {/* Active Engine Status Banner */}
          <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className={`w-3 h-3 rounded-full ${activeServerEngine === 'mysql' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500 animate-pulse'}`} />
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">Active Storage Engine</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeServerEngine === 'mysql' ? (
                    <>MySQL Database Engine (<span className="font-mono text-emerald-600 dark:text-emerald-400">{mysqlHost}:{mysqlPort}/{mysqlDatabase}</span>)</>
                  ) : (
                    <>PostgreSQL Database Engine (<span className="font-mono text-indigo-600 dark:text-indigo-400">{pgHost}:{pgPort}/{pgDatabase}</span>)</>
                  )}
                </span>
              </div>
            </div>

            <span className={`self-start sm:self-auto px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase border ${
              activeServerEngine === 'mysql'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40'
            }`}>
              {activeServerEngine === 'mysql' ? 'MySQL Active' : 'PostgreSQL Active'}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Select Storage Environment
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Switch where DataFlow Studio stores staged catalog tables, pipelines, transformation history, and flow definitions.
            </p>
          </div>

          {/* Engine Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MySQL Card */}
            <button
              type="button"
              onClick={() => { setSelectedEngine('mysql'); setTestResult(null); }}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedEngine === 'mysql'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-950/80 shadow-xs ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">MySQL Database</span>
                  </div>
                  {selectedEngine === 'mysql' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Enterprise SQL database server. Persists catalog tables, multi-tenant workflows, and audit histories.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>Default: localhost:3306</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">PyMySQL</span>
              </div>
            </button>

            {/* PostgreSQL Card */}
            <button
              type="button"
              onClick={() => { setSelectedEngine('postgres'); setTestResult(null); }}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedEngine === 'postgres'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-950/80 shadow-xs ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">PostgreSQL Database</span>
                  </div>
                  {selectedEngine === 'postgres' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Robust object-relational database with ACID transactions, schema isolation, and high performance.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>Default: localhost:5432</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Psycopg2</span>
              </div>
            </button>
          </div>

          {/* MySQL Configuration Form */}
          {selectedEngine === 'mysql' && (
            <form onSubmit={handleSaveCredentials} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>MySQL Connection Credentials</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Auto-creates database if missing</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">MySQL Host *</label>
                  <input
                    type="text"
                    required
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    placeholder="3306"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Database Name *</label>
                  <input
                    type="text"
                    required
                    value={dbDatabase}
                    onChange={(e) => setDbDatabase(e.target.value)}
                    placeholder="dataflow_metadata"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder="root"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Enter MySQL password (e.g. 3435)"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {/* Real-time Test Feedback */}
              {testResult && (
                <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{testResult.success ? 'MySQL Connected' : 'MySQL Connection Failed'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {/* Save Status Feedback */}
              {credsStatus && (
                <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
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
                    <p className="font-semibold">{credsStatus.success ? 'MySQL Active' : 'Notice'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{credsStatus.message}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestMySQL}
                  disabled={testingConnection}
                  className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingCreds}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingCreds ? 'Saving & Connecting...' : 'Save & Connect MySQL'}</span>
                </button>
              </div>
            </form>
          )}

          {/* PostgreSQL Configuration Form */}
          {selectedEngine === 'postgres' && (
            <form onSubmit={handleSaveCredentials} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>PostgreSQL Connection Credentials</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Auto-creates schema & tables upon save</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">PostgreSQL Host *</label>
                  <input
                    type="text"
                    required
                    value={pgHost}
                    onChange={(e) => setPgHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    value={pgPort}
                    onChange={(e) => setPgPort(e.target.value)}
                    placeholder="5432"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Database Name *</label>
                  <input
                    type="text"
                    required
                    value={pgDatabase}
                    onChange={(e) => setPgDatabase(e.target.value)}
                    placeholder="dataflow_metadata"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Schema</label>
                  <input
                    type="text"
                    value={pgSchema}
                    onChange={(e) => setPgSchema(e.target.value)}
                    placeholder="public"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={pgUser}
                    onChange={(e) => setPgUser(e.target.value)}
                    placeholder="postgres"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={pgPassword}
                    onChange={(e) => setPgPassword(e.target.value)}
                    placeholder="Enter PostgreSQL password"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {/* Real-time Test Feedback */}
              {testResult && (
                <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{testResult.success ? 'PostgreSQL Connected' : 'PostgreSQL Connection Failed'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {/* Save Status Feedback */}
              {credsStatus && (
                <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                  credsStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                }`}>
                  {credsStatus.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{credsStatus.success ? 'PostgreSQL Active' : 'Notice'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{credsStatus.message}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingCreds}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingCreds ? 'Saving & Connecting...' : 'Save & Connect PostgreSQL'}</span>
                </button>
              </div>
            </form>
          )}

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
                      <td className="py-2 px-3 text-zinc-500">{formatDateTime(ing.created_at, true)}</td>
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
                      <td className="py-2 px-3 text-zinc-500">{formatDateTime(tx.created_at, true)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear All History Confirmation Modal */}
      <ConfirmationModal
        isOpen={clearConfirmModal.isOpen}
        title="Reset & Clear All Workspace History?"
        message="Are you sure you want to clear all metadata, staged lakehouse datasets, pipeline runs, and audit logs? This action is irreversible and resets your workspace to a clean slate."
        confirmText="Reset Workspace"
        cancelText="Cancel"
        variant="danger"
        isLoading={clearConfirmModal.loading}
        onConfirm={confirmClearAllHistory}
        onCancel={() => setClearConfirmModal({ isOpen: false, loading: false })}
      />
    </div>
  );
};
