import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Globe, 
  Sun, 
  Moon, 
  Server, 
  HardDrive, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Zap, 
  Clock, 
  Key 
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

  useEffect(() => {
    loadStorageCredentials();
  }, []);

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

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
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
      setActiveServerEngine(res.active_engine);
      showNotification(res.message || 'Storage engine updated successfully');
    } catch (err) {
      showNotification(err?.response?.data?.detail || err.message || 'Failed to update storage engine', 'error');
    } finally {
      setSavingEngine(false);
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
            Manage your storage database engine, timezone, and appearance.
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
          
          {/* Active Engine Summary Pill */}
          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${activeServerEngine === 'mysql' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
              <span className="text-zinc-500 dark:text-zinc-400">Current Storage Backend:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono">
                {activeServerEngine === 'mysql' ? `MySQL (${dbHost}:${dbPort}/${dbDatabase})` : 'SQLite (Local embedded catalog)'}
              </strong>
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
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedEngine('mysql')}
              className={`p-3.5 rounded-lg border text-left transition-colors flex items-start justify-between ${
                selectedEngine === 'mysql'
                  ? 'bg-zinc-50 dark:bg-zinc-900/90 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">MySQL Database</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Networked SQL database for persistent enterprise storage.
                </p>
              </div>
              {selectedEngine === 'mysql' && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedEngine('sqlite')}
              className={`p-3.5 rounded-lg border text-left transition-colors flex items-start justify-between ${
                selectedEngine === 'sqlite'
                  ? 'bg-zinc-50 dark:bg-zinc-900/90 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">SQLite Embedded</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Local file-based storage. Zero configuration required.
                </p>
              </div>
              {selectedEngine === 'sqlite' && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />}
            </button>
          </div>

          {/* MySQL Configuration Form */}
          {selectedEngine === 'mysql' && (
            <form onSubmit={handleSaveStorageEngine} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3.5">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <Key className="w-3.5 h-3.5 text-zinc-400" />
                <span>MySQL Connection Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Host *</label>
                  <input
                    type="text"
                    required
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                    className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                    className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                    className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Enter MySQL password"
                  className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {/* Test feedback */}
              {testResult && (
                <div className={`p-2.5 rounded-md border text-xs font-mono flex items-start space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <p className="text-[11px]">{testResult.message}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestMySQL}
                  disabled={testingConnection}
                  className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
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

          {/* SQLite View */}
          {selectedEngine === 'sqlite' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                All metadata, staged datasets, and history logs are persisted locally in a single-file SQLite database:
              </p>
              
              <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
                {sqlitePath || 'catalog_fallback.db'}
              </div>

              <div className="pt-1 flex justify-end">
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
