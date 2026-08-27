import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Play, 
  ArrowRight, 
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  CheckCircle2, 
  AlertCircle, 
  HardDrive,
  Layers,
  FolderOpen,
  Search,
  Save,
  BookmarkCheck,
  Sparkles,
  GitBranch,
  GitMerge,
  Link2,
  Database,
  X
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';
import { DataGrid } from '../common/DataGrid';

export const TransformationStudioView = ({
  allDatasets = [],
  activeFlowId = null,
  flows = [],
  onSelectFlow = null,
  onProceedToExecution,
  onBackToStaging,
}) => {
  const [activeDataset, setActiveDataset] = useState(null);
  const [rules, setRules] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchStage, setSearchStage] = useState('');

  // Rule Builder & Editor State
  const [ruleType, setRuleType] = useState('filter');
  const [params, setParams] = useState({});
  const [editingRuleId, setEditingRuleId] = useState(null);

  // Persistence State
  const [savingRules, setSavingRules] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Helper to always resolve a valid target flow ID
  const resolveTargetFlowId = () => {
    return activeDataset?.flow_id || activeFlowId || (flows && flows[0]?.id) || null;
  };

  // Determine current effective flow
  const currentFlowId = resolveTargetFlowId();
  const currentFlow = flows.find((f) => f.id === currentFlowId) || { id: currentFlowId || '', name: currentFlowId ? `Flow ${currentFlowId}` : 'No Flow Selected' };

  // Load flow rules when dataset or flow changes
  useEffect(() => {
    const flowId = resolveTargetFlowId();
    if (flowId) {
      DataFlowAPI.getFlowRules(flowId)
        .then((res) => {
          if (res && Array.isArray(res.rules)) {
            setRules(res.rules);
          }
        })
        .catch((err) => console.error('Failed to load flow rules', err));
    }
  }, [activeDataset, activeFlowId, flows]);

  const handleSelectStage = async (ds) => {
    setActiveDataset(ds);
    setPreviewResult(null);
    setErrorMsg(null);
    setEditingRuleId(null);
    setSaveSuccessMsg(null);

    // If dataset belongs to a flow or active flow has rules, load them
    const flowId = ds.flow_id || resolveTargetFlowId();
    if (flowId) {
      try {
        const res = await DataFlowAPI.getFlowRules(flowId);
        if (res && Array.isArray(res.rules) && res.rules.length > 0) {
          setRules(res.rules);
        }
      } catch (err) {
        console.error('Failed to load rules for stage', err);
      }
    }
  };

  const handleBackToStagesList = () => {
    setActiveDataset(null);
    setPreviewResult(null);
    setErrorMsg(null);
    setEditingRuleId(null);
    setSaveSuccessMsg(null);
  };

  const buildRuleDescription = (type, p, ds) => {
    if (type === 'filter') {
      return `Filter: ${p.condition || `${ds?.columns?.[0]?.name} IS NOT NULL`}`;
    } else if (type === 'join') {
      const targetDs = allDatasets.find((d) => d.id === p.target_dataset_id);
      const howUpper = (p.how || 'inner').toUpperCase();
      const targetName = targetDs?.name || p.target_dataset_id || 'Table';
      return `${howUpper} JOIN with '${targetName}' ON ${p.left_on || 'key'} = ${p.right_on || 'key'}`;
    } else if (type === 'derived_column') {
      return `${p.column_name || 'derived_metric'} = ${p.expression || '1 + 1'}`;
    } else if (type === 'string_transform') {
      return `${(p.operation || 'upper').toUpperCase()}(${p.column || ds?.columns?.[0]?.name})`;
    } else if (type === 'rename_column') {
      return `Rename ${p.old_name || ds?.columns?.[0]?.name} -> ${p.new_name || 'new_col'}`;
    } else if (type === 'spark_sql') {
      return `SQL: ${(p.query || 'SELECT * FROM df').slice(0, 35)}...`;
    }
    return 'Transformation Step';
  };

  const autoSaveRules = async (newRules, flowId = null) => {
    const targetFlowId = flowId || resolveTargetFlowId();
    try {
      await DataFlowAPI.saveFlowRules(targetFlowId, newRules);
      setSaveSuccessMsg(`Saved ${newRules.length} rule${newRules.length === 1 ? '' : 's'} to Flow "${currentFlow?.name || targetFlowId}"`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.warn('Auto-saving flow rules error:', err);
    }
  };

  const handleSaveOrUpdateRule = () => {
    if (!activeDataset || !activeDataset.columns || activeDataset.columns.length === 0) return;
    let p = { ...params };

    if (ruleType === 'filter') {
      p.condition = p.condition || `${activeDataset.columns[0]?.name} IS NOT NULL`;
    } else if (ruleType === 'join') {
      const available = allDatasets.filter((d) => d.id !== activeDataset.id);
      const targetDs = available.find((d) => d.id === p.target_dataset_id) || available[0];
      if (!targetDs) {
        setErrorMsg("Please stage at least one other dataset to perform a table Join.");
        return;
      }
      p.target_dataset_id = targetDs.id;
      p.left_on = p.left_on || activeDataset.columns[0]?.name;
      p.right_on = p.right_on || targetDs.columns?.[0]?.name || activeDataset.columns[0]?.name;
      p.how = p.how || 'inner';
      p.suffix_right = p.suffix_right || `_${targetDs.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 10)}`;
    } else if (ruleType === 'derived_column') {
      p.column_name = p.column_name || 'derived_metric';
      p.expression = p.expression || '1 + 1';
    } else if (ruleType === 'string_transform') {
      p.column = p.column || activeDataset.columns[0]?.name;
      p.operation = p.operation || 'upper';
    } else if (ruleType === 'rename_column') {
      p.old_name = p.old_name || activeDataset.columns[0]?.name;
      p.new_name = p.new_name || `${p.old_name}_new`;
    } else if (ruleType === 'spark_sql') {
      p.query = p.query || 'SELECT * FROM df';
    }

    const desc = buildRuleDescription(ruleType, p, activeDataset);
    let updatedRules = [];

    if (editingRuleId) {
      // Update existing rule
      updatedRules = rules.map((r) => r.id === editingRuleId ? {
        ...r,
        rule_type: ruleType,
        params: p,
        description: desc,
      } : r);
      setRules(updatedRules);
      setEditingRuleId(null);
    } else {
      // Add new rule
      const newRule = {
        id: `rule_${Date.now()}`,
        rule_type: ruleType,
        params: p,
        description: desc,
        enabled: true,
      };
      updatedRules = [...rules, newRule];
      setRules(updatedRules);
    }

    setParams({});
    // Auto-save immediately to database
    autoSaveRules(updatedRules);
  };

  const handleStartEdit = (rule) => {
    setEditingRuleId(rule.id);
    setRuleType(rule.rule_type);
    setParams({ ...rule.params });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setParams({});
  };

  const handleToggle = (idx) => {
    const updated = [...rules];
    updated[idx].enabled = !updated[idx].enabled;
    setRules(updated);
    autoSaveRules(updated);
  };

  const handleDelete = (idx) => {
    const updated = rules.filter((_, i) => i !== idx);
    setRules(updated);
    if (editingRuleId && rules[idx]?.id === editingRuleId) {
      handleCancelEdit();
    }
    autoSaveRules(updated);
  };

  const handleMoveRule = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= rules.length) return;
    const updated = [...rules];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setRules(updated);
    autoSaveRules(updated);
  };

  const handleSaveRulesToFlow = async () => {
    const targetFlowId = currentFlowId || activeDataset?.flow_id || activeFlowId;
    if (!targetFlowId) {
      setErrorMsg('No active Flow selected to save transformation rules.');
      return;
    }
    setSavingRules(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      await DataFlowAPI.saveFlowRules(targetFlowId, rules);
      setSaveSuccessMsg(`Saved ${rules.length} transformation rule${rules.length === 1 ? '' : 's'} to Flow "${currentFlow?.name || targetFlowId}"`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to save rules to flow');
    } finally {
      setSavingRules(false);
    }
  };

  const handlePreview = async () => {
    if (!activeDataset) return;
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const res = await DataFlowAPI.previewTransformation({
        staging_dataset_id: activeDataset.id,
        rules: rules.filter((r) => r.enabled),
        limit: 25,
      });
      setPreviewResult(res);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Transformation preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleProceed = async () => {
    const targetFlowId = currentFlowId || activeDataset?.flow_id || activeFlowId;
    // Persist rules to flow before proceeding if flow is selected
    if (targetFlowId && rules.length > 0) {
      try {
        await DataFlowAPI.saveFlowRules(targetFlowId, rules);
      } catch (e) {
        console.warn('Auto-save rules before proceeding failed:', e);
      }
    }
    onProceedToExecution(activeDataset, rules.filter((r) => r.enabled), targetFlowId);
  };

  const filteredStages = allDatasets.filter((ds) => {
    if (!searchStage.trim()) return true;
    const term = searchStage.toLowerCase();
    return ds.name.toLowerCase().includes(term) || ds.id.toLowerCase().includes(term);
  });

  // ==========================================
  // VIEW: STAGES GALLERY SELECTION
  // ==========================================
  if (!activeDataset) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/30 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Select Staged Dataset to Transform
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a Lakehouse staged dataset to build and edit Apache Spark DAG rules.
              </p>
            </div>
          </div>

          {allDatasets.length > 0 && (
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stages..."
                value={searchStage}
                onChange={(e) => setSearchStage(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-full sm:w-52 font-sans"
              />
            </div>
          )}
        </div>

        {allDatasets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-1" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Staged Sets Found</h3>
            <p className="max-w-sm mx-auto text-slate-400">
              You haven't staged any data yet. Please connect a data source and stage it in the Staging Area.
            </p>
            <button
              type="button"
              onClick={onBackToStaging}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 font-bold inline-flex items-center space-x-1.5 shadow-sm"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Go to Staging Area</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStages.map((ds) => (
              <div
                key={ds.id}
                onClick={() => handleSelectStage(ds)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-sky-500 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/20 shrink-0">
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {ds.name}
                      </span>
                    </div>

                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                      {ds.source_type}
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
                    <span>Build Rules</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: RULE STUDIO & LIVE PREVIEW
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm transition-colors">
        <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBackToStagesList}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1 text-xs font-semibold shrink-0 mt-0.5 sm:mt-0"
            title="Back to stages list"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stages</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase shrink-0">
                ACTIVE STAGE
              </span>
              {currentFlow && (
                <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 truncate max-w-[150px] sm:max-w-none shrink-0">
                  FLOW: {currentFlow.name}
                </span>
              )}
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
              {activeDataset.name}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              ID: {activeDataset.id} • {activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} cols
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || rules.length === 0}
            className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
            <span>{previewLoading ? 'Executing...' : 'Live Preview'}</span>
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={rules.length === 0}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2 sm:py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <span>Run Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Rule Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rule Builder & Sequence */}
        <div className="lg:col-span-5 space-y-4">
          {/* Rule Builder / Editor Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                {editingRuleId ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Edit Transformation Rule</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Add Transformation Rule</span>
                  </>
                )}
              </h4>

              {editingRuleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center space-x-1"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Operation</label>
                <select
                  value={ruleType}
                  onChange={(e) => {
                    setRuleType(e.target.value);
                    setParams({});
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 font-mono"
                >
                  <option value="filter">Filter Rows (WHERE condition)</option>
                  <option value="join">Merge / Join Table (Multi-Table Join)</option>
                  <option value="derived_column">Derived Column (Math Formula)</option>
                  <option value="string_transform">String Cleansing (Upper/Lower/Trim)</option>
                  <option value="rename_column">Rename Column</option>
                  <option value="spark_sql">Custom Spark SQL Query</option>
                </select>
              </div>

              {ruleType === 'filter' && (
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">WHERE Condition</label>
                  <input
                    type="text"
                    value={params.condition || ''}
                    onChange={(e) => setParams({ ...params, condition: e.target.value })}
                    placeholder="amount > 100 AND status = 'COMPLETED'"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-amber-700 dark:text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {ruleType === 'join' && (() => {
                const available = allDatasets.filter((d) => d.id !== activeDataset.id);
                const selectedTargetId = params.target_dataset_id || available[0]?.id;
                const selectedTarget = available.find((d) => d.id === selectedTargetId) || available[0];
                const targetCols = selectedTarget?.columns || [];
                const currentCols = activeDataset.columns || [];
                const joinTypes = [
                  { id: 'inner', label: 'Inner' },
                  { id: 'left', label: 'Left' },
                  { id: 'right', label: 'Right' },
                  { id: 'outer', label: 'Full Outer' },
                  { id: 'cross', label: 'Cross' },
                ];
                const activeHow = params.how || 'inner';

                if (available.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Stage at least 2 datasets to join tables.</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/80 border border-indigo-100 dark:border-indigo-950/50 rounded-xl animate-fadeIn">
                    {/* Target Table */}
                    <div>
                      <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                        Target Table
                      </label>
                      <select
                        value={selectedTargetId || ''}
                        onChange={(e) => {
                          const newTarget = available.find((d) => d.id === e.target.value);
                          setParams({
                            ...params,
                            target_dataset_id: e.target.value,
                            right_on: newTarget?.columns?.[0]?.name || '',
                            suffix_right: newTarget ? `_${newTarget.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 10)}` : '_joined'
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      >
                        {available.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.row_count} rows)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Join Type */}
                    <div>
                      <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                        Join Type
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {joinTypes.map((jt) => {
                          const isSelected = activeHow === jt.id;
                          return (
                            <button
                              key={jt.id}
                              type="button"
                              onClick={() => setParams({ ...params, how: jt.id })}
                              className={`py-1.5 px-2 rounded-lg border text-center text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {jt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Key Columns */}
                    <div>
                      <label className="block text-[11px] text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                        Join Keys
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={params.left_on || currentCols[0]?.name || ''}
                          onChange={(e) => setParams({ ...params, left_on: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                        >
                          {currentCols.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>

                        <select
                          value={params.right_on || targetCols[0]?.name || ''}
                          onChange={(e) => setParams({ ...params, right_on: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                        >
                          {targetCols.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Column Suffix */}
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                        Column Suffix
                      </label>
                      <input
                        type="text"
                        value={params.suffix_right || '_joined'}
                        onChange={(e) => setParams({ ...params, suffix_right: e.target.value })}
                        placeholder="_joined"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })()}

              {ruleType === 'derived_column' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">New Column Name</label>
                    <input
                      type="text"
                      value={params.column_name || ''}
                      onChange={(e) => setParams({ ...params, column_name: e.target.value })}
                      placeholder="total_revenue"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Formula / Expression</label>
                    <input
                      type="text"
                      value={params.expression || ''}
                      onChange={(e) => setParams({ ...params, expression: e.target.value })}
                      placeholder="unit_price * quantity"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-sky-700 dark:text-sky-300 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'string_transform' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Column</label>
                    <select
                      value={params.column || activeDataset.columns[0]?.name}
                      onChange={(e) => setParams({ ...params, column: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                    >
                      {activeDataset.columns.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Action</label>
                    <select
                      value={params.operation || 'upper'}
                      onChange={(e) => setParams({ ...params, operation: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white"
                    >
                      <option value="upper">UPPERCASE</option>
                      <option value="lower">lowercase</option>
                      <option value="trim">Trim</option>
                    </select>
                  </div>
                </div>
              )}

              {ruleType === 'rename_column' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Old Column</label>
                    <select
                      value={params.old_name || activeDataset.columns[0]?.name}
                      onChange={(e) => setParams({ ...params, old_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                    >
                      {activeDataset.columns.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">New Name</label>
                    <input
                      type="text"
                      value={params.new_name || ''}
                      onChange={(e) => setParams({ ...params, new_name: e.target.value })}
                      placeholder="renamed_column"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'spark_sql' && (
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">SQL Query on Table 'df'</label>
                  <textarea
                    rows={2}
                    value={params.query || ''}
                    onChange={(e) => setParams({ ...params, query: e.target.value })}
                    placeholder="SELECT *, (amount * 1.05) as amount_with_tax FROM df"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-sky-700 dark:text-sky-300 font-mono focus:outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveOrUpdateRule}
                  className={`flex-1 py-2 sm:py-1.5 rounded-lg text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all ${
                    editingRuleId 
                      ? 'bg-amber-600 hover:bg-amber-500' 
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400'
                  }`}
                >
                  {editingRuleId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{editingRuleId ? 'Update Rule' : 'Add Rule to Pipeline'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rules Pipeline Stack with Edit & Reorder controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                <span>Configured Rules ({rules.length})</span>
              </h4>

              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                Auto-saved
              </span>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center font-mono">No transformation rules configured yet.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                      editingRuleId === rule.id
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-400'
                        : rule.enabled
                          ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                          : 'bg-slate-100/50 dark:bg-slate-950/30 border-dashed border-slate-300 dark:border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 block">
                          {rule.rule_type}
                        </span>
                        <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">
                          {rule.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        onClick={() => handleMoveRule(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveRule(idx, 1)}
                        disabled={idx === rules.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(rule)}
                        className={`p-1 transition-colors ${
                          editingRuleId === rule.id ? 'text-amber-600' : 'text-slate-400 hover:text-amber-600'
                        }`}
                        title="Edit Rule"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Toggle On/Off */}
                      <button
                        type="button"
                        onClick={() => handleToggle(idx)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          rule.enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {rule.enabled ? 'ON' : 'OFF'}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Data Preview */}
        <div className="lg:col-span-7 space-y-4">
          {previewResult ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <span>Execution Time: <strong>{previewResult.execution_time_ms.toFixed(1)} ms</strong></span>
                <span>Rows: <strong>{previewResult.initial_rows.toLocaleString()} → {previewResult.transformed_rows.toLocaleString()}</strong></span>
              </div>

              <DataGrid
                title={`Live Preview (${activeDataset.name})`}
                subtitle={`Applied ${rules.filter((r) => r.enabled).length} transformations on stage dataset`}
                columns={previewResult.columns}
                rows={previewResult.preview_rows}
                totalRows={previewResult.transformed_rows}
                pageSize={25}
                currentPage={1}
                onPageChange={() => {}}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs space-y-2">
              <Sliders className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">Live Apache Spark Transformation Preview</p>
              <p>Add rules on the left and click <strong>Live Preview</strong> to inspect the transformed schema & rows in real-time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
