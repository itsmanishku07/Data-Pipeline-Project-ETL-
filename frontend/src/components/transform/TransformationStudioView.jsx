import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Play, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  MoveUp, 
  MoveDown,
  Zap,
  HardDrive,
  FolderOpen,
  Database,
  Search,
  Sparkles
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';
import { DataGrid } from '../common/DataGrid';

export const TransformationStudioView = ({
  allDatasets = [],
  onProceedToExecution,
  onBackToStaging,
}) => {
  // Always start on the "Select Stage for Transformation" page where all stages are listed
  const [activeDataset, setActiveDataset] = useState(null);
  const [rules, setRules] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchStage, setSearchStage] = useState('');

  const [ruleType, setRuleType] = useState('filter');
  const [params, setParams] = useState({});

  const handleSelectStage = (ds) => {
    setActiveDataset(ds);
    setRules([]);
    setPreviewResult(null);
    setErrorMsg(null);
  };

  const handleBackToStagesList = () => {
    setActiveDataset(null);
    setPreviewResult(null);
    setErrorMsg(null);
  };

  const handleAddRule = () => {
    if (!activeDataset || !activeDataset.columns || activeDataset.columns.length === 0) return;
    let p = { ...params };
    let desc = '';

    if (ruleType === 'filter') {
      p.condition = p.condition || `${activeDataset.columns[0]?.name} IS NOT NULL`;
      desc = `Filter: ${p.condition}`;
    } else if (ruleType === 'derived_column') {
      p.column_name = p.column_name || 'derived_metric';
      p.expression = p.expression || '1 + 1';
      desc = `${p.column_name} = ${p.expression}`;
    } else if (ruleType === 'string_transform') {
      p.column = p.column || activeDataset.columns[0]?.name;
      p.operation = p.operation || 'upper';
      desc = `${p.operation.toUpperCase()}(${p.column})`;
    } else if (ruleType === 'rename_column') {
      p.old_name = p.old_name || activeDataset.columns[0]?.name;
      p.new_name = p.new_name || `${p.old_name}_new`;
      desc = `Rename ${p.old_name} -> ${p.new_name}`;
    } else if (ruleType === 'spark_sql') {
      p.query = p.query || 'SELECT * FROM df';
      desc = `SQL Query: ${p.query.slice(0, 30)}...`;
    }

    const newRule = {
      id: `rule_${Date.now()}`,
      rule_type: ruleType,
      params: p,
      description: desc,
      enabled: true,
    };

    setRules([...rules, newRule]);
    setParams({});
  };

  const handleToggle = (idx) => {
    const updated = [...rules];
    updated[idx].enabled = !updated[idx].enabled;
    setRules(updated);
  };

  const handleDelete = (idx) => {
    setRules(rules.filter((_, i) => i !== idx));
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

  const filteredStages = allDatasets.filter((ds) => {
    if (!searchStage.trim()) return true;
    const term = searchStage.toLowerCase();
    return ds.name.toLowerCase().includes(term) || (ds.source_type && ds.source_type.toLowerCase().includes(term));
  });

  // ==========================================
  // LEVEL 1: STAGE SELECTION HUB (When no active stage is selected)
  // ==========================================
  if (!activeDataset) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Select Stage for Transformation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click on any existing stage below to configure Apache Spark transformation rules and run previews.
              </p>
            </div>
          </div>

          {allDatasets.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stages..."
                value={searchStage}
                onChange={(e) => setSearchStage(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-52 font-sans"
              />
            </div>
          )}
        </div>

        {allDatasets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-1" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Staged Sets Found</h3>
            <p className="max-w-sm mx-auto text-slate-400">
              You haven't staged any data yet. Please connect a data source in Step 1 and stage it in Step 2/3.
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
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20 font-bold text-xs">
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {ds.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {ds.source_type}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                    {ds.description || ds.source_summary || 'Staged Parquet Lakehouse table.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 space-x-2">
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{ds.row_count.toLocaleString()}</strong> rows
                    <span>•</span>
                    <span>{ds.column_count} cols</span>
                  </div>

                  <span className="text-xs font-bold text-slate-900 dark:text-sky-400 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Transform</span>
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
  // LEVEL 2: DEDICATED STAGE RULE STUDIO & PREVIEW
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Active Stage Header Card with Back Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleBackToStagesList}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1 text-xs font-semibold"
            title="Back to all stages"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Stages</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase">
                ACTIVE STAGE
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{activeDataset.name}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              ID: {activeDataset.id} • {activeDataset.row_count.toLocaleString()} rows • {activeDataset.column_count} columns
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || rules.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
            <span>{previewLoading ? 'Executing Spark...' : 'Live Preview'}</span>
          </button>

          <button
            type="button"
            onClick={() => onProceedToExecution(activeDataset, rules.filter((r) => r.enabled))}
            disabled={rules.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <span>Proceed to Run DAG</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Rule Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rule Builder & Sequence */}
        <div className="lg:col-span-5 space-y-4">
          {/* Add Step Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Plus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Add Transformation Rule</span>
            </h4>

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

              <button
                type="button"
                onClick={handleAddRule}
                className="w-full mt-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-500 dark:hover:bg-sky-400 text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step to Pipeline</span>
              </button>
            </div>
          </div>

          {/* Rules Pipeline Stack */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between uppercase tracking-wider">
              <span>Pipeline Sequence ({rules.length})</span>
              <span className="text-[10px] text-slate-400 font-mono">{activeDataset.name}</span>
            </h4>

            {rules.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No rules configured for this stage yet.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                      rule.enabled
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
                      <button
                        type="button"
                        onClick={() => handleToggle(idx)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          rule.enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {rule.enabled ? 'ON' : 'OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
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
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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
