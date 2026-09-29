import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Globe, 
  Sun, 
  Moon, 
  Server, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw, 
  Zap, 
  Clock, 
  ArrowRightLeft,
  ShieldCheck,
  FileCode2,
  HardDrive
} from 'lucide-react';
import { useTimezone, TIMEZONE_OPTIONS } from '../../context/TimezoneContext';
import { DataFlowAPI } from '../../services/api';

export const SettingsView = ({ isDark, onToggleTheme }) => {
  const {
    timezone,
    effectiveTimezone,
    setTimezone,
    is24Hour,
    setIs24Hour,
    currentTime,
    timezoneShort,
    formatTime,
    formatDate
  } = useTimezone();

  // Active Tab: default to 'storage'
  const [activeTab, setActiveTab] = useState('storage'); // 'storage' | 'timezone' | 'appearance'
  const [notification, setNotification] = useState(null);

  // Storage Engine State
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeServerEngine, setActiveServerEngine] = useState('mysql');
  const [isConnected, setIsConnected] = useState(true);
  const [mysqlInfo, setMysqlInfo] = useState({
    host: 'localhost',
    port: 3306,
    user: 'root',
    database: 'dataflow_metadata',
    configured: true,
    is_active: true
  });
  const [postgresInfo, setPostgresInfo] = useState({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'dataflow_metadata',
    schema: 'public',
    configured: false,
    is_active: false
  });
  const [metadataSummary, setMetadataSummary] = useState(null);
  const [switchingEngine, setSwitchingEngine] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState(null);

  useEffect(() => {
    loadStorageCredentials();
  }, []);

  const loadStorageCredentials = async () => {
    setLoadingConfig(true);
    try {
      const creds = await DataFlowAPI.getMetadataCredentials();
      if (creds) {
        const engine = creds.active_engine === 'postgres' ? 'postgres' : 'mysql';
        setActiveServerEngine(engine);
        setIsConnected(creds.connected !== false);
        if (creds.mysql) setMysqlInfo(creds.mysql);
        if (creds.postgres) setPostgresInfo(creds.postgres);
        if (creds.summary) setMetadataSummary(creds.summary);
      }
    } catch (err) {
      console.error('Failed to load storage engine config', err);
      showNotification('Failed to fetch metadata configuration', 'error');
    } finally {
      setLoadingConfig(false);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSwitchEngine = async (targetEngine) => {
    if (targetEngine === activeServerEngine || switchingEngine) return;
    setSwitchingEngine(true);
    setSwitchFeedback(null);
    try {
      const res = await DataFlowAPI.updateMetadataCredentials({
        active_engine: targetEngine
      });
      if (res && res.success) {
        setActiveServerEngine(res.active_engine);
        setIsConnected(true);
        if (res.mysql) setMysqlInfo(res.mysql);
        if (res.postgres) setPostgresInfo(res.postgres);
        if (res.summary) setMetadataSummary(res.summary);
        setSwitchFeedback({
          success: true,
          message: res.message || `Switched to ${res.engine_label || targetEngine} successfully.`
        });
        showNotification(`Active database switched to ${res.engine_label || targetEngine}`);
      } else {
        setSwitchFeedback({
          success: false,
          message: res?.message || `Failed to switch to ${targetEngine}.`
        });
        showNotification(res?.message || 'Database switch aborted', 'error');
      }
    } catch (err) {
      const errDetail = err?.response?.data?.detail || err.message || `Cannot connect to ${targetEngine}.`;
      setSwitchFeedback({
        success: false,
        message: typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail)
      });
      showNotification('Database switch failed', 'error');
    } finally {
      setSwitchingEngine(false);
      // Reload credentials to ensure fresh metadata state
      await loadStorageCredentials();
    }
  };

  const handleSelectTimezone = (tzValue) => {
    setTimezone(tzValue);
    showNotification(`Timezone set to ${tzValue}`);
  };

  const handleAutoDetectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    handleSelectTimezone(detected || 'Asia/Kolkata');
  };

  return (
    <div className="w-full space-y-5 animate-fadeIn pb-12">
      
      {/* Toast Alert */}
      {notification && (
        <div className={`fixed top-16 right-6 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium animate-fadeIn ${
          notification.type === 'error'
            ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900'
            : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-700 dark:border-zinc-300'
        }`}>
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Clean Header & Navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Settings
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your active metadata storage database, studio timezone, and interface theme.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'storage'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Storage Engine</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timezone')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'timezone'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Timezone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'appearance'
                ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </button>
        </div>
      </div>

      {/* 1. STORAGE ENGINE TAB */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          
          {/* Active Live Database Status & Realtime Metrics Banner */}
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  activeServerEngine === 'mysql' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40' 
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40'
                }`}>
                  {activeServerEngine === 'mysql' ? <Server className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Active Metadata Database: {activeServerEngine === 'mysql' ? 'MySQL' : 'PostgreSQL'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                      isConnected 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      {isConnected ? 'ONLINE & ACTIVE' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {activeServerEngine === 'mysql' 
                      ? `${mysqlInfo.host}:${mysqlInfo.port} / ${mysqlInfo.database} (user: ${mysqlInfo.user})`
                      : `${postgresInfo.host}:${postgresInfo.port} / ${postgresInfo.database} (schema: ${postgresInfo.schema}, user: ${postgresInfo.user})`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadStorageCredentials}
                disabled={loadingConfig}
                className="self-start sm:self-auto px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingConfig ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>

            {/* Live Metrics fetched directly from the selected database */}
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-2">
                Live Data Loaded From Selected Database:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-mono">FLOWS</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metadataSummary ? metadataSummary.flows_count : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-mono">STAGED DATASETS</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metadataSummary ? metadataSummary.staged_datasets_count : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-mono">PIPELINE JOBS</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metadataSummary ? metadataSummary.pipeline_jobs_count : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-mono">AUDIT LOGS</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metadataSummary ? metadataSummary.audit_logs_count : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-zinc-400 block font-mono">STAGED ROWS</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {metadataSummary ? (metadataSummary.total_staged_rows || 0).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Switch Feedback Banner */}
          {switchFeedback && (
            <div className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 animate-fadeIn ${
              switchFeedback.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
            }`}>
              {switchFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">
                  {switchFeedback.success ? 'Database Switched Successfully' : 'Database Switch Aborted'}
                </span>
                <p className="text-[11px] mt-0.5 leading-relaxed font-mono">
                  {switchFeedback.message}
                </p>
                {!switchFeedback.success && (
                  <p className="text-[11px] mt-1 font-sans text-red-700 dark:text-red-300">
                    Active database remains safely on <strong>{activeServerEngine === 'mysql' ? 'MySQL' : 'PostgreSQL'}</strong> without downtime or data corruption.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Database Selection Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Available Storage Backends
              </span>
              <span className="text-[11px] text-zinc-400">
                Credentials loaded securely from backend .env
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* MySQL Card */}
              <div className={`p-4 rounded-lg border transition-all flex flex-col justify-between ${
                activeServerEngine === 'mysql'
                  ? 'bg-white dark:bg-zinc-900 border-emerald-500/80 dark:border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">MySQL Database</h4>
                        <span className="text-[10px] font-mono text-zinc-400">Driver: PyMySQL (Port 3306)</span>
                      </div>
                    </div>

                    {activeServerEngine === 'mysql' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                        <Check className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        Available
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Default high-performance metadata repository for workflows, schema mappings, staged rows, and audit history.
                  </p>

                  {/* Read-only Parameters from .env */}
                  <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Host:Port</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{mysqlInfo.host}:{mysqlInfo.port}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Database</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{mysqlInfo.database}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">User</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{mysqlInfo.user}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Password</span>
                      <span className="text-zinc-400 italic font-sans text-[10px]">Loaded from .env</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {activeServerEngine === 'mysql' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-xs font-medium flex items-center justify-center space-x-1.5 cursor-default"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Currently Active Metadata Engine</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchEngine('mysql')}
                      disabled={switchingEngine}
                      className="w-full py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
                    >
                      <ArrowRightLeft className={`w-3.5 h-3.5 ${switchingEngine ? 'animate-spin' : ''}`} />
                      <span>{switchingEngine ? 'Switching to MySQL...' : 'Switch to MySQL'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* PostgreSQL Card */}
              <div className={`p-4 rounded-lg border transition-all flex flex-col justify-between ${
                activeServerEngine === 'postgres'
                  ? 'bg-white dark:bg-zinc-900 border-indigo-500/80 dark:border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">PostgreSQL Database</h4>
                        <span className="text-[10px] font-mono text-zinc-400">Driver: Psycopg2 (Port 5432)</span>
                      </div>
                    </div>

                    {activeServerEngine === 'postgres' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                        <Check className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        Available
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Enterprise object-relational store with ACID guarantees, schema namespaces, and JSON column support.
                  </p>

                  {/* Read-only Parameters from .env */}
                  <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Host:Port</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{postgresInfo.host}:{postgresInfo.port}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Database</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{postgresInfo.database}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Schema / User</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{postgresInfo.schema || 'public'} / {postgresInfo.user}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Password</span>
                      <span className="text-zinc-400 italic font-sans text-[10px]">Loaded from .env</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {activeServerEngine === 'postgres' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-xs font-medium flex items-center justify-center space-x-1.5 cursor-default"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Currently Active Metadata Engine</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchEngine('postgres')}
                      disabled={switchingEngine}
                      className="w-full py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
                    >
                      <ArrowRightLeft className={`w-3.5 h-3.5 ${switchingEngine ? 'animate-spin' : ''}`} />
                      <span>{switchingEngine ? 'Switching to PostgreSQL...' : 'Switch to PostgreSQL'}</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* 2. TIMEZONE TAB */}
      {activeTab === 'timezone' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-5">
          
          {/* Current Time Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Studio Clock & Active Timezone</span>
              <div className="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-baseline space-x-2">
                <span>{formatTime(currentTime)}</span>
                <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {timezoneShort}
                </span>
                <span className="text-xs text-zinc-500 font-sans font-normal ml-1">
                  • {effectiveTimezone}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoDetectTimezone}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700 flex items-center space-x-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Auto-Detect</span>
            </button>
          </div>

          {/* Timezone Select Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Select Application Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => handleSelectTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-sans cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              All dates, flow execution intervals, and <code className="font-mono text-[10px]">aud_last_update</code> columns are localized to this timezone.
            </p>
          </div>

          {/* 12-Hour vs 24-Hour Switch */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block">Time Format</span>
              <span className="text-[11px] text-zinc-400">Choose between 24-hour military clock or standard 12-hour AM/PM.</span>
            </div>

            <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setIs24Hour(true)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  is24Hour
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                24-Hour
              </button>
              <button
                type="button"
                onClick={() => setIs24Hour(false)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  !is24Hour
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                12-Hour
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 3. APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Interface Color Theme
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Select your preferred visual style for DataFlow Studio.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => isDark && onToggleTheme()}
              className={`p-4 rounded-lg border text-left transition-colors flex items-center justify-between ${
                !isDark
                  ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">Light Mode</span>
                  <span className="text-[11px] text-zinc-400">Clean canvas theme</span>
                </div>
              </div>
              {!isDark && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
            </button>

            <button
              type="button"
              onClick={() => !isDark && onToggleTheme()}
              className={`p-4 rounded-lg border text-left transition-colors flex items-center justify-between ${
                isDark
                  ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">Dark Mode</span>
                  <span className="text-[11px] text-zinc-400">High-contrast dark theme</span>
                </div>
              </div>
              {isDark && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
