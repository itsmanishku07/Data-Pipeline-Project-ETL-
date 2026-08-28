import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  Plus, 
  Sliders, 
  HardDrive,
  GitBranch,
  Sparkles,
  Database,
  PlayCircle,
  FolderOpen,
  Search,
  CheckCircle2,
  Table as TableIcon,
  Info,
  Calendar,
  FileCode
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';
import { DataGrid } from '../common/DataGrid';

export const StagingAreaView = ({
  initialDatasetId,
  activeFlowId,
  flows = [],
  allDatasets = [],
  onSelectFlow,
  onSelectDatasetForTransform,
  onAddNewSource,
}) => {
  const [datasets, setDatasets] = useState(allDatasets || []);
  const [activeDataset, setActiveDataset] = useState(null);
  const [selectedFlowFilter, setSelectedFlowFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('preview'); // 'preview', 'schema', 'lineage'
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchStage, setSearchStage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadStagedDatasets = async () => {
    setLoading(true);
    try {
      // Always load all datasets across all flows
      const dsList = await DataFlowAPI.listStagedDatasets(null);
      setDatasets(dsList);
    } catch (err) {
      console.error('Failed to load staged datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStagedDatasets();
  }, [activeFlowId]);

  // Sync with allDatasets prop if updated from parent
  useEffect(() => {
    if (allDatasets && allDatasets.length > 0) {
      setDatasets(allDatasets);
    }
  }, [allDatasets]);

  // If activeFlowId changes from top header, sync the filter
  useEffect(() => {
    if (activeFlowId && activeFlowId !== 'all') {
      setSelectedFlowFilter(activeFlowId);
    } else {
      setSelectedFlowFilter('all');
    }
  }, [activeFlowId]);

  const handleSelectStage = async (ds) => {
    setActiveDataset(ds);
    setActiveTab('preview');
    setCurrentPage(1);
    try {
      const data = await DataFlowAPI.getDatasetPreview(ds.id, 1, pageSize);
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to load preview for stage', err);
    }
  };

  const handleBackToGallery = () => {
    setActiveDataset(null);
    setPreviewData(null);
  };

  const handlePageChange = async (page) => {
    if (!activeDataset) return;
    setCurrentPage(page);
    try {
      const data = await DataFlowAPI.getDatasetPreview(activeDataset.id, page, pageSize);
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to load preview page', err);
    }
  };

  const handleDeleteStage = async (stageId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this staged dataset?')) return;
    try {
      await DataFlowAPI.deleteStagedDataset(stageId);
      const updated = datasets.filter((d) => d.id !== stageId);
      setDatasets(updated);
      if (activeDataset?.id === stageId) {
        setActiveDataset(null);
        setPreviewData(null);
      }
    } catch (err) {
      console.error('Delete stage error', err);
    }
  };

  const filteredStages = datasets.filter((ds) => {
    // Flow filter match
    if (selectedFlowFilter !== 'all' && ds.flow_id !== selectedFlowFilter) {
      return false;
    }
    if (!searchStage.trim()) return true;
    const term = searchStage.toLowerCase();
    const flowObj = flows.find((f) => f.id === ds.flow_id);
    const flowName = flowObj ? flowObj.name.toLowerCase() : '';
    return ds.name.toLowerCase().includes(term) || 
           (ds.source_type && ds.source_type.toLowerCase().includes(term)) ||
           flowName.includes(term);
  });

  // Count datasets per flow for badge display
  const getFlowDatasetCount = (flowId) => {
    if (flowId === 'all') return datasets.length;
    return datasets.filter((d) => d.flow_id === flowId).length;
  };

  // ==========================================
  // LEVEL 1: CLEAN SAVED STAGES GALLERY
  // ==========================================
  if (!activeDataset) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Top Header & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lakehouse Staging Repository</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {datasets.length} persistent staging dataset{datasets.length === 1 ? '' : 's'} across {flows.length} data flows
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2.5">
            {datasets.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search stages or flows..."
                  value={searchStage}
                  onChange={(e) => setSearchStage(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-full sm:w-52 font-sans"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onAddNewSource}
              className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect & Stage Source</span>
            </button>
          </div>
        </div>

        {/* FLOW SELECTOR TABS BAR */}
        {flows.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedFlowFilter('all');
                onSelectFlow && onSelectFlow('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
                selectedFlowFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span>⚡ All Flows</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedFlowFilter === 'all'
                  ? 'bg-slate-700 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {getFlowDatasetCount('all')}
              </span>
            </button>

            {flows.map((flow) => {
              const isSelected = selectedFlowFilter === flow.id;
              const count = getFlowDatasetCount(flow.id);
              return (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => {
                    setSelectedFlowFilter(flow.id);
                    onSelectFlow && onSelectFlow(flow.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{flow.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Saved Stages Cards Grid */}
        {filteredStages.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-1" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {datasets.length === 0 ? 'No Staged Datasets Yet' : 'No Datasets In This Flow'}
            </h3>
            <p className="max-w-sm mx-auto text-slate-400">
              {datasets.length === 0
                ? 'Connect a data source, customize schema types, and stage it into the Lakehouse.'
                : 'This flow currently has no staged datasets. Connect a data source to attach data.'}
            </p>
            <button
              type="button"
              onClick={onAddNewSource}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 font-bold inline-flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect & Stage Data</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStages.map((ds) => {
              const flowObj = flows.find((f) => f.id === ds.flow_id);
              return (
                <div
                  key={ds.id}
                  onClick={() => handleSelectStage(ds)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-sky-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
                >
                  <div>
                    {/* Top Badges: Flow Badge & Source Type */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {flowObj ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 truncate max-w-[170px]">
                          <GitBranch className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate">{flowObj.name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          General
                        </span>
                      )}

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {ds.source_type}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteStage(ds.id, e)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                          title="Delete staged dataset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {ds.name}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                      {ds.description || ds.source_summary || 'Staged Apache Parquet Lakehouse table.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 space-x-2">
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{ds.row_count.toLocaleString()}</strong> rows
                      <span>•</span>
                      <span>{ds.column_count} cols</span>
                    </div>

                    <span className="text-xs font-bold text-slate-900 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect Data</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LEVEL 2: DEDICATED STAGE DETAILS & PREVIEW
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Navigation Bar with Back Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBackToGallery}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1 text-xs font-semibold shrink-0 mt-0.5 sm:mt-0"
            title="Back to all stages"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">All Stages</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase shrink-0">
                MYSQL STAGE TABLE
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">{activeDataset.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              ID: {activeDataset.id} • {activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} cols
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={(e) => handleDeleteStage(activeDataset.id, e)}
            className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center space-x-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Stage</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDatasetForTransform(activeDataset)}
            className="flex-1 sm:flex-initial justify-center px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Transform Stage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Data Preview, Schema & Types, Lineage Metadata */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit overflow-x-auto whitespace-nowrap -webkit-overflow-scrolling-touch">
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'preview'
              ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>Data Preview ({activeDataset.row_count.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'schema'
              ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Schema & Types ({activeDataset.column_count})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lineage')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'lineage'
              ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Stage Lineage & File Metadata</span>
        </button>
      </div>

      {/* 1. DATA PREVIEW TAB */}
      {activeTab === 'preview' && previewData && (
        <DataGrid
          title={`Stage Preview: ${activeDataset.name}`}
          subtitle={`Stored in MySQL Database Table • ${previewData.total_rows.toLocaleString()} total rows across ${activeDataset.column_count} columns`}
          columns={activeDataset.columns}
          rows={previewData.rows}
          totalRows={previewData.total_rows}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}

      {/* 2. SCHEMA & TYPES TAB */}
      {activeTab === 'schema' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Column Schema & Data Types Profile
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Column Name</th>
                  <th className="py-2.5 px-3">Spark Data Type</th>
                  <th className="py-2.5 px-3">Nullable</th>
                  <th className="py-2.5 px-3">Null Count</th>
                  <th className="py-2.5 px-3">Distinct Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {activeDataset.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white font-sans">{col.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 font-bold text-[10px]">
                        {col.spark_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{col.nullable ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{col.null_count || 0}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{col.distinct_count || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. STAGE LINEAGE & METADATA TAB */}
      {activeTab === 'lineage' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 transition-colors">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Stage Lineage & Storage Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block font-sans">Storage Metadata</span>
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Engine:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">MYSQL TABLE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Storage Format:</span>
                <span className="text-slate-800 dark:text-slate-200 uppercase">{activeDataset.storage_format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created:</span>
                <span className="text-slate-800 dark:text-slate-200">{new Date(activeDataset.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block font-sans">Source Provenance</span>
              <div className="flex justify-between">
                <span className="text-slate-500">Source Type:</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold uppercase">{activeDataset.source_type}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Summary:</span>
                <p className="text-slate-800 dark:text-slate-200 truncate">{activeDataset.source_summary || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Database Table URI:</span>
            <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-sky-300 font-mono text-[11px] truncate">
              {activeDataset.storage_path}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
