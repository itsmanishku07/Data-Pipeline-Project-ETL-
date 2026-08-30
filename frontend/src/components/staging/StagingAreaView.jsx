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
import { ConfirmationModal } from '../common/ConfirmationModal';

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

  // Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    stageId: null,
    stageName: '',
    loading: false
  });

  const promptDeleteStage = (stageId, stageName, e) => {
    if (e) e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      stageId,
      stageName,
      loading: false
    });
  };

  const confirmDeleteStage = async () => {
    const { stageId } = deleteConfirmModal;
    if (!stageId) return;
    setDeleteConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      await DataFlowAPI.deleteStagedDataset(stageId);
      const updated = datasets.filter((d) => d.id !== stageId);
      setDatasets(updated);
      if (activeDataset?.id === stageId) {
        setActiveDataset(null);
        setPreviewData(null);
      }
      setDeleteConfirmModal({ isOpen: false, stageId: null, stageName: '', loading: false });
    } catch (err) {
      console.error('Delete stage error', err);
      setDeleteConfirmModal({ isOpen: false, stageId: null, stageName: '', loading: false });
    }
  };

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
      <div className="space-y-5 animate-fadeIn">
        {/* Top Header & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <div className="flex items-center space-x-2.5">
            <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Staging Repository</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {datasets.length} staged dataset{datasets.length === 1 ? '' : 's'} across {flows.length} data flows
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2">
            {datasets.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter datasets or flows..."
                  value={searchStage}
                  onChange={(e) => setSearchStage(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full sm:w-52 font-sans"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onAddNewSource}
              className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect & Stage</span>
            </button>
          </div>
        </div>

        {/* FLOW SELECTOR TABS BAR */}
        {flows.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedFlowFilter('all');
                onSelectFlow && onSelectFlow('all');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 ${
                selectedFlowFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span>All Flows</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                selectedFlowFilter === 'all'
                  ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{flow.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-500 dark:text-zinc-400 text-xs space-y-3">
            <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto mb-1" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {datasets.length === 0 ? 'No Staged Datasets Yet' : 'No Datasets In This Flow'}
            </h3>
            <p className="max-w-sm mx-auto text-zinc-400">
              {datasets.length === 0
                ? 'Connect a data source, customize schema types, and stage it into the Lakehouse.'
                : 'This flow currently has no staged datasets. Connect a data source to attach data.'}
            </p>
            <button
              type="button"
              onClick={onAddNewSource}
              className="mt-2 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium inline-flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect & Stage Data</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredStages.map((ds) => {
              const flowObj = flows.find((f) => f.id === ds.flow_id);
              return (
                <div
                  key={ds.id}
                  onClick={() => handleSelectStage(ds)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg p-4 shadow-xs transition-colors cursor-pointer flex flex-col justify-between group space-y-3.5"
                >
                  <div>
                    {/* Top Badges: Flow Badge & Source Type */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {flowObj ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 truncate max-w-[170px]">
                          <GitBranch className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate">{flowObj.name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          General
                        </span>
                      )}

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {ds.source_type}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => promptDeleteStage(ds.id, ds.name, e)}
                          className="text-zinc-400 hover:text-red-600 p-0.5 transition-colors"
                          title="Delete staged dataset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {ds.name}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">
                      {ds.description || ds.source_summary || 'Staged Apache Parquet Lakehouse table.'}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 space-x-1.5">
                      <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{ds.row_count.toLocaleString()}</strong> rows
                      <span>•</span>
                      <span>{ds.column_count} cols</span>
                    </div>

                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Stage Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteConfirmModal.isOpen}
          title={`Delete Staged Dataset "${deleteConfirmModal.stageName}"?`}
          message="Are you sure you want to delete this staged dataset? The underlying MySQL table data and parquet partitions will be permanently removed."
          confirmText="Delete Dataset"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleteConfirmModal.loading}
          onConfirm={confirmDeleteStage}
          onCancel={() => setDeleteConfirmModal({ isOpen: false, stageId: null, stageName: '', loading: false })}
        />
      </div>
    );
  }

  // ==========================================
  // LEVEL 2: DEDICATED STAGE DETAILS & PREVIEW
  // ==========================================
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Navigation Bar with Back Button */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 sm:p-4 shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBackToGallery}
            className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center space-x-1 text-xs font-medium shrink-0 mt-0.5 sm:mt-0"
            title="Back to all stages"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">All Stages</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase shrink-0">
                STAGE TABLE
              </span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate block">{activeDataset.name}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
              ID: {activeDataset.id} • {activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} cols
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={(e) => promptDeleteStage(activeDataset.id, activeDataset.name, e)}
            className="flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900/40 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-xs font-medium text-red-700 dark:text-red-400 flex items-center space-x-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDatasetForTransform(activeDataset)}
            className="flex-1 sm:flex-initial justify-center px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Transform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Data Preview, Schema & Types, Lineage Metadata */}
      <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-md border border-zinc-200 dark:border-zinc-700/60 w-full sm:w-fit overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
            activeTab === 'preview'
              ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>Data Preview ({activeDataset.row_count.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
            activeTab === 'schema'
              ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Schema & Types ({activeDataset.column_count})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lineage')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
            activeTab === 'lineage'
              ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Lineage & Metadata</span>
        </button>
      </div>

      {/* 1. DATA PREVIEW TAB */}
      {activeTab === 'preview' && previewData && (
        <DataGrid
          title={`Stage Preview: ${activeDataset.name}`}
          subtitle={`Stored Lakehouse Dataset • ${previewData.total_rows.toLocaleString()} rows • ${activeDataset.column_count} columns`}
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs transition-colors">
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Column Schema & Data Types Profile
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-2 px-3">Column Name</th>
                  <th className="py-2 px-3">Spark Data Type</th>
                  <th className="py-2 px-3">Nullable</th>
                  <th className="py-2 px-3">Null Count</th>
                  <th className="py-2 px-3">Distinct Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {activeDataset.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                    <td className="py-2 px-3 font-medium text-zinc-900 dark:text-white font-sans">{col.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                        {col.spark_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{col.nullable ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{col.null_count || 0}</td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{col.distinct_count || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. STAGE LINEAGE & METADATA TAB */}
      {activeTab === 'lineage' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 sm:p-5 shadow-xs space-y-3.5 transition-colors">
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Stage Lineage & Storage Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-mono">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 block font-sans">Storage Metadata</span>
              <div className="flex justify-between">
                <span className="text-zinc-500">Storage Engine:</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">MYSQL TABLE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Storage Format:</span>
                <span className="text-zinc-800 dark:text-zinc-200 uppercase">{activeDataset.storage_format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Created:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{new Date(activeDataset.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 block font-sans">Source Provenance</span>
              <div className="flex justify-between">
                <span className="text-zinc-500">Source Type:</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium uppercase">{activeDataset.source_type}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Summary:</span>
                <p className="text-zinc-800 dark:text-zinc-200 truncate">{activeDataset.source_summary || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">Database Table URI:</span>
            <pre className="p-2.5 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-300 font-mono text-xs truncate">
              {activeDataset.storage_path}
            </pre>
          </div>
        </div>
      )}

      {/* Delete Stage Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        title={`Delete Staged Dataset "${deleteConfirmModal.stageName}"?`}
        message="Are you sure you want to delete this staged dataset? The underlying MySQL table data and parquet partitions will be permanently removed."
        confirmText="Delete Dataset"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteConfirmModal.loading}
        onConfirm={confirmDeleteStage}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, stageId: null, stageName: '', loading: false })}
      />
    </div>
  );
};
