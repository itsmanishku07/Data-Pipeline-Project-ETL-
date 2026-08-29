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
  Square,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  CornerDownRight
} from 'lucide-react';
import { DataFlowAPI, extractErrorMessage } from '../../services/api';

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

  // Cloud Azure Fields & Interactive Browser
  const [azureAccount, setAzureAccount] = useState('');
  const [azureContainer, setAzureContainer] = useState('');
  const [azurePath, setAzurePath] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [azureFormat, setAzureFormat] = useState('parquet');
  const [azurePrefix, setAzurePrefix] = useState('');
  const [azureFolders, setAzureFolders] = useState([]);
  const [azureFiles, setAzureFiles] = useState([]);
  const [azureBrowsing, setAzureBrowsing] = useState(false);
  const [azureExplorerOpen, setAzureExplorerOpen] = useState(false);
  const [azureSearchTerm, setAzureSearchTerm] = useState('');
  const [azureIsSimulated, setAzureIsSimulated] = useState(false);

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

  const handleBrowseAzure = async (targetPrefix = '') => {
    const acc = (azureAccount || '').trim();
    const cont = (azureContainer || '').trim();
    if (!acc) {
      setError('Please enter your Azure Storage Account Name.');
      return;
    }
    if (!cont) {
      setError('Please enter your Azure Container Name.');
      return;
    }

    setAzureBrowsing(true);
    setError(null);
    try {
      const res = await DataFlowAPI.browseAzureContainer({
        account_name: acc,
        container_name: cont,
        account_key: azureKey.trim() || undefined,
        prefix: targetPrefix,
      });
      setAzureFolders(res.folders || []);
      setAzureFiles(res.files || []);
      setAzurePrefix(res.current_prefix || '');
      setAzureExplorerOpen(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to browse Azure Lakehouse'));
    } finally {
      setAzureBrowsing(false);
    }
  };

  const handleSelectAzureFile = (file) => {
    setAzurePath(file.path);
    const fmt = (file.format || '').toLowerCase();
    if (['parquet', 'delta', 'csv', 'json'].includes(fmt)) {
      setAzureFormat(fmt);
    } else if (file.path.endsWith('.parquet')) {
      setAzureFormat('parquet');
    } else if (file.path.endsWith('.csv')) {
      setAzureFormat('csv');
    } else if (file.path.endsWith('.json')) {
      setAzureFormat('json');
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
          file_format: azureFormat,
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
        config = { azureAccount, azureContainer, azurePath, azureKey, azureFormat };
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
      setError(extractErrorMessage(err, 'Failed to save connection'));
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
      setAzureFormat(cfg.azureFormat || 'parquet');
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center max-w-lg mx-auto space-y-4 shadow-xs animate-fadeIn my-8">
        <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center mx-auto">
          <GitBranch className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Create a Data Flow First
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            Every data source, schema, staging table, and transformation is isolated inside a Data Flow.
          </p>
        </div>

        {flowCreateError && (
          <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{flowCreateError}</span>
          </div>
        )}

        <form onSubmit={handleCreateFlowSubmit} className="space-y-3 text-left p-4 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Flow Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sales Revenue Pipeline"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
              <select
                value={newFlowCategory}
                onChange={(e) => setNewFlowCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={newFlowDesc}
                onChange={(e) => setNewFlowDesc(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creatingFlow}
            className="w-full py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creatingFlow ? 'Creating Flow...' : 'Create Flow & Select Source'}</span>
          </button>
        </form>

        {flows.length > 0 && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center space-x-2 text-xs">
            <span className="text-zinc-500">Or select an existing flow:</span>
            <select
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-medium text-zinc-900 dark:text-zinc-100"
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
    <div className="space-y-5 animate-fadeIn">
      {/* TARGET FLOW BAR */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <GitBranch className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400 font-medium">Target Flow:</span>
              <strong className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{currentFlow?.name || 'Active Flow'}</strong>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {currentFlow?.category || 'General'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={activeFlowId || ''}
            onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
            className="flex-1 sm:flex-none px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-900 dark:text-zinc-100 rounded-md border border-zinc-200 dark:border-zinc-800 focus:outline-none min-w-0 truncate"
          >
            {flows.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.category || 'General'})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCreateFlowModal(true)}
            className="shrink-0 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1 transition-colors shadow-xs"
            title="Create New Flow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Flow</span>
          </button>
        </div>
      </div>

      {/* CREATE FLOW MODAL */}
      {showCreateFlowModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-xl space-y-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create New Flow & Select Source</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateFlowModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flowCreateError && (
              <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{flowCreateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFlowSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Flow Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Revenue Pipeline"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                <select
                  value={newFlowCategory}
                  onChange={(e) => setNewFlowCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional flow notes..."
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFlowModal(false)}
                  className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingFlow}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1 shadow-xs transition-colors disabled:opacity-50"
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-3.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Connected Source for {currentFlow?.name || 'this Flow'}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    {flowDatasets.length} {flowDatasets.length === 1 ? 'Dataset' : 'Datasets'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Source data is ingested and staged in the lakehouse layer.
                </p>
              </div>
            </div>

            <div className="flex items-center w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onNavigateToStep && onNavigateToStep(3)}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
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
                  className="p-3.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block font-mono">
                          {ds.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                          ID: {ds.id}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {ds.source_type || 'Database'}
                    </span>
                  </div>

                  {/* METRIC BADGES */}
                  <div className="grid grid-cols-3 gap-2 p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200/80 dark:border-zinc-800/80 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">ROWS</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-medium">
                        {(ds.row_count || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">COLUMNS</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-medium">
                        {cols.length}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">STATUS</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-medium">
                        READY
                      </strong>
                    </div>
                  </div>

                  {/* COLUMNS CHIPS PREVIEW */}
                  {cols.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-zinc-400 block font-mono uppercase">
                        Columns:
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {cols.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800"
                          >
                            {typeof c === 'string' ? c : (c.name || c.column_name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 font-mono">
                    <span>Ingested: {new Date(ds.created_at || Date.now()).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={() => onNavigateToStep && onNavigateToStep(4)}
                      className="text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline flex items-center space-x-0.5"
                    >
                      <span>Transform</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
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
              className={`p-3 rounded-lg border text-center transition-colors flex flex-col items-center justify-center space-y-1.5 relative ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'}`} />
              <span className="text-xs font-medium">{engine.name}</span>
              {count > 0 && (
                <span className={`text-[10px] font-mono px-1.5 rounded ${
                  isActive ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookmarkCheck className="w-4 h-4 text-zinc-500" />
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Saved {activeSource.toUpperCase()} Connections ({filteredSaved.length})
              </h4>
            </div>
            <span className="text-xs text-zinc-400">Click to load</span>
          </div>

          {filteredSaved.length === 0 ? (
            <p className="text-xs text-zinc-400 py-1">No saved connections for {activeSource.toUpperCase()} yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredSaved.map((conn) => (
                <div
                  key={conn.id}
                  onClick={() => handleLoadSavedConnection(conn)}
                  className="p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-colors flex flex-col justify-between group space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                      <Server className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {conn.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedConnection(conn.id, e)}
                      className="text-zinc-400 hover:text-red-600 p-0.5 shrink-0 transition-colors"
                      title="Delete saved connection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                    {conn.summary || 'Database connection'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 font-mono">
                    <span className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase">
                      {conn.source_type}
                    </span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium group-hover:underline">
                      Load →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. CONNECTION PARAMETERS FORM */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              {activeSource.toUpperCase()} Connection & Extraction
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Enter credentials to connect to your live data source or storage.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveCurrentConnection}
            className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5 transition-colors"
            title="Save connection for re-use"
          >
            <Save className="w-3.5 h-3.5 text-zinc-500" />
            <span>Save</span>
          </button>
        </div>

        {/* Connection Name Field */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Connection Name (Label) *
          </label>
          <input
            type="text"
            placeholder="e.g. Production Analytics DB"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-sans"
          />
        </div>

        {/* Database Config (PostgreSQL, MySQL, SQL Server) */}
        {['postgresql', 'mysql', 'sqlserver'].includes(activeSource) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Host / Server IP *</label>
                <input
                  type="text"
                  placeholder="localhost or db.company.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Port *</label>
                <input
                  type="number"
                  placeholder="3306"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Database Name *</label>
                <input
                  type="text"
                  placeholder="e.g. sales_db"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>
            </div>

            {/* Table Selector (Checkboxes) or Custom SQL Switch */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setIsCustomSql(false)}
                  className={`text-xs font-medium flex items-center space-x-1.5 pb-1 border-b-2 transition-colors ${
                    !isCustomSql ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Select Table ({tablesList.length > 0 ? tablesList.length : 'Manual'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomSql(true)}
                  className={`text-xs font-medium flex items-center space-x-1.5 pb-1 border-b-2 transition-colors ${
                    isCustomSql ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Available Database Tables ({tablesList.length})
                        </label>

                        <div className="relative">
                          <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter tables..."
                            value={tableSearchTerm}
                            onChange={(e) => setTableSearchTerm(e.target.value)}
                            className="pl-7 pr-2.5 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-44 font-mono"
                          />
                        </div>
                      </div>

                      {/* Interactive Checkbox List of Tables */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-zinc-50/50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800">
                        {filteredTables.map((tbl) => {
                          const isSelected = selectedTable === tbl;
                          return (
                            <div
                              key={tbl}
                              onClick={() => setSelectedTable(tbl)}
                              className={`p-2.5 rounded-md border cursor-pointer transition-colors flex items-center justify-between select-none ${
                                isSelected
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-white dark:text-zinc-900 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                                )}
                                <span className="font-mono text-xs font-medium truncate">
                                  {tbl}
                                </span>
                              </div>

                              <span className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded shrink-0 ${
                                isSelected ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}>
                                TABLE
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {selectedTable && (
                        <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1 pt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected Table: <strong>{selectedTable}</strong></span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Target Table Name
                        </label>
                        <span className="text-[11px] text-zinc-400">
                          (Click "Test & Fetch Tables" below)
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. orders, users, transactions"
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Custom SQL Query</label>
                  <textarea
                    rows={3}
                    placeholder="SELECT id, amount, created_at FROM orders WHERE status = 'COMPLETED'"
                    value={customSql}
                    onChange={(e) => setCustomSql(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">S3 Bucket Name *</label>
              <input
                type="text"
                placeholder="my-production-lakehouse-bucket"
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Key Prefix / File Path *</label>
              <input
                type="text"
                placeholder="data/raw/sales.parquet"
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">AWS Access Key ID</label>
              <input
                type="text"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">AWS Secret Access Key</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* Azure ADLS Lakehouse Config */}
        {activeSource === 'azure' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Storage Account Name *</label>
                <input
                  type="text"
                  placeholder=""
                  value={azureAccount}
                  onChange={(e) => setAzureAccount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Container Name *</label>
                <input
                  type="text"
                  placeholder=""
                  value={azureContainer}
                  onChange={(e) => setAzureContainer(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Account Key / SAS Token</label>
                <input
                  type="password"
                  placeholder="Key, SAS token, or Conn String"
                  value={azureKey}
                  onChange={(e) => setAzureKey(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                />
              </div>
            </div>

            {/* Interactive Browse Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                  {azureExplorerOpen ? 'Container File Explorer Active' : 'Live Azure Storage Container Explorer'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleBrowseAzure('')}
                disabled={azureBrowsing}
                className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {azureBrowsing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting to Azure...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>{azureExplorerOpen ? 'Refresh Explorer' : 'Test & Fetch Live Files'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Visual Azure Lakehouse File Explorer */}
            {azureExplorerOpen && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3.5 animate-fadeIn">
                {/* Breadcrumbs Navigation & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="flex items-center flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleBrowseAzure('')}
                      className={`px-2 py-1 rounded font-mono font-medium transition-colors ${
                        !azurePrefix 
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' 
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      root ({azureContainer || 'container'})
                    </button>

                    {azurePrefix.split('/').filter(Boolean).map((part, idx, arr) => {
                      const partialPath = arr.slice(0, idx + 1).join('/') + '/';
                      const isLast = idx === arr.length - 1;
                      return (
                        <React.Fragment key={partialPath}>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <button
                            type="button"
                            onClick={() => handleBrowseAzure(partialPath)}
                            className={`px-2 py-1 rounded font-mono font-medium transition-colors ${
                              isLast 
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' 
                                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {part}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Filter files..."
                      value={azureSearchTerm}
                      onChange={(e) => setAzureSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>

                {/* Sub-Folders List */}
                {azureFolders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Folders ({azureFolders.filter(f => !azureSearchTerm || f.name.toLowerCase().includes(azureSearchTerm.toLowerCase())).length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {azureFolders
                        .filter(f => !azureSearchTerm || f.name.toLowerCase().includes(azureSearchTerm.toLowerCase()))
                        .map((folder) => (
                          <div
                            key={folder.path}
                            onClick={() => handleBrowseAzure(folder.path)}
                            className="p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-colors flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <Folder className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                              <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {folder.name}
                              </span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0" />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Files List */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Files ({azureFiles.filter(f => !azureSearchTerm || f.name.toLowerCase().includes(azureSearchTerm.toLowerCase())).length})
                  </p>
                  
                  {azureFiles.filter(f => !azureSearchTerm || f.name.toLowerCase().includes(azureSearchTerm.toLowerCase())).length === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-2">No files found in this directory path.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {azureFiles
                        .filter(f => !azureSearchTerm || f.name.toLowerCase().includes(azureSearchTerm.toLowerCase()))
                        .map((file) => {
                          const isSelected = azurePath === file.path;
                          const sizeKb = file.size_bytes ? (file.size_bytes / 1024).toFixed(1) + ' KB' : '—';
                          return (
                            <div
                              key={file.path}
                              onClick={() => handleSelectAzureFile(file)}
                              className={`p-2.5 rounded-md border cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-white dark:text-zinc-900 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                                )}
                                <FileText className="w-4 h-4 shrink-0 opacity-70" />
                                <span className="font-mono text-xs font-medium truncate">
                                  {file.name}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="text-[10px] font-mono opacity-60">
                                  {sizeKb}
                                </span>
                                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                                  isSelected 
                                    ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' 
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                }`}>
                                  {file.format || 'PARQUET'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selected File Confirmation Badge */}
            {azurePath ? (
              <div className="p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs font-mono text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center space-x-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Selected Source: <strong>abfss://{azureContainer || 'container'}@{azureAccount || 'account'}.dfs.core.windows.net/{azurePath}</strong>
                  </span>
                </div>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 shrink-0 ml-2">
                  {azureFormat}
                </span>
              </div>
            ) : (
              azureExplorerOpen && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  Click on any file in the explorer above to select it as the pipeline source.
                </p>
              )
            )}
          </div>
        )}

        {/* File Upload Config */}
        {activeSource === 'upload' && (
          <div className="p-6 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg text-center space-y-3 bg-zinc-50 dark:bg-zinc-950">
            <Upload className="w-8 h-8 text-zinc-400 mx-auto" />
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Upload CSV, Parquet, or JSON dataset
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Directly stages and profiles raw data files into the Lakehouse.
              </p>
            </div>
            <input
              type="file"
              accept=".csv,.parquet,.json,.txt"
              onChange={handleFileUpload}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-900 file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900 cursor-pointer"
            />
            {uploadedFileInfo && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                ✓ Ready: {uploadedFileInfo.filename} ({(uploadedFileInfo.size_bytes / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        )}

        {/* Messages */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-md text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {testStatus && (
          <div
            className={`p-3 rounded-md border flex items-start space-x-2 text-xs font-mono ${
              testStatus.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40'
            }`}
          >
            {testStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testStatus.success ? 'Connection Successful' : 'Connection Failed'}</p>
              <p className="text-[11px] opacity-90 mt-0.5">{testStatus.message}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-md text-red-700 dark:text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons: Test Connection & Proceed to Schema Cast */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test & Fetch Tables'}</span>
          </button>

          <button
            type="button"
            onClick={handleInspect}
            disabled={inspecting}
            className="w-full sm:w-auto justify-center px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <span>{inspecting ? 'Profiling Schema...' : 'Inspect & Cast Schema'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
