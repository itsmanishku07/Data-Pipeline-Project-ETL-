import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Database, 
  Sparkles, 
  Layers, 
  Sliders, 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Calendar, 
  ArrowRight, 
  Info, 
  Trash2, 
  Check, 
  X, 
  ExternalLink,
  ChevronRight,
  HardDrive,
  BarChart3,
  Filter,
  RefreshCw
} from 'lucide-react';
import { DataFlowAPI, extractErrorMessage } from '../../services/api';

export const FlowsOverviewTrackerView = ({
  flows = [],
  activeFlowId,
  onSelectFlow,
  onNavigateToStep,
  onRefreshFlows
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedFlowModal, setSelectedFlowModal] = useState(null);
  
  // Create Flow Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowCategory, setNewFlowCategory] = useState('General');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Sort flows strictly by creation order (earliest created to newest)
  const sortedFlows = [...flows].sort((a, b) => {
    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tA - tB;
  });

  // Extract unique categories
  const categories = ['ALL', ...new Set(flows.map((f) => f.category || 'General'))];

  // Filtering
  const filteredFlows = sortedFlows.filter((f) => {
    const matchesSearch = !searchTerm.trim() || 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || (f.category || 'General') === categoryFilter;

    let matchesStatus = true;
    if (statusFilter === 'COMPLETED') {
      matchesStatus = f.progress_percentage === 100;
    } else if (statusFilter === 'IN_PROGRESS') {
      matchesStatus = f.progress_percentage > 0 && f.progress_percentage < 100;
    } else if (statusFilter === 'PENDING') {
      matchesStatus = f.progress_percentage === 0;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Executive Stats
  const totalFlows = flows.length;
  const completedFlows = flows.filter((f) => f.progress_percentage === 100).length;
  const totalDatasets = flows.reduce((acc, f) => acc + (f.dataset_count || 0), 0);
  const totalRules = flows.reduce((acc, f) => acc + (Array.isArray(f.rules) ? f.rules.length : 0), 0);
  const totalRows = flows.reduce((acc, f) => acc + (f.total_rows || 0), 0);

  const handleCreateFlow = async (e, jumpToSource = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newFlowName.trim()) {
      setCreateError('Please provide a valid Flow name.');
      return;
    }
    setCreatingFlow(true);
    setCreateError(null);
    try {
      const created = await DataFlowAPI.createFlow({
        name: newFlowName.trim(),
        category: newFlowCategory.trim() || 'General',
        description: newFlowDesc.trim(),
        rules: []
      });
      setShowCreateModal(false);
      setNewFlowName('');
      setNewFlowDesc('');
      setNewFlowCategory('General');
      setToastMsg(`Created Flow "${created.name}"! ${jumpToSource ? 'Opening Data Sources...' : ''}`);
      setTimeout(() => setToastMsg(null), 3500);
      if (onRefreshFlows) await onRefreshFlows();
      if (onSelectFlow) onSelectFlow(created.id);
      if (jumpToSource && onNavigateToStep) onNavigateToStep(1);
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to create flow'));
    } finally {
      setCreatingFlow(false);
    }
  };

  const handleDeleteFlow = async (flowId, flowName) => {
    if (!window.confirm(`Are you sure you want to delete Flow "${flowName}"?`)) return;
    try {
      await DataFlowAPI.deleteFlow(flowId);
      setToastMsg(`Deleted Flow "${flowName}"`);
      setTimeout(() => setToastMsg(null), 3500);
      if (selectedFlowModal?.id === flowId) setSelectedFlowModal(null);
      if (onRefreshFlows) onRefreshFlows();
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to delete flow'));
    }
  };

  const getStageIcon = (stageKey) => {
    switch (stageKey) {
      case 'ingestion': return Database;
      case 'schema': return Sparkles;
      case 'staging': return Layers;
      case 'transformation': return Sliders;
      case 'execution': return PlayCircle;
      default: return GitBranch;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium px-4 py-2.5 rounded-md shadow-lg flex items-center space-x-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header & Executive Dashboard */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Data Flows Overview
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Pipeline stage progression across ingestion, schema, staging, transformation, and execution.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRefreshFlows}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              title="Refresh Flows Data"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Flow</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block">Total Flows</span>
            <strong className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">{totalFlows}</strong>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Configured pipelines</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block">Completed Flows</span>
            <strong className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">{completedFlows}</strong>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">100% all stages</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block">Staged Datasets</span>
            <strong className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">{totalDatasets}</strong>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Parquet lakehouse sets</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block">Spark Rules</span>
            <strong className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">{totalRules}</strong>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Active transformations</span>
          </div>

          <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block">Managed Rows</span>
            <strong className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 block mt-1">{totalRows.toLocaleString()}</strong>
            <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Total data volume</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Filter flows by name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-shadow"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-xs text-zinc-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-xs text-zinc-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">100% Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending (0%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Flows Progression Cards */}
      {filteredFlows.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center text-zinc-400 space-y-3">
          <GitBranch className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No Flows Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {searchTerm ? 'No flows match your search criteria.' : 'Create your first data flow to begin tracking pipeline stages.'}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium text-xs inline-flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Flow</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredFlows.map((flow, index) => {
            const isSelected = flow.id === activeFlowId;
            const stages = flow.stages || {};
            const progress = flow.progress_percentage || 0;
            const creationDate = flow.created_at
              ? new Date(flow.created_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Initial Creation';

            const stageKeys = [
              { key: 'ingestion', label: 'Ingestion', stepId: 1 },
              { key: 'schema', label: 'Schema', stepId: 2 },
              { key: 'staging', label: 'Staging', stepId: 3 },
              { key: 'transformation', label: 'Transform', stepId: 4 },
              { key: 'execution', label: 'Execution', stepId: 5 },
            ];

            return (
              <div
                key={flow.id}
                className={`bg-white dark:bg-zinc-900 border rounded-lg p-4 shadow-xs transition-colors space-y-3.5 ${
                  isSelected
                    ? 'border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900/10 dark:ring-zinc-100/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Flow Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-medium text-zinc-400 dark:text-zinc-500 w-5">
                      #{index + 1}
                    </span>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {flow.name}
                        </h3>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {flow.category || 'General'}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono text-[11px] mt-0.5">
                        Created {creationDate}
                      </p>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 block">
                        {flow.completed_stages_count || 0}/5 Stages ({progress}%)
                      </span>
                      <div className="w-28 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className="h-full transition-all duration-300 bg-zinc-900 dark:bg-zinc-100"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Stage Stepper Progression Tracker */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {stageKeys.map((stg, sIdx) => {
                    const stageData = stages[stg.key] || {};
                    const isCompleted = stageData.completed || false;
                    const StageIcon = getStageIcon(stg.key);

                    return (
                      <div
                        key={stg.key}
                        onClick={() => {
                          if (onSelectFlow) onSelectFlow(flow.id);
                          if (onNavigateToStep) onNavigateToStep(stg.stepId);
                        }}
                        className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors flex flex-col justify-between space-y-1.5 group ${
                          isCompleted
                            ? 'bg-zinc-50/80 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <StageIcon className={`w-3.5 h-3.5 shrink-0 ${
                              isCompleted ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
                            }`} />
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                              {sIdx + 1}. {stg.label}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                          )}
                        </div>

                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 line-clamp-1 font-mono">
                          {stageData.summary || (isCompleted ? 'Completed' : 'Pending')}
                        </p>

                        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] font-mono">
                          <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400'}>
                            {isCompleted ? 'DONE' : 'PENDING'}
                          </span>
                          <span className="text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors flex items-center space-x-0.5">
                            <span>Open</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-zinc-500 dark:text-zinc-400 text-xs">
                    <span>Datasets: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{flow.dataset_count || 0}</strong></span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span>Rules: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{Array.isArray(flow.rules) ? flow.rules.length : 0}</strong></span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span>Rows: <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{(flow.total_rows || 0).toLocaleString()}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(1);
                      }}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                      title="Connect Data Source"
                    >
                      <Database className="w-3 h-3 text-zinc-500" />
                      <span>Source</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedFlowModal(flow)}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                      title="Flow Details"
                    >
                      <Info className="w-3 h-3 text-zinc-500" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(4);
                      }}
                      className="flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                    >
                      <Sliders className="w-3 h-3 text-zinc-500" />
                      <span>Transform</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(5);
                      }}
                      className="flex-1 sm:flex-initial justify-center px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1 shadow-xs transition-colors"
                    >
                      <PlayCircle className="w-3 h-3" />
                      <span>Run</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW FLOW MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-xl space-y-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create New Data Flow</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFlow} className="space-y-3">
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
                  placeholder="Optional flow notes or purpose..."
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={creatingFlow}
                  onClick={(e) => handleCreateFlow(e, false)}
                  className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <span>Create Only</span>
                </button>

                <button
                  type="button"
                  disabled={creatingFlow}
                  onClick={(e) => handleCreateFlow(e, true)}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingFlow ? 'Creating...' : 'Create & Open'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOW DETAILS MODAL */}
      {selectedFlowModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-xl w-full p-5 shadow-xl space-y-4 text-zinc-900 dark:text-zinc-100 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {selectedFlowModal.name}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {selectedFlowModal.category || 'General'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                    ID: {selectedFlowModal.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFlowModal(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description & Overview Grid */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {selectedFlowModal.description || 'No detailed flow description provided.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-400 block">FLOW ID</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">{selectedFlowModal.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">CREATED</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
                    {selectedFlowModal.created_at ? new Date(selectedFlowModal.created_at).toLocaleDateString() : 'Initial'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">DATASETS</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    {selectedFlowModal.dataset_count || 0} Attached
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">RULES</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    {Array.isArray(selectedFlowModal.rules) ? selectedFlowModal.rules.length : 0} Rules
                  </span>
                </div>
              </div>
            </div>

            {/* Configured Spark Rules in Flow */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                <span>Configured Transformation Rules ({Array.isArray(selectedFlowModal.rules) ? selectedFlowModal.rules.length : 0})</span>
              </h4>

              {(!selectedFlowModal.rules || selectedFlowModal.rules.length === 0) ? (
                <p className="text-xs text-zinc-400 font-mono p-3 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-center">
                  No transformation rules configured for this flow yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedFlowModal.rules.map((rule, rIdx) => (
                    <div
                      key={rule.id || rIdx}
                      className="p-2 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                          {rule.rule_type}
                        </span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {rule.description || rule.params?.condition || rule.params?.column_name || 'Step'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        rule.enabled !== false ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                      }`}>
                        {rule.enabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteFlow(selectedFlowModal.id, selectedFlowModal.name)}
                className="px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900/40 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-700 dark:text-red-400 text-xs font-medium flex items-center space-x-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedFlowModal(null)}
                  className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onSelectFlow) onSelectFlow(selectedFlowModal.id);
                    if (onNavigateToStep) onNavigateToStep(5);
                    setSelectedFlowModal(null);
                  }}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Execute in Runner</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
