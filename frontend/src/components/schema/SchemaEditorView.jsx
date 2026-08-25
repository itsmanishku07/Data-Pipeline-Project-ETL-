import React, { useState, useEffect } from 'react';
import { 
  Binary, 
  ArrowLeft, 
  ArrowRight, 
  Layers, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import { DataFlowAPI } from '../../services/api';
import { DataGrid } from '../common/DataGrid';

export const SchemaEditorView = ({
  sourceRequest,
  inspectionResult,
  activeFlowId,
  onBack,
  onDatasetStaged,
}) => {
  const [castRules, setCastRules] = useState({});
  const [stagingName, setStagingName] = useState(
    `${sourceRequest.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_staged`
  );
  const [stagingLoading, setStagingLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const initialRules = {};
    inspectionResult.columns.forEach((col) => {
      initialRules[col.name] = {
        column_name: col.name,
        target_spark_type: col.spark_type,
        format: col.spark_type === 'TimestampType' ? 'yyyy-MM-dd HH:mm:ss' : (col.spark_type === 'DateType' ? 'yyyy-MM-dd' : undefined),
      };
    });
    setCastRules(initialRules);
  }, [inspectionResult]);

  const handleTypeChange = (columnName, newType) => {
    setCastRules((prev) => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        target_spark_type: newType,
        format: newType === 'TimestampType' ? 'yyyy-MM-dd HH:mm:ss' : (newType === 'DateType' ? 'yyyy-MM-dd' : undefined),
      },
    }));
  };

  const handleFormatChange = (columnName, format) => {
    setCastRules((prev) => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        format,
      },
    }));
  };

  const handleTestCast = async () => {
    setValidationLoading(true);
    setErrorMsg(null);
    try {
      const rulesList = Object.values(castRules);
      const res = await DataFlowAPI.validateCast(sourceRequest, rulesList);
      setValidationResult(res);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Casting validation failed');
    } finally {
      setValidationLoading(false);
    }
  };

  const handleStageDataset = async () => {
    setStagingLoading(true);
    setErrorMsg(null);
    try {
      const rulesList = Object.values(castRules);
      const stagedInfo = await DataFlowAPI.stageDataset({
        source_request: sourceRequest,
        dataset_name: stagingName,
        description: `Staged from ${sourceRequest.name}`,
        flow_id: activeFlowId,
        cast_rules: rulesList,
      });
      onDatasetStaged(stagedInfo);
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to stage dataset');
    } finally {
      setStagingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
            <Binary className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schema Profiler & Spark Type Casting</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Source: <strong className="text-sky-600 dark:text-sky-300">{sourceRequest.name}</strong> •{' '}
              {inspectionResult.row_count} rows • {inspectionResult.column_count} cols
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleTestCast}
            disabled={validationLoading || stagingLoading}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${validationLoading ? 'animate-spin' : ''}`} />
            <span>Validate Types</span>
          </button>
        </div>
      </div>

      {/* Type Casting Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
        <div className="overflow-x-auto max-h-[340px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-3">Column Name</th>
                <th className="py-2.5 px-3">Inferred Type</th>
                <th className="py-2.5 px-3">Target Spark Type</th>
                <th className="py-2.5 px-3">Format Pattern</th>
                <th className="py-2.5 px-3">Null %</th>
                <th className="py-2.5 px-3">Distinct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-xs font-mono">
              {inspectionResult.columns.map((col, idx) => {
                const currentRule = castRules[col.name] || {
                  column_name: col.name,
                  target_spark_type: col.spark_type,
                };
                const isModified = currentRule.target_spark_type !== col.spark_type;

                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{col.name}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">{col.spark_type}</td>
                    <td className="py-2 px-3">
                      <select
                        value={currentRule.target_spark_type}
                        onChange={(e) => handleTypeChange(col.name, e.target.value)}
                        className={`px-2.5 py-1 rounded text-xs font-mono border focus:outline-none ${
                          isModified
                            ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/50'
                            : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-sky-300'
                        }`}
                      >
                        <option value="StringType">StringType</option>
                        <option value="IntegerType">IntegerType</option>
                        <option value="LongType">LongType</option>
                        <option value="DoubleType">DoubleType</option>
                        <option value="DecimalType(10,2)">DecimalType(10,2)</option>
                        <option value="BooleanType">BooleanType</option>
                        <option value="DateType">DateType</option>
                        <option value="TimestampType">TimestampType</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      {currentRule.target_spark_type === 'TimestampType' || currentRule.target_spark_type === 'DateType' ? (
                        <input
                          type="text"
                          value={currentRule.format || ''}
                          onChange={(e) => handleFormatChange(col.name, e.target.value)}
                          placeholder="yyyy-MM-dd HH:mm:ss"
                          className="px-2 py-0.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-slate-900 dark:text-amber-300 font-mono w-36"
                        />
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                      {col.null_count > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{col.null_percentage}%</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0%</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 text-[11px]">{col.distinct_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Extracted Data Preview Grid */}
      <DataGrid
        title="Raw Extracted Data Slice"
        columns={inspectionResult.columns}
        rows={validationResult ? validationResult.preview_rows : inspectionResult.preview_rows}
      />

      {/* Stage Action Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 shrink-0">Staged Name:</label>
          <input
            type="text"
            value={stagingName}
            onChange={(e) => setStagingName(e.target.value)}
            className="px-3 py-2 sm:py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-initial text-center px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleStageDataset}
            disabled={stagingLoading || !stagingName.trim()}
            className="flex-1 sm:flex-initial justify-center px-5 py-2 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{stagingLoading ? 'Staging...' : 'Stage Dataset'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
