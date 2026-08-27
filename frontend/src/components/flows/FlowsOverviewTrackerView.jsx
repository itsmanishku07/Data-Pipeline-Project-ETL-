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
import { DataFlowAPI } from '../../services/api';

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
      setCreateError(err?.response?.data?.detail || err.message || 'Failed to create flow');
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
      alert(err?.response?.data?.detail || err.message || 'Failed to delete flow');
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
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner / Executive Dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Data Flows Lifecycle Tracker
                </h2>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  Real-time pipeline progression monitoring across Ingestion, Schema, Staging, Transform & Execution
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onRefreshFlows}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1 transition-all"
              title="Refresh Flows Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md hover:shadow-indigo-500/25 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Flow</span>
            </button>
          </div>
        </div>

        {/* 5 High-Level KPI Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-white/10">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">TOTAL FLOWS</span>
            <strong className="text-base font-bold text-white block mt-0.5">{totalFlows}</strong>
            <span className="text-[9px] text-slate-400 font-mono">Creation Order</span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-emerald-400 block uppercase">100% READY FLOWS</span>
            <strong className="text-base font-bold text-emerald-400 block mt-0.5">{completedFlows}</strong>
            <span className="text-[9px] text-slate-400 font-mono">All 5 Stages Done</span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-sky-400 block uppercase">STAGED SETS</span>
            <strong className="text-base font-bold text-sky-400 block mt-0.5">{totalDatasets}</strong>
            <span className="text-[9px] text-slate-400 font-mono">Lakehouse Tables</span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-amber-400 block uppercase">SPARK RULES</span>
            <strong className="text-base font-bold text-amber-400 block mt-0.5">{totalRules}</strong>
            <span className="text-[9px] text-slate-400 font-mono">Active Transform Steps</span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono text-indigo-400 block uppercase">MANAGED ROWS</span>
            <strong className="text-base font-bold text-indigo-400 block mt-0.5">{totalRows.toLocaleString()}</strong>
            <span className="text-[9px] text-slate-400 font-mono">Curated Data Volume</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search flow name, category, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-[11px] text-slate-400 font-mono">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-[11px] text-slate-400 font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Stages</option>
              <option value="COMPLETED">100% Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending (0%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Flows Progression Cards Matrix */}
      {filteredFlows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <GitBranch className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Flows Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm ? 'No flows match your search criteria.' : 'Create your first data flow to begin tracking pipeline stages.'}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Flow</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
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
              { key: 'execution', label: 'Runner', stepId: 5 },
            ];

            return (
              <div
                key={flow.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all space-y-4 ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-400'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Flow Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-bold text-xs border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                      #{index + 1}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {flow.name}
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 uppercase">
                          {flow.category || 'General'}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                            Active Flow
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span>{flow.description || 'Enterprise Data Pipeline Flow'}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] flex items-center space-x-1">
                          <Calendar className="w-2.5 h-2.5 text-slate-400" />
                          <span>Created {creationDate}</span>
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Progress Badge */}
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block">
                        {flow.completed_stages_count || 0}/5 Stages ({progress}%)
                      </span>
                      <div className="w-32 bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            progress === 100
                              ? 'bg-emerald-500'
                              : progress >= 60
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Stage Stepper Progression Tracker */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
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
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between space-y-2 group ${
                          isCompleted
                            ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400'
                            : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <StageIcon className={`w-3.5 h-3.5 shrink-0 ${
                              isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                            }`} />
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {sIdx + 1}. {stg.label}
                            </span>
                          </div>

                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 font-mono">
                          {stageData.summary || (isCompleted ? 'Stage Ready' : 'Pending Step')}
                        </p>

                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] font-mono font-bold">
                          <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 uppercase' : 'text-slate-400 uppercase'}>
                            {isCompleted ? 'COMPLETED' : 'PENDING'}
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5">
                            <span>Open</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Action Footer for Each Flow */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Datasets: <strong className="text-slate-900 dark:text-white font-bold">{flow.dataset_count || 0}</strong></span>
                    <span>•</span>
                    <span>Spark Rules: <strong className="text-slate-900 dark:text-white font-bold">{Array.isArray(flow.rules) ? flow.rules.length : 0}</strong></span>
                    <span>•</span>
                    <span>Total Rows: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{(flow.total_rows || 0).toLocaleString()}</strong></span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center space-x-1 border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                      title="Connect Data Source for this Flow"
                    >
                      <Database className="w-3 h-3 text-emerald-500" />
                      <span>Connect Source</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedFlowModal(flow)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1 transition-colors"
                      title="Inspect Full Flow Metadata & Logs"
                    >
                      <Info className="w-3 h-3 text-sky-500" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(4);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center space-x-1 border border-indigo-200 dark:border-indigo-500/30 transition-colors"
                    >
                      <Sliders className="w-3 h-3 text-indigo-500" />
                      <span>Transform</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectFlow) onSelectFlow(flow.id);
                        if (onNavigateToStep) onNavigateToStep(5);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white font-bold text-xs flex items-center space-x-1 shadow-sm transition-all"
                    >
                      <PlayCircle className="w-3 h-3" />
                      <span>Run Pipeline</span>
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Data Flow</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFlow} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Flow Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Daily Revenue Analytics"
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
                  placeholder="Brief description of this pipeline workflow..."
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-sans text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold order-last sm:order-first"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={creatingFlow}
                  onClick={(e) => handleCreateFlow(e, false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <span>Create Flow Only</span>
                </button>

                <button
                  type="button"
                  disabled={creatingFlow}
                  onClick={(e) => handleCreateFlow(e, true)}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingFlow ? 'Creating...' : 'Create Flow & Select Source'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOW DETAILS MODAL */}
      {selectedFlowModal && (
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
                      {selectedFlowModal.category || 'General'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 uppercase font-bold">
                      {selectedFlowModal.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedFlowModal.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFlowModal(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description & Overview Grid */}
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {selectedFlowModal.description || 'No detailed flow description provided.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">FLOW ID</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{selectedFlowModal.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">CREATED</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    {selectedFlowModal.created_at ? new Date(selectedFlowModal.created_at).toLocaleDateString() : 'Initial'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">DATASETS</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                    {selectedFlowModal.dataset_count || 0} Attached
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">RULES CONFIGURED</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 block">
                    {Array.isArray(selectedFlowModal.rules) ? selectedFlowModal.rules.length : 0} Rules
                  </span>
                </div>
              </div>
            </div>

            {/* Configured Spark Rules in Flow */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                <span>Configured Transformation Rules ({Array.isArray(selectedFlowModal.rules) ? selectedFlowModal.rules.length : 0})</span>
              </h4>

              {(!selectedFlowModal.rules || selectedFlowModal.rules.length === 0) ? (
                <p className="text-xs text-slate-400 font-mono p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  No transformation rules configured for this flow yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedFlowModal.rules.map((rule, rIdx) => (
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

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteFlow(selectedFlowModal.id, selectedFlowModal.name)}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Flow</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedFlowModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Execute in Pipeline Runner</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
