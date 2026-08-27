import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  Layers, 
  Download, 
  Terminal, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Cloud, 
  HardDrive, 
  Server, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Zap, 
  BookmarkCheck, 
  PlusCircle, 
  FolderCheck, 
  History, 
  FileCode, 
  Sliders, 
  Search, 
  ExternalLink,
  GitBranch,
  Sparkles,
  ChevronRight,
  Info,
  Calendar,
  ListOrdered,
  Check,
  X,
  Tag
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';

export const PipelineExecutionView = ({
  stagedDataset = null,
  rules = [],
  flows = [],
  activeFlowId = null,
  allStagedDatasets = [],
  onSelectFlow = null,
  onViewStagedDataset,
  onRestartPipeline,
}) => {
  // Main View Mode: 'runner' (Configure & Run) | 'history' (Executed Pipelines Hub)
  const [viewMode, setViewMode] = useState('runner');
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [viewingFlowDetails, setViewingFlowDetails] = useState(null);

  // Sort flows strictly by creation order (earliest created to newest)
  const sortedFlows = [...flows].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });

  // Selected Flow & Dataset State
  const initialFlowId = stagedDataset?.flow_id || activeFlowId || (sortedFlows.length > 0 ? sortedFlows[0].id : '');
  const [selectedFlowId, setSelectedFlowId] = useState(initialFlowId);
  const [effectiveDataset, setEffectiveDataset] = useState(stagedDataset || null);
  const [effectiveRules, setEffectiveRules] = useState(rules || []);
  const [loadingFlowData, setLoadingFlowData] = useState(false);

  // Pipeline Output Configuration State
  const [pipelineName, setPipelineName] = useState('');
  const [outputDatasetName, setOutputDatasetName] = useState('');
  const [exportFormat, setExportFormat] = useState('parquet');
  const [stageOutput, setStageOutput] = useState(true);

  // Destination Type: 'lakehouse', 'database', 's3', 'azure'
  const [destinationType, setDestinationType] = useState('database');

  // Database Destination Settings
  const [dbType, setDbType] = useState('mysql');
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPort, setDbPort] = useState(3306);
  const [dbName, setDbName] = useState('');
  const [dbSchema, setDbSchema] = useState('public');
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbTable, setDbTable] = useState('');
  const [dbWriteMode, setDbWriteMode] = useState('replace');
  const [createDbIfNotExists, setCreateDbIfNotExists] = useState(true);
  const [createSchemaIfNotExists, setCreateSchemaIfNotExists] = useState(true);

  // S3 Destination Settings
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Key, setS3Key] = useState('');
  const [s3Format, setS3Format] = useState('parquet');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');

  // Azure Destination Settings
  const [azureAccount, setAzureAccount] = useState('');
  const [azureContainer, setAzureContainer] = useState('');
  const [azurePath, setAzurePath] = useState('');
  const [azureKey, setAzureKey] = useState('');

  // Saved Connections
  const [savedConnections, setSavedConnections] = useState([]);
  const [selectedSavedConnId, setSelectedSavedConnId] = useState('');

  // Destination Test Status
  const [testingDest, setTestingDest] = useState(false);
  const [destTestResult, setDestTestResult] = useState(null);

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [jobHistory, setJobHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Determine current active flow object
  const currentFlow = flows.find((f) => f.id === selectedFlowId) || null;

  // Filter datasets belonging strictly to selected flow
  const flowDatasets = selectedFlowId 
    ? allStagedDatasets.filter((d) => d.flow_id === selectedFlowId)
    : allStagedDatasets;

  // Sync flow and load its datasets and saved rules when selectedFlowId changes
  useEffect(() => {
    if (!selectedFlowId) return;

    setLoadingFlowData(true);
    // 1. Load flow rules from DB
    DataFlowAPI.getFlowRules(selectedFlowId)
      .then((res) => {
        if (res && Array.isArray(res.rules)) {
          setEffectiveRules(res.rules);
        }
      })
      .catch((err) => console.error('Failed to load rules for flow', err))
      .finally(() => setLoadingFlowData(false));

    // 2. Determine best staged dataset strictly for this flow
    const matchingDatasets = allStagedDatasets.filter((d) => d.flow_id === selectedFlowId);
    if (matchingDatasets.length > 0) {
      setEffectiveDataset(matchingDatasets[0]);
    } else {
      setEffectiveDataset(null);
    }
    loadJobHistory(selectedFlowId);
  }, [selectedFlowId, allStagedDatasets]);

  // Update pipeline names whenever effectiveDataset changes
  useEffect(() => {
    const dsName = effectiveDataset?.name || currentFlow?.name || 'data';
    setPipelineName(`${dsName}_pipeline`);
    setOutputDatasetName(`curated_${dsName}`);
    setDbTable(`${dsName}_gold`);
    setS3Key(`curated/${dsName}.parquet`);
    setAzurePath(`${dsName}.parquet`);
  }, [effectiveDataset, currentFlow]);

  useEffect(() => {
    DataFlowAPI.getSavedConnections()
      .then(setSavedConnections)
      .catch((err) => console.error('Failed to load saved connections', err));
    loadJobHistory(selectedFlowId);
  }, []);

  const loadJobHistory = async (flowId = null) => {
    try {
      const targetFid = flowId || selectedFlowId;
      const jobs = await DataFlowAPI.listJobs(targetFid || null);
      setJobHistory(jobs);
    } catch (err) {
      console.error('Job list error', err);
    }
  };

  const handleFlowChange = (newFlowId) => {
    setSelectedFlowId(newFlowId);
    if (onSelectFlow) {
      onSelectFlow(newFlowId);
    }
  };

  const handleDatasetChange = (datasetId) => {
    const found = allStagedDatasets.find((d) => d.id === datasetId);
    if (found) {
      setEffectiveDataset(found);
    }
  };

  const handleDbTypeChange = (type) => {
    setDbType(type);
    setDestTestResult(null);
    if (type === 'mysql') {
      setDbPort(3306);
      setDbUser('root');
      setDbPassword('3435');
    } else if (type === 'postgresql') {
      setDbPort(5432);
      setDbUser('postgres');
      setDbPassword('');
    } else if (type === 'sqlserver') {
      setDbPort(1433);
      setDbUser('sa');
      setDbPassword('');
    }
  };

  const handleApplySavedConnection = (connId) => {
    setSelectedSavedConnId(connId);
    if (!connId) return;
    const conn = savedConnections.find((c) => c.id === connId);
    if (!conn) return;

    if (['mysql', 'postgresql', 'sqlserver'].includes(conn.source_type)) {
      setDestinationType('database');
      setDbType(conn.source_type);
      const cfg = conn.config || {};
      setDbHost(cfg.host || 'localhost');
      setDbPort(cfg.port || (conn.source_type === 'mysql' ? 3306 : 5432));
      setDbName(cfg.dbName || 'analytics_warehouse');
      setDbUser(cfg.username || 'root');
      setDbPassword(cfg.password || '');
    } else if (conn.source_type === 's3') {
      setDestinationType('s3');
      const cfg = conn.config || {};
      setS3Bucket(cfg.s3Bucket || 'my-analytics-lakehouse');
      setS3Key(cfg.s3Key || `curated/${effectiveDataset?.name || 'data'}.parquet`);
      setS3Region(cfg.s3Region || 'us-east-1');
      setS3AccessKey(cfg.s3AccessKey || '');
      setS3SecretKey(cfg.s3SecretKey || '');
    } else if (conn.source_type === 'azure') {
      setDestinationType('azure');
      const cfg = conn.config || {};
      setAzureAccount(cfg.azureAccount || 'datalakeprod');
      setAzureContainer(cfg.azureContainer || 'curated');
      setAzurePath(cfg.azurePath || `${effectiveDataset?.name || 'data'}.parquet`);
      setAzureKey(cfg.azureKey || '');
    }
  };

  const buildDestinationRequest = () => {
    if (destinationType === 'database') {
      return {
        destination_type: 'database',
        database_dest: {
          db_type: dbType,
          host: dbHost.trim(),
          port: Number(dbPort),
          database: dbName.trim(),
          schema_name: dbType === 'postgresql' || dbType === 'sqlserver' ? dbSchema.trim() : undefined,
          username: dbUser.trim() || undefined,
          password: dbPassword || undefined,
          table_name: dbTable.trim(),
          write_mode: dbWriteMode,
          create_database_if_not_exists: createDbIfNotExists,
          create_schema_if_not_exists: createSchemaIfNotExists,
        },
      };
    } else if (destinationType === 's3') {
      return {
        destination_type: 's3',
        s3_dest: {
          bucket: s3Bucket.trim(),
          key_prefix: s3Key.trim(),
          region: s3Region.trim(),
          access_key: s3AccessKey.trim() || undefined,
          secret_key: s3SecretKey.trim() || undefined,
          file_format: s3Format,
        },
      };
    } else if (destinationType === 'azure') {
      return {
        destination_type: 'azure',
        azure_dest: {
          account_name: azureAccount.trim(),
          container_name: azureContainer.trim(),
          path: azurePath.trim(),
          account_key: azureKey.trim() || undefined,
          file_format: 'parquet',
        },
      };
    }
    return {
      destination_type: 'lakehouse',
    };
  };

  const handleTestDestination = async () => {
    setTestingDest(true);
    setDestTestResult(null);
    try {
      const destReq = buildDestinationRequest();
      const res = await DataFlowAPI.testDestination(destReq);
      setDestTestResult(res);
    } catch (err) {
      setDestTestResult({
        success: false,
        message: err?.response?.data?.detail || err.message || 'Destination test failed',
      });
    } finally {
      setTestingDest(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!effectiveDataset) {
      setErrorMsg('Please select a staged dataset to execute the pipeline DAG.');
      return;
    }
    setExecuting(true);
    setErrorMsg(null);
    try {
      const destConfig = buildDestinationRequest();

      const req = {
        name: pipelineName,
        staging_dataset_id: effectiveDataset.id,
        rules: effectiveRules.filter((r) => r.enabled),
        output_dataset_name: outputDatasetName,
        output_description: `Curated via ${effectiveRules.filter((r) => r.enabled).length} Spark rules into ${destinationType.toUpperCase()}`,
        flow_id: selectedFlowId,
        stage_output: stageOutput,
        export_format: exportFormat,
        destination_config: destConfig,
      };

      const job = await DataFlowAPI.executePipeline(req);
      setActiveJob(job);
      loadJobHistory(selectedFlowId);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Pipeline execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const filteredHistory = jobHistory.filter((j) => {
    if (!historySearchTerm.trim()) return true;
    const term = historySearchTerm.toLowerCase();
    return j.name.toLowerCase().includes(term) || j.id.toLowerCase().includes(term) || (j.status && j.status.toLowerCase().includes(term));
  });

  // ==========================================
  // VIEW: DEDICATED PIPELINE JOB DETAILS PAGE
  // ==========================================
  if (selectedJobDetails) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm transition-colors">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setSelectedJobDetails(null)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Pipeline Hub</span>
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  selectedJobDetails.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400'
                }`}>
                  {selectedJobDetails.status}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedJobDetails.name}</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Job ID: {selectedJobDetails.id} • Executed: {new Date(selectedJobDetails.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {selectedJobDetails.output_dataset_id && (
              <button
                type="button"
                onClick={() => onViewStagedDataset(selectedJobDetails.output_dataset_id)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <FolderCheck className="w-3.5 h-3.5" />
                <span>Inspect Staged Lakehouse Table</span>
              </button>
            )}

            {selectedJobDetails.output_file_path && (
              <a
                href={DataFlowAPI.getExportDownloadUrl(selectedJobDetails.output_file_path.split('\\').pop().split('/').pop())}
                download
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </a>
            )}
          </div>
        </div>

        {/* Metrics Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Input Data Rows</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {selectedJobDetails.input_rows.toLocaleString()}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Transformed Output Rows</span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {selectedJobDetails.output_rows.toLocaleString()}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Execution Status</span>
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400 font-mono mt-0.5 uppercase">
              {selectedJobDetails.status}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Completed At</span>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
              {selectedJobDetails.completed_at ? new Date(selectedJobDetails.completed_at).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Full Terminal Execution Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3 transition-colors">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Full Pipeline DAG Execution & Destination Logs
            </h4>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-96 overflow-y-auto border border-slate-800">
            {selectedJobDetails.logs && selectedJobDetails.logs.map((log, i) => {
              let color = 'text-slate-300';
              if (log.includes('SUCCESS') || log.includes('Loaded')) color = 'text-emerald-400 font-semibold';
              else if (log.includes('DESTINATION')) color = 'text-sky-400 font-semibold';
              else if (log.includes('Warning') || log.includes('WARN')) color = 'text-amber-400';
              else if (log.includes('Error') || log.includes('failed')) color = 'text-rose-400 font-semibold';

              return (
                <div key={i} className={`leading-relaxed ${color}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Main Navigation Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30 shrink-0">
            <PlayCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Pipeline Execution & Destination Loader
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Execute transformation DAGs and export curated data directly to MySQL, PostgreSQL, S3, or Azure.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('runner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'runner' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ⚡ Run Pipeline
          </button>

          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
              viewMode === 'history' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Saved Executions ({jobHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ==========================================
          TAB 1: RUN PIPELINE WORKSPACE
          ========================================== */}
      {viewMode === 'runner' && (
        <div className="space-y-6">
          {/* FLOW & STAGED DATASET SELECTION CARD */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-md border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Select Data Flow & Staged Dataset to Load
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Showing all {sortedFlows.length} Data Flows in Chronological Creation Order
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>{effectiveRules.filter((r) => r.enabled).length} Saved Spark Rules Active</span>
                </span>
              </div>
            </div>

            {/* Chronological Flows List Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Available Data Flows ({sortedFlows.length})</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Sorted by Creation Order (#1 to #{sortedFlows.length})</span>
              </div>

              {sortedFlows.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 font-mono">
                  No data flows found in metadata catalog.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {sortedFlows.map((flow, index) => {
                    const isSelected = flow.id === selectedFlowId;
                    const flowRulesCount = Array.isArray(flow.rules) ? flow.rules.length : 0;
                    const creationDate = flow.created_at 
                      ? new Date(flow.created_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Initial Flow';

                    return (
                      <div
                        key={flow.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                          isSelected
                            ? 'bg-indigo-950/80 border-sky-400 ring-1 ring-sky-400/50 shadow-md'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                                #{index + 1}
                              </span>
                              <span className="font-bold text-xs text-white truncate" title={flow.name}>
                                {flow.name}
                              </span>
                            </div>

                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                              {flow.category || 'General'}
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-1 font-sans">
                            {flow.description || 'Enterprise Lakehouse Flow'}
                          </p>

                          <div className="flex items-center space-x-1 text-[9px] font-mono text-slate-400 mt-1.5">
                            <Calendar className="w-2.5 h-2.5 text-slate-500" />
                            <span className="truncate">{creationDate}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-emerald-400 font-semibold">{flow.dataset_count || 0} Sets</span>
                            <span>•</span>
                            <span className="text-sky-300 font-semibold">{flowRulesCount} Rules</span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingFlowDetails(flow)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-bold flex items-center space-x-1 transition-colors"
                              title="View Flow Details"
                            >
                              <Info className="w-3 h-3 text-sky-400" />
                              <span>Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleFlowChange(flow.id)}
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all ${
                                isSelected
                                  ? 'bg-sky-500 text-white shadow-sm'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3 h-3 text-white" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>Select</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Staged Dataset Selector for Selected Flow */}
            <div className="pt-2 border-t border-white/10">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Staged Lakehouse Dataset (Attached to Selected Flow "{currentFlow?.name || selectedFlowId}")
              </label>
              <select
                value={effectiveDataset?.id || ''}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              >
                {flowDatasets.length === 0 ? (
                  <option value="">No staged datasets found in this flow</option>
                ) : (
                  flowDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count?.toLocaleString()} rows • {d.column_count} cols)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Visual DAG Execution Sequence Preview */}
            {effectiveDataset && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 flex items-center space-x-1">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>Input: <strong>{effectiveDataset.name}</strong> ({effectiveDataset.row_count?.toLocaleString()} rows)</span>
                </span>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-sky-300 flex items-center space-x-1">
                  <Sliders className="w-3 h-3 text-sky-400" />
                  <span>DAG: <strong>{effectiveRules.filter((r) => r.enabled).length} Transform Rules</strong></span>
                </span>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300 flex items-center space-x-1">
                  <Server className="w-3 h-3 text-amber-400" />
                  <span>Dest: <strong className="uppercase">{destinationType}</strong> ({destinationType === 'database' ? dbTable : (destinationType === 's3' ? s3Bucket : outputDatasetName)})</span>
                </span>
              </div>
            )}
          </div>

          {/* Destination & Output Configuration Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-sky-500" />
                  <span>Configure Target Export Destination & Output</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Select destination engine, define schema/table creation options, and execute the DAG.
                </p>
              </div>

              {savedConnections.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-slate-400 font-mono">Preset:</span>
                  <select
                    value={selectedSavedConnId}
                    onChange={(e) => handleApplySavedConnection(e.target.value)}
                    className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <option value="">-- Load Saved Connection --</option>
                    {savedConnections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.source_type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* General Output Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Pipeline Name</label>
                <input
                  type="text"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Curated Stage Name</label>
                <input
                  type="text"
                  value={outputDatasetName}
                  onChange={(e) => setOutputDatasetName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Export File Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                >
                  <option value="parquet">Apache Parquet</option>
                  <option value="csv">CSV File</option>
                  <option value="json">JSON Records</option>
                </select>
              </div>
            </div>

            {/* Destination Type Tabs */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Destination Engine
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => { setDestinationType('database'); setDestTestResult(null); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                    destinationType === 'database'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white border-slate-900 dark:border-sky-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-semibold">Relational Database</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setDestinationType('lakehouse'); setDestTestResult(null); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                    destinationType === 'lakehouse'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white border-slate-900 dark:border-sky-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  <span className="text-xs font-semibold">Lakehouse Staging</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setDestinationType('s3'); setDestTestResult(null); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                    destinationType === 's3'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white border-slate-900 dark:border-sky-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span className="text-xs font-semibold">AWS S3 Lake</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setDestinationType('azure'); setDestTestResult(null); }}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                    destinationType === 'azure'
                      ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white border-slate-900 dark:border-sky-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span className="text-xs font-semibold">Azure ADLS Blob</span>
                </button>
              </div>

              {/* Dynamic Destination Configuration Forms */}
              {destinationType === 'database' && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Engine</label>
                      <select
                        value={dbType}
                        onChange={(e) => handleDbTypeChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value="mysql">MySQL Flexible Server</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="sqlserver">Microsoft SQL Server</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Host / Server</label>
                      <input
                        type="text"
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Database Name</label>
                      <input
                        type="text"
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Password</label>
                      <input
                        type="password"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Table Name</label>
                      <input
                        type="text"
                        value={dbTable}
                        onChange={(e) => setDbTable(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Write Mode</label>
                      <select
                        value={dbWriteMode}
                        onChange={(e) => setDbWriteMode(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                      >
                        <option value="replace">REPLACE (Overwrite Table)</option>
                        <option value="append">APPEND (Insert Rows)</option>
                        <option value="fail">FAIL IF EXISTS</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center space-x-4 text-xs text-slate-600 dark:text-slate-400">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createDbIfNotExists}
                          onChange={(e) => setCreateDbIfNotExists(e.target.checked)}
                          className="rounded text-sky-600"
                        />
                        <span>Auto-create Database if not exists</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestDestination}
                      disabled={testingDest}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 ${testingDest ? 'animate-spin text-amber-500' : 'text-amber-500'}`} />
                      <span>{testingDest ? 'Testing Destination...' : 'Test Destination Connection'}</span>
                    </button>
                  </div>
                </div>
              )}

              {destinationType === 's3' && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">S3 Bucket</label>
                      <input
                        type="text"
                        value={s3Bucket}
                        onChange={(e) => setS3Bucket(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Object Key Prefix</label>
                      <input
                        type="text"
                        value={s3Key}
                        onChange={(e) => setS3Key(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">AWS Region</label>
                      <input
                        type="text"
                        value={s3Region}
                        onChange={(e) => setS3Region(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {destinationType === 'azure' && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Storage Account</label>
                      <input
                        type="text"
                        value={azureAccount}
                        onChange={(e) => setAzureAccount(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Blob Container</label>
                      <input
                        type="text"
                        value={azureContainer}
                        onChange={(e) => setAzureContainer(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Blob Path</label>
                      <input
                        type="text"
                        value={azurePath}
                        onChange={(e) => setAzurePath(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Destination Test Feedback */}
              {destTestResult && (
                <div className={`p-3 rounded-lg border text-xs font-mono flex items-start space-x-2 ${
                  destTestResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
                }`}>
                  {destTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{destTestResult.success ? 'Destination Ready' : 'Destination Notice'}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{destTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Run Button */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={handleRunPipeline}
                disabled={executing || !pipelineName.trim() || !effectiveDataset}
                className="w-full sm:w-auto justify-center px-6 py-3 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-2 shadow-md transition-all disabled:opacity-50"
              >
                <PlayCircle className={`w-4 h-4 ${executing ? 'animate-spin' : ''}`} />
                <span>{executing ? 'Executing Spark DAG & Loading Target...' : 'Run Pipeline & Load Destination'}</span>
              </button>
            </div>
          </div>

          {/* Live Terminal Logs & Execution Monitor */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-sky-500 shrink-0" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                  Live DAG Execution & Destination Monitor
                </h4>
              </div>

              {activeJob && (
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                    activeJob.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 animate-pulse'
                  }`}>
                    {activeJob.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedJobDetails(activeJob)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1"
                  >
                    <span>Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Active Execution Metrics Banner */}
            {activeJob && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Input Rows</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">{activeJob.input_rows.toLocaleString()}</p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Loaded Output</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{activeJob.output_rows.toLocaleString()}</p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Destination</span>
                  <p className="text-xs font-bold text-sky-600 dark:text-sky-400 font-mono mt-1 uppercase">{destinationType}</p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Curated ID</span>
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">{activeJob.output_dataset_id || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Terminal Log Viewer */}
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 min-h-[220px] max-h-[350px] overflow-y-auto border border-slate-800">
              {activeJob && activeJob.logs && activeJob.logs.length > 0 ? (
                activeJob.logs.map((log, i) => {
                  let color = 'text-slate-300';
                  if (log.includes('SUCCESS') || log.includes('Loaded')) color = 'text-emerald-400 font-semibold';
                  else if (log.includes('DESTINATION')) color = 'text-sky-400 font-semibold';
                  else if (log.includes('Warning') || log.includes('WARN')) color = 'text-amber-400';
                  else if (log.includes('Error') || log.includes('failed')) color = 'text-rose-400 font-semibold';

                  return (
                    <div key={i} className={`leading-relaxed ${color}`}>
                      {log}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-14 text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-400">Terminal Idle: Ready to Execute</p>
                  <p className="text-[11px]">Select a Flow above, configure your destination, and click <strong>"Run Pipeline & Load Destination"</strong>.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: EXECUTED PIPELINES HISTORY HUB
          ========================================== */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Executed Pipeline Jobs ({jobHistory.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click on any pipeline execution below to inspect its detailed metrics, rules, and full terminal logs.
              </p>
            </div>

            {jobHistory.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pipelines..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-full sm:w-48 font-sans"
                />
              </div>
            )}
          </div>

          {jobHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No Pipeline Executions Recorded Yet</p>
              <p>Execute your first Spark DAG in the <strong>"Run Pipeline"</strong> tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHistory.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobDetails(job)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-sky-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {job.name}
                      </span>
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <p className="text-[10px] font-mono text-slate-400 mt-1">
                      ID: {job.id} • {new Date(job.created_at).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 dark:text-slate-400">
                      {job.input_rows.toLocaleString()} ➔ <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{job.output_rows.toLocaleString()}</strong> rows
                    </span>

                    <span className="text-xs font-bold text-slate-900 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FLOW DETAILS MODAL */}
      {viewingFlowDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                      {viewingFlowDetails.category || 'General'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 uppercase font-bold">
                      {viewingFlowDetails.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {viewingFlowDetails.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingFlowDetails(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description & Metadata Grid */}
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {viewingFlowDetails.description || 'No detailed flow description provided.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">FLOW ID</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{viewingFlowDetails.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">CREATED</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    {viewingFlowDetails.created_at ? new Date(viewingFlowDetails.created_at).toLocaleDateString() : 'Initial'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">DATASETS</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                    {viewingFlowDetails.dataset_count || 0} Attached
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">SAVED RULES</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 block">
                    {Array.isArray(viewingFlowDetails.rules) ? viewingFlowDetails.rules.length : 0} Rules
                  </span>
                </div>
              </div>
            </div>

            {/* Attached Staged Datasets Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                <span>Attached Staged Datasets</span>
              </h4>

              {allStagedDatasets.filter((d) => d.flow_id === viewingFlowDetails.id).length === 0 ? (
                <p className="text-xs text-slate-400 font-mono p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  No staged datasets attached to this flow yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {allStagedDatasets
                    .filter((d) => d.flow_id === viewingFlowDetails.id)
                    .map((ds) => (
                      <div
                        key={ds.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{ds.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({ds.source_type})</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{ds.row_count?.toLocaleString()}</strong> rows • {ds.column_count} cols
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Configured Spark Transformation Rules Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                <span>Configured Transformation Rules ({Array.isArray(viewingFlowDetails.rules) ? viewingFlowDetails.rules.length : 0})</span>
              </h4>

              {(!viewingFlowDetails.rules || viewingFlowDetails.rules.length === 0) ? (
                <p className="text-xs text-slate-400 font-mono p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  No transformation rules configured for this flow yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {viewingFlowDetails.rules.map((rule, rIdx) => (
                    <div
                      key={rule.id || rIdx}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase">
                          {rule.rule_type}
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rule.description || rule.params?.condition || rule.params?.column_name || 'Step'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        rule.enabled !== false ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                      }`}>
                        {rule.enabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setViewingFlowDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  handleFlowChange(viewingFlowDetails.id);
                  setViewingFlowDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Select & Load This Flow</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
