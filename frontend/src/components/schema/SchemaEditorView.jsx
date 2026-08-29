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
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs transition-colors">
        <div className="flex items-center space-x-2.5">
          <Binary className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Schema Profiler & Type Casting</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              Source: <strong className="text-zinc-900 dark:text-zinc-100">{sourceRequest.name}</strong> •{' '}
              {inspectionResult.row_count} rows • {inspectionResult.column_count} columns
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleTestCast}
            disabled={validationLoading || stagingLoading}
            className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${validationLoading ? 'animate-spin' : ''}`} />
            <span>Validate Types</span>
          </button>
        </div>
      </div>

      {/* Type Casting Grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs space-y-3 transition-colors">
        <div className="overflow-x-auto max-h-[340px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="py-2 px-3">Column Name</th>
                <th className="py-2 px-3">Inferred Type</th>
                <th className="py-2 px-3">Target Spark Type</th>
                <th className="py-2 px-3">Format Pattern</th>
                <th className="py-2 px-3">Null %</th>
                <th className="py-2 px-3">Distinct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 text-xs font-mono">
              {inspectionResult.columns.map((col, idx) => {
                const currentRule = castRules[col.name] || {
                  column_name: col.name,
                  target_spark_type: col.spark_type,
                };
                const isModified = currentRule.target_spark_type !== col.spark_type;

                return (
                  <tr key={idx} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">{col.name}</td>
                    <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-xs">{col.spark_type}</td>
                    <td className="py-2 px-3">
                      <select
                        value={currentRule.target_spark_type}
                        onChange={(e) => handleTypeChange(col.name, e.target.value)}
                        className={`px-2 py-1 rounded-md text-xs font-mono border focus:outline-none ${
                          isModified
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-400 dark:border-zinc-600 font-medium'
                            : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
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
                          className="px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono w-40 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      ) : (
                        <span className="text-zinc-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 text-xs">
                      {col.null_count > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">{col.null_percentage}%</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">0%</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 text-xs">{col.distinct_count}</td>
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 shrink-0">Staged Name:</label>
          <input
            type="text"
            value={stagingName}
            onChange={(e) => setStagingName(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-initial text-center px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleStageDataset}
            disabled={stagingLoading || !stagingName.trim()}
            className="flex-1 sm:flex-initial justify-center px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{stagingLoading ? 'Staging...' : 'Stage Dataset'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md border bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/40 dark:text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
