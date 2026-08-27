import React, { useState, useEffect } from 'react';
import { 
  GitBranch,
  Plus,
  X,
  Database, 
  Cloud, 
  Layers, 
  Upload,
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  Table as TableIcon,
  Code2,
  Save,
  Trash2,
  BookmarkCheck,
  Zap,
  Server,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';

const sourceEngines = [
  { id: 'mysql', name: 'MySQL', icon: Database },
  { id: 'postgresql', name: 'PostgreSQL', icon: Database },
  { id: 'sqlserver', name: 'SQL Server', icon: Database },
  { id: 's3', name: 'AWS S3', icon: Cloud },
  { id: 'azure', name: 'Azure Lakehouse', icon: Layers },
  { id: 'upload', name: 'Upload File', icon: Upload },
];

export const SourceConnectorView = ({ 
  flows = [],
  activeFlowId,
  onSelectFlow,
  onRefreshFlows,
  onSourceInspected,
  onNavigateToStep
}) => {
  const [activeSource, setActiveSource] = useState('mysql');
  const [connectionName, setConnectionName] = useState('MySQL Database');

  // Inline Flow Creation State
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowCategory, setNewFlowCategory] = useState('General');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [flowCreateError, setFlowCreateError] = useState(null);

  const currentFlow = flows.find((f) => f.id === activeFlowId) || (flows.length > 0 ? flows[0] : null);

  const handleCreateFlowSubmit = async (e) => {
    e.preventDefault();
    if (!newFlowName.trim()) {
      setFlowCreateError('Please provide a valid Flow name.');
      return;
    }
    setCreatingFlow(true);
    setFlowCreateError(null);
    try {
      const created = await DataFlowAPI.createFlow({
        name: newFlowName.trim(),
        category: newFlowCategory.trim() || 'General',
        description: newFlowDesc.trim(),
        rules: []
      });
      setShowCreateFlowModal(false);
      setNewFlowName('');
      setNewFlowDesc('');
      setNewFlowCategory('General');
      if (onRefreshFlows) await onRefreshFlows();
      if (onSelectFlow) onSelectFlow(created.id);
    } catch (err) {
      setFlowCreateError(err?.response?.data?.detail || err.message || 'Failed to create flow');
    } finally {
      setCreatingFlow(false);
    }
  };

  // Database Connection Fields
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(3306);
  const [dbName, setDbName] = useState('');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [customSql, setCustomSql] = useState('');
  const [isCustomSql, setIsCustomSql] = useState(false);
  const [tablesList, setTablesList] = useState([]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // Cloud S3 Fields
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Key, setS3Key] = useState('');
  const [s3Format, setS3Format] = useState('parquet');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');

  // Cloud Azure Fields
  const [azureAccount, setAzureAccount] = useState('');
  const [azureContainer, setAzureContainer] = useState('');
  const [azurePath, setAzurePath] = useState('');
  const [azureKey, setAzureKey] = useState('');

  // File Upload
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Saved Connections List
  const [savedConnections, setSavedConnections] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // State flags
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState(null);

  // Connected Flow Datasets State
  const [flowDatasets, setFlowDatasets] = useState([]);
  const [loadingFlowDatasets, setLoadingFlowDatasets] = useState(false);

  const fetchFlowDatasets = async () => {
    if (!activeFlowId) {
      setFlowDatasets([]);
      return;
    }
    setLoadingFlowDatasets(true);
    try {
      const datasets = await DataFlowAPI.listStagedDatasets(activeFlowId);
      setFlowDatasets(datasets || []);
    } catch (err) {
      console.error('Failed to load datasets for flow', err);
    } finally {
      setLoadingFlowDatasets(false);
    }
  };

  const fetchSavedConnections = async () => {
    setLoadingSaved(true);
    try {
      const conns = await DataFlowAPI.getSavedConnections();
      setSavedConnections(conns);
    } catch (err) {
      console.error('Failed to load saved connections', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedConnections();
  }, []);

  useEffect(() => {
    fetchFlowDatasets();
  }, [activeFlowId]);

  const handleSourceSelect = (srcId) => {
    setActiveSource(srcId);
    setTestStatus(null);
    setError(null);
    setSaveSuccessMsg(null);
    setTablesList([]);
    setSelectedTable('');
    if (srcId === 'postgresql') {
      setPort(5432);
      setUsername('postgres');
      setConnectionName('My PostgreSQL DB');
    } else if (srcId === 'mysql') {
      setPort(3306);
      setUsername('root');
      setConnectionName('My MySQL DB');
    } else if (srcId === 'sqlserver') {
      setPort(1433);
      setUsername('sa');
      setConnectionName('My SQL Server');
    } else if (srcId === 's3') {
      setConnectionName('My AWS S3 Bucket');
    } else if (srcId === 'azure') {
      setConnectionName('My Azure Lakehouse');
    } else if (srcId === 'upload') {
      setConnectionName('Raw File Ingestion');
    }
  };

  const buildRequest = () => {
    if (['postgresql', 'mysql', 'sqlserver'].includes(activeSource)) {
      const targetName = isCustomSql 
        ? `SQL Query (${activeSource.toUpperCase()})` 
        : (selectedTable || 'Database');
      return {
        source_type: 'database',
        name: connectionName || `${activeSource.toUpperCase()}: ${targetName}`,
        database_config: {
          db_type: activeSource,
          host: host.trim(),
          port: Number(port),
          database: dbName.trim(),
          username: username.trim() || undefined,
          password: password || undefined,
          table_name: !isCustomSql ? selectedTable.trim() : undefined,
          query: isCustomSql ? customSql.trim() : undefined,
        },
      };
    } else if (activeSource === 's3') {
      return {
        source_type: 's3',
        name: connectionName || `AWS S3: ${s3Bucket}/${s3Key}`,
        s3_config: {
          bucket: s3Bucket.trim(),
          key_prefix: s3Key.trim(),
          region: s3Region.trim(),
          access_key: s3AccessKey.trim() || undefined,
          secret_key: s3SecretKey.trim() || undefined,
          file_format: s3Format,
        },
      };
    } else if (activeSource === 'azure') {
      return {
        source_type: 'azure_lakehouse',
        name: connectionName || `Azure ADLS: ${azureContainer}/${azurePath}`,
        azure_config: {
          account_name: azureAccount.trim(),
          container_name: azureContainer.trim(),
          path: azurePath.trim(),
          account_key: azureKey.trim() || undefined,
        },
      };
    } else if (activeSource === 'upload') {
      if (!uploadedFileInfo) {
        throw new Error('Please select and upload a file first.');
      }
      return {
        source_type: 'file_upload',
        name: connectionName || `File: ${uploadedFileInfo.filename}`,
        local_config: {
          file_path: uploadedFileInfo.file_path,
        },
      };
    }
    throw new Error('Invalid source engine selected');
  };

  const handleSaveCurrentConnection = async () => {
    setError(null);
    setSaveSuccessMsg(null);
    try {
      let summary = '';
      let config = {};

      if (['postgresql', 'mysql', 'sqlserver'].includes(activeSource)) {
        summary = `${host}:${port}/${dbName || 'default'} (user: ${username})`;
        config = { host, port: Number(port), dbName, username, password, selectedTable, isCustomSql, customSql };
      } else if (activeSource === 's3') {
        summary = `s3://${s3Bucket}/${s3Key}`;
        config = { s3Bucket, s3Key, s3Format, s3AccessKey, s3SecretKey, s3Region };
      } else if (activeSource === 'azure') {
        summary = `adls://${azureAccount}/${azureContainer}/${azurePath}`;
        config = { azureAccount, azureContainer, azurePath, azureKey };
      } else if (activeSource === 'upload') {
        summary = uploadedFileInfo ? uploadedFileInfo.filename : 'File Upload';
        config = { uploadedFileInfo };
      }

      await DataFlowAPI.saveConnection({
        name: connectionName || `${activeSource.toUpperCase()} Connection`,
        source_type: activeSource,
        summary: summary,
        config: config,
      });

      setSaveSuccessMsg(`Connection '${connectionName}' saved successfully!`);
      fetchSavedConnections();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save connection');
    }
  };

  const handleLoadSavedConnection = async (saved) => {
    setActiveSource(saved.source_type);
    setConnectionName(saved.name);
    setTestStatus(null);
    setError(null);
    setSaveSuccessMsg(null);

    const cfg = saved.config || {};
    if (['postgresql', 'mysql', 'sqlserver'].includes(saved.source_type)) {
      setHost(cfg.host || 'localhost');
      setPort(cfg.port || (saved.source_type === 'mysql' ? 3306 : (saved.source_type === 'postgresql' ? 5432 : 1433)));
      setDbName(cfg.dbName || '');
      setUsername(cfg.username || '');
      setPassword(cfg.password || '');
      setSelectedTable(cfg.selectedTable || '');
      setIsCustomSql(cfg.isCustomSql || false);
      setCustomSql(cfg.customSql || '');
    } else if (saved.source_type === 's3') {
      setS3Bucket(cfg.s3Bucket || '');
      setS3Key(cfg.s3Key || '');
      setS3Format(cfg.s3Format || 'parquet');
      setS3AccessKey(cfg.s3AccessKey || '');
      setS3SecretKey(cfg.s3SecretKey || '');
      setS3Region(cfg.s3Region || 'us-east-1');
    } else if (saved.source_type === 'azure') {
      setAzureAccount(cfg.azureAccount || '');
      setAzureContainer(cfg.azureContainer || '');
      setAzurePath(cfg.azurePath || '');
      setAzureKey(cfg.azureKey || '');
    } else if (saved.source_type === 'upload') {
      setUploadedFileInfo(cfg.uploadedFileInfo || null);
    }
  };

  const handleDeleteSavedConnection = async (connId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved connection?')) return;
    try {
      await DataFlowAPI.deleteSavedConnection(connId);
      setSavedConnections((prev) => prev.filter((c) => c.id !== connId));
    } catch (err) {
      console.error('Failed to delete connection', err);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus(null);
    setError(null);
    try {
      const req = buildRequest();
      const res = await DataFlowAPI.testConnection(req);
      setTestStatus(res);
      if (res.success && ['postgresql', 'mysql', 'sqlserver'].includes(activeSource)) {
        try {
          const tblRes = await DataFlowAPI.listDatabaseTables(req);
          if (tblRes.tables && tblRes.tables.length > 0) {
            const tableNames = tblRes.tables.map((t) => t.table_name);
            setTablesList(tableNames);
            if (!selectedTable || !tableNames.includes(selectedTable)) {
              setSelectedTable(tableNames[0]);
            }
          } else {
            setTablesList([]);
          }
        } catch (e) {
          console.warn('Failed to load tables list', e);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleInspect = async () => {
    if (['postgresql', 'mysql', 'sqlserver'].includes(activeSource) && !isCustomSql && !selectedTable) {
      setError('Please select a table from the list below before inspecting.');
      return;
    }
    setInspecting(true);
    setError(null);
    try {
      const req = buildRequest();
      const result = await DataFlowAPI.inspectSource(req, 100);
      onSourceInspected(req, result);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Inspection failed');
    } finally {
      setInspecting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setError(null);
    try {
      const res = await DataFlowAPI.uploadFile(file);
      setUploadedFileInfo(res);
      setTestStatus({ success: true, message: `File ${res.filename} uploaded successfully (${(res.size_bytes / 1024).toFixed(1)} KB)` });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'File upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredSaved = savedConnections.filter((c) => c.source_type === activeSource || !activeSource);

  const filteredTables = tablesList.filter((tbl) => {
    if (!tableSearchTerm.trim()) return true;
    return tbl.toLowerCase().includes(tableSearchTerm.toLowerCase());
  });

  if (flows.length === 0 || !activeFlowId) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5 shadow-sm animate-fadeIn my-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-500/20">
          <GitBranch className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Create a Data Flow First
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Every data source, schema, staging table, and transformation belongs to an isolated Data Flow. Please create your Flow to begin ingesting sources.
          </p>
        </div>

        {flowCreateError && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{flowCreateError}</span>
          </div>
        )}

        <form onSubmit={handleCreateFlowSubmit} className="space-y-3 text-left p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Flow Name *</label>
            <input
              type="text"
              required
              placeholder=""
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={newFlowCategory}
                onChange={(e) => setNewFlowCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans"
              >
                <option value="General">General</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
                <option value="Analytics">Analytics</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder=""
                value={newFlowDesc}
                onChange={(e) => setNewFlowDesc(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creatingFlow}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creatingFlow ? 'Creating Flow...' : 'Create Flow & Select Data Source'}</span>
          </button>
        </form>

        {flows.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center space-x-2 text-xs">
            <span className="text-slate-400">Or select an existing flow:</span>
            <select
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="">Choose Flow...</option>
              {flows.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ACTIVE FLOW TARGET BANNER */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900 to-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0 mt-0.5 sm:mt-0">
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400">Target Flow:</span>
              <strong className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px] sm:max-w-none">{currentFlow?.name || 'Active Flow'}</strong>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 uppercase font-bold shrink-0">
                {currentFlow?.category || 'General'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              All tables and ingested data will be scoped exclusively to this Flow.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto mt-1 sm:mt-0">
          <select
            value={activeFlowId || ''}
            onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
            className="flex-1 sm:flex-none px-2.5 py-1.5 bg-slate-800 text-xs font-mono font-bold text-white rounded-lg border border-slate-700 focus:outline-none min-w-0 truncate"
          >
            {flows.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.category || 'General'})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCreateFlowModal(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1 transition-colors"
            title="Create New Flow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Flow</span>
          </button>
        </div>
      </div>

      {/* CREATE FLOW MODAL */}
      {showCreateFlowModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Flow & Select Source</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateFlowModal(false)}
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flowCreateError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{flowCreateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFlowSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Flow Name *</label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={newFlowCategory}
                  onChange={(e) => setNewFlowCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="General">General</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Analytics">Analytics</option>
                  <option value="Sales">Sales</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder=""
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFlowModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingFlow}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingFlow ? 'Creating...' : 'Create Flow'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONNECTED DATA SOURCES FOR THIS FLOW */}
      {flowDatasets.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-start sm:items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30 shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Connected Source for {currentFlow?.name || 'this Flow'}
                  </h4>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 uppercase whitespace-nowrap">
                    Stage Completed ({flowDatasets.length} {flowDatasets.length === 1 ? 'Dataset' : 'Datasets'})
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Source data is already ingested and staged in the lakehouse layer for this Flow.
                </p>
              </div>
            </div>

            <div className="flex items-center w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onNavigateToStep && onNavigateToStep(3)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>View Staged Lakehouse Data</span>
              </button>
            </div>
          </div>

          {/* DATASETS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {flowDatasets.map((ds) => {
              const cols = Array.isArray(ds.columns) ? ds.columns : [];
              return (
                <div 
                  key={ds.id}
                  className="p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block font-mono">
                          {ds.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          Dataset ID: {ds.id}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 uppercase border border-emerald-200 dark:border-emerald-800">
                      {ds.source_type || 'Database'}
                    </span>
                  </div>

                  {/* METRIC BADGES */}
                  <div className="grid grid-cols-3 gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800/60 text-center font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Rows Ingested</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        {(ds.row_count || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Columns</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                        {cols.length}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Stage Status</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                        READY
                      </strong>
                    </div>
                  </div>

                  {/* COLUMNS CHIPS PREVIEW */}
                  {cols.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block font-mono uppercase">
                        Ingested Schema Columns:
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {cols.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {typeof c === 'string' ? c : (c.name || c.column_name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 font-mono">
                    <span>Ingested: {new Date(ds.created_at || Date.now()).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => onNavigateToStep && onNavigateToStep(4)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-0.5"
                    >
                      <span>Go to Transform</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Need to connect another source table to this Flow? Configure below:</span>
          </div>
        </div>
      )}

      {/* 1. SOURCE ENGINE SELECTOR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {sourceEngines.map((engine) => {
          const Icon = engine.icon;
          const isActive = activeSource === engine.id;
          const count = savedConnections.filter((c) => c.source_type === engine.id).length;

          return (
            <button
              key={engine.id}
              type="button"
              onClick={() => handleSourceSelect(engine.id)}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 relative ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white border-slate-900 dark:border-sky-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span className="text-xs font-semibold">{engine.name}</span>
              {count > 0 && (
                <span className={`text-[9px] font-mono font-bold px-1.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                }`}>
                  {count} saved
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. SAVED CONNECTIONS FOR THIS SOURCE */}
      {savedConnections.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookmarkCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Saved {activeSource.toUpperCase()} Connections ({filteredSaved.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Click to load credentials</span>
          </div>

          {filteredSaved.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No saved connections for {activeSource.toUpperCase()} yet. Fill the form below and click "Save Connection".</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSaved.map((conn) => (
                <div
                  key={conn.id}
                  onClick={() => handleLoadSavedConnection(conn)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 dark:hover:border-sky-500 cursor-pointer transition-all flex flex-col justify-between group space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                      <Server className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {conn.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedConnection(conn.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0"
                      title="Delete saved connection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {conn.summary || 'Database connection'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-800/60 font-mono">
                    <span className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                      {conn.source_type}
                    </span>
                    <span className="text-sky-600 dark:text-sky-400 font-bold group-hover:underline">
                      Load & Connect →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. CONNECTION PARAMETERS FORM */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {activeSource.toUpperCase()} Connection Credentials & Ingestion Parameters
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Enter details to connect directly to your live data source or cloud storage.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveCurrentConnection}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 transition-colors"
            title="Save these connection credentials for 1-click re-use"
          >
            <Save className="w-3.5 h-3.5 text-sky-500" />
            <span>Save Connection</span>
          </button>
        </div>

        {/* Connection Name Field */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Connection Name (Label) *
          </label>
          <input
            type="text"
            placeholder="e.g. Production Analytics DB"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        {/* Database Config (PostgreSQL, MySQL, SQL Server) */}
        {['postgresql', 'mysql', 'sqlserver'].includes(activeSource) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Host / Server IP *</label>
                <input
                  type="text"
                  placeholder="localhost or db.company.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Port *</label>
                <input
                  type="number"
                  placeholder="3306"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Database Name *</label>
                <input
                  type="text"
                  placeholder="e.g. sales_db"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Table Selector (Checkboxes) or Custom SQL Switch */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setIsCustomSql(false)}
                  className={`text-xs font-semibold flex items-center space-x-1.5 pb-1 border-b-2 transition-all ${
                    !isCustomSql ? 'border-slate-900 text-slate-900 dark:border-sky-500 dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Select Table ({tablesList.length > 0 ? tablesList.length : 'Manual'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomSql(true)}
                  className={`text-xs font-semibold flex items-center space-x-1.5 pb-1 border-b-2 transition-all ${
                    isCustomSql ? 'border-slate-900 text-slate-900 dark:border-sky-500 dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Custom SQL Query</span>
                </button>
              </div>

              {!isCustomSql ? (
                <div className="space-y-2.5">
                  {tablesList.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Available Database Tables ({tablesList.length})
                        </label>

                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter tables..."
                            value={tableSearchTerm}
                            onChange={(e) => setTableSearchTerm(e.target.value)}
                            className="pl-7 pr-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-44 font-mono"
                          />
                        </div>
                      </div>

                      {/* Interactive Checkbox List of Tables */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        {filteredTables.map((tbl) => {
                          const isSelected = selectedTable === tbl;
                          return (
                            <div
                              key={tbl}
                              onClick={() => setSelectedTable(tbl)}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between select-none ${
                                isSelected
                                  ? 'bg-sky-50 border-sky-500 text-sky-950 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500 shadow-sm ring-1 ring-sky-500'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-mono text-xs font-semibold truncate">
                                  {tbl}
                                </span>
                              </div>

                              <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                TABLE
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {selectedTable && (
                        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold flex items-center space-x-1 pt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected Table for Extraction: <strong>{selectedTable}</strong></span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Target Table Name
                        </label>
                        <span className="text-[10px] text-slate-400">
                          (Click "Test & Fetch Tables" below to introspect database tables)
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. orders, users, transactions"
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom SQL Query</label>
                  <textarea
                    rows={3}
                    placeholder="SELECT id, amount, created_at FROM orders WHERE status = 'COMPLETED'"
                    value={customSql}
                    onChange={(e) => setCustomSql(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cloud AWS S3 Config */}
        {activeSource === 's3' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">S3 Bucket Name *</label>
              <input
                type="text"
                placeholder="my-production-lakehouse-bucket"
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Key Prefix / File Path *</label>
              <input
                type="text"
                placeholder="data/raw/sales.parquet"
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">AWS Access Key ID</label>
              <input
                type="text"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">AWS Secret Access Key</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* Azure ADLS Lakehouse Config */}
        {activeSource === 'azure' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Storage Account Name *</label>
              <input
                type="text"
                placeholder="datalakeprod"
                value={azureAccount}
                onChange={(e) => setAzureAccount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Container Name *</label>
              <input
                type="text"
                placeholder="bronze-lake"
                value={azureContainer}
                onChange={(e) => setAzureContainer(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Blob Path *</label>
              <input
                type="text"
                placeholder="telemetry/iot.parquet"
                value={azurePath}
                onChange={(e) => setAzurePath(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* File Upload Config */}
        {activeSource === 'upload' && (
          <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center space-y-3 bg-slate-50 dark:bg-slate-950">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Upload CSV, Parquet, or JSON dataset
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Directly stages and profiles raw user data files into the Lakehouse.
              </p>
            </div>
            <input
              type="file"
              accept=".csv,.parquet,.json,.txt"
              onChange={handleFileUpload}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white dark:file:bg-sky-500 cursor-pointer"
            />
            {uploadedFileInfo && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                ✓ Ready: {uploadedFileInfo.filename} ({(uploadedFileInfo.size_bytes / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        )}

        {/* Success / Test / Error Messages */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {testStatus && (
          <div
            className={`p-3 rounded-lg border flex items-start space-x-2 text-xs font-mono ${
              testStatus.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
            }`}
          >
            {testStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testStatus.success ? 'Connection Successful' : 'Connection Failed'}</p>
              <p className="text-[11px] opacity-90 mt-0.5">{testStatus.message}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons: Test Connection & Proceed to Schema Cast */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test & Fetch Tables'}</span>
          </button>

          <button
            type="button"
            onClick={handleInspect}
            disabled={inspecting}
            className="w-full sm:w-auto justify-center px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <span>{inspecting ? 'Profiling Schema...' : 'Inspect & Proceed to Schema'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
