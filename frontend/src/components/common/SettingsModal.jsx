import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Globe, 
  Check, 
  Settings, 
  Sparkles, 
  Sun, 
  Moon, 
  ShieldCheck, 
  RotateCcw,
  Zap,
  Database,
  HardDrive,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Key
} from 'lucide-react';
import { useTimezone, TIMEZONE_OPTIONS } from '../../context/TimezoneContext';
import { DataFlowAPI } from '../../services/api';

export const SettingsModal = ({ isOpen, onClose, isDark, onToggleTheme }) => {
  const {
    timezone,
    effectiveTimezone,
    setTimezone,
    is24Hour,
    setIs24Hour,
    currentTime,
    timezoneShort,
    formatTime,
    formatDate,
    formatDateTime
  } = useTimezone();

  const [activeTab, setActiveTab] = useState('timezone'); // 'timezone' | 'storage'
  const [searchFilter, setSearchFilter] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  // Storage Engine State
  const [selectedEngine, setSelectedEngine] = useState('mysql'); // 'mysql' | 'sqlite'
  const [activeServerEngine, setActiveServerEngine] = useState(null);
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPort, setDbPort] = useState(3306);
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbDatabase, setDbDatabase] = useState('dataflow_metadata');
  const [sqlitePath, setSqlitePath] = useState('');
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savingEngine, setSavingEngine] = useState(false);
  const [engineSaveResult, setEngineSaveResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadStorageCredentials();
    }
  }, [isOpen]);

  const loadStorageCredentials = async () => {
    try {
      const creds = await DataFlowAPI.getMetadataCredentials();
      if (creds) {
        setSelectedEngine(creds.active_engine || (creds.use_mysql ? 'mysql' : 'sqlite'));
        setActiveServerEngine(creds.active_engine || 'sqlite');
        setDbHost(creds.host || 'localhost');
        setDbPort(creds.port || 3306);
        setDbUser(creds.user || 'root');
        setDbDatabase(creds.database || 'dataflow_metadata');
        setSqlitePath(creds.sqlite_path || 'catalog_fallback.db');
      }
    } catch (err) {
      console.error('Failed to load storage engine config', err);
    }
  };

  if (!isOpen) return null;

  const handleSelectTimezone = (tzValue) => {
    setTimezone(tzValue);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleAutoDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    handleSelectTimezone(detected || 'Asia/Kolkata');
  };

  const handleTestMySQL = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await DataFlowAPI.testMySQLCredentials({
        host: dbHost.trim(),
        port: Number(dbPort),
        user: dbUser.trim(),
        password: dbPassword,
        database: dbDatabase.trim(),
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err?.response?.data?.detail || err.message || 'MySQL test connection failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveStorageEngine = async (e) => {
    if (e) e.preventDefault();
    setSavingEngine(true);
    setEngineSaveResult(null);
    try {
      const payload = {
        active_engine: selectedEngine,
        host: dbHost.trim(),
        port: Number(dbPort),
        user: dbUser.trim(),
        password: dbPassword,
        database: dbDatabase.trim(),
      };
      const res = await DataFlowAPI.updateMetadataCredentials(payload);
      setEngineSaveResult(res);
      setActiveServerEngine(res.active_engine);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (err) {
      setEngineSaveResult({
        success: false,
        message: err?.response?.data?.detail || err.message || 'Failed to update storage engine configuration',
      });
    } finally {
      setSavingEngine(false);
    }
  };

  const filteredTimezones = TIMEZONE_OPTIONS.filter((tz) =>
    tz.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
    tz.region.toLowerCase().includes(searchFilter.toLowerCase()) ||
    tz.value.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <span>Studio Settings & Preferences</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure application storage engine (MySQL / SQLite), timezone, live clock & display
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Top Tabs */}
        <div className="px-6 pt-3 pb-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30 flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('timezone')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'timezone'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Timezone & Clock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'storage'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Storage Engine (MySQL / SQLite)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* TAB 1: TIMEZONE & DISPLAY */}
          {activeTab === 'timezone' && (
            <>
              {/* LIVE CLOCK & ACTIVE TIMEZONE HERO CARD */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-white dark:from-zinc-950 dark:to-zinc-900 dark:border dark:border-zinc-800 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Globe className="w-32 h-32" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div>
                    <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Live Studio Clock</span>
                    </span>
                    <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white mt-1 flex items-baseline space-x-2">
                      <span>{formatTime(currentTime)}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 text-white">
                        {timezoneShort}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 font-mono mt-1">
                      {formatDate(currentTime)} • {effectiveTimezone}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 sm:self-center">
                    <button
                      type="button"
                      onClick={handleAutoDetect}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center space-x-1.5 border border-white/10 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>Auto-Detect</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* TIMEZONE SELECTION SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                    <Globe className="w-4 h-4 text-zinc-500" />
                    <span>Application Timezone</span>
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Current: <strong className="text-zinc-800 dark:text-zinc-200">{effectiveTimezone}</strong>
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search timezone (e.g. Kolkata, IST, UTC, New York, London, Tokyo)..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-950/40">
                    {filteredTimezones.map((tz) => {
                      const isSelected = timezone === tz.value || (timezone === 'AUTO' && tz.value === 'AUTO');
                      return (
                        <button
                          key={tz.value}
                          type="button"
                          onClick={() => handleSelectTimezone(tz.value)}
                          className={`p-2.5 rounded-lg text-left transition-all flex items-center justify-between border ${
                            isSelected
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-xs truncate">{tz.label}</div>
                            <div className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>
                              {tz.value}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* TIME FORMAT & CLOCK DISPLAY TOGGLES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Time Format</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Toggle 24-hour military format or standard 12-hour AM/PM clock display.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIs24Hour(true)}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-colors border ${
                        is24Hour
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      24-Hour (20:56)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIs24Hour(false)}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-colors border ${
                        !is24Hour
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      12-Hour (08:56 PM)
                    </button>
                  </div>
                </div>

                {/* THEME SELECTOR */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Sun className="w-4 h-4 text-zinc-500" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Interface Theme</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Switch between clean light canvas and high-contrast dark theme.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => isDark && onToggleTheme()}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1 border ${
                        !isDark
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => !isDark && onToggleTheme()}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1 border ${
                        isDark
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* AUDIT TIMESTAMPS INFO CARD */}
              <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <strong className="text-xs">Audit Column Localization Engine (`aud_last_update`)</strong>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/80">
                  All ingested batches and incremental flow syncs automatically stamp `aud_last_update`. The DataFlow Studio UI automatically converts and renders all dates, logs, sync intervals, and stage timestamps in your active timezone (<strong>{effectiveTimezone} • {timezoneShort}</strong>).
                </p>
              </div>
            </>
          )}

          {/* TAB 2: STORAGE ENGINE SELECTION (MySQL vs SQLite) */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              
              {/* Active Engine Status Banner */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-3 h-3 rounded-full ${activeServerEngine === 'mysql' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 block">Currently Active Storage Engine</span>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {activeServerEngine === 'mysql' ? (
                        <>MySQL Database Engine (<span className="font-mono text-emerald-600 dark:text-emerald-400">{dbHost}:{dbPort}/{dbDatabase}</span>)</>
                      ) : (
                        <>SQLite Embedded Engine (<span className="font-mono text-blue-600 dark:text-blue-400">Local Catalog DB</span>)</>
                      )}
                    </span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
                  activeServerEngine === 'mysql'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40'
                }`}>
                  {activeServerEngine === 'mysql' ? 'MySQL Active' : 'SQLite Active'}
                </span>
              </div>

              {/* Engine Choice Cards */}
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-zinc-500" />
                  <span>Select Metadata Storage Environment</span>
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Choose where DataFlow Studio persists flows, staged catalogs, dataset metadata, transformation rules, and audit logs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* MySQL Card */}
                <button
                  type="button"
                  onClick={() => setSelectedEngine('mysql')}
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
                      Enterprise networked MySQL server. Recommended for production, multi-client concurrency, and persistent catalog storage.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Default: localhost:3306</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Full ACID</span>
                  </div>
                </button>

                {/* SQLite Card */}
                <button
                  type="button"
                  onClick={() => setSelectedEngine('sqlite')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedEngine === 'sqlite'
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-950/80 shadow-xs ring-1 ring-zinc-900 dark:ring-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">SQLite Embedded</span>
                      </div>
                      {selectedEngine === 'sqlite' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Embedded file-based storage catalog. Zero configuration needed; persists local workspace database automatically.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>File: catalog_fallback.db</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Zero Setup</span>
                  </div>
                </button>
              </div>

              {/* MySQL Form */}
              {selectedEngine === 'mysql' && (
                <form onSubmit={handleSaveStorageEngine} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                      <Key className="w-3.5 h-3.5 text-zinc-500" />
                      <span>MySQL Connection Parameters</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">Auto-creates database if missing</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Host / Server IP *</label>
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

                  {/* Test Result Feedback */}
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
                        <p className="font-semibold">{testResult.success ? 'MySQL Connection Verified' : 'Connection Failed'}</p>
                        <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Save Result Feedback */}
                  {engineSaveResult && (
                    <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                      engineSaveResult.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40'
                    }`}>
                      {engineSaveResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold">{engineSaveResult.success ? 'Storage Engine Updated' : 'Notice'}</p>
                        <p className="text-[11px] opacity-90 mt-0.5">{engineSaveResult.message}</p>
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
                      <span>{testingConnection ? 'Testing...' : 'Test MySQL Connection'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={savingEngine}
                      className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingEngine ? 'Connecting...' : 'Save & Activate MySQL'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* SQLite Option Info & Activate */}
              {selectedEngine === 'sqlite' && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
                    <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Embedded SQLite Catalog Configuration</span>
                  </div>

                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    DataFlow Studio maintains an embedded SQLite database for standalone environments. All staged datasets, execution logs, flow configurations, and history will be saved to your local disk.
                  </p>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                    <span className="text-zinc-400 block text-[10px] uppercase">Storage File Path:</span>
                    <span className="text-blue-600 dark:text-blue-400">{sqlitePath || 'Local catalog fallback DB'}</span>
                  </div>

                  {engineSaveResult && (
                    <div className="p-2.5 rounded-lg border text-xs font-mono flex items-start space-x-2 bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">SQLite Activated</p>
                        <p className="text-[11px] opacity-90 mt-0.5">{engineSaveResult.message}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveStorageEngine}
                      disabled={savingEngine}
                      className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingEngine ? 'Activating...' : 'Activate SQLite Storage'}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
            {saveToast && (
              <span className="flex items-center space-x-1 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>Settings saved successfully</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium text-xs shadow-xs transition-colors"
            >
              Done & Apply
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
