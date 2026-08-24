import React from 'react';
import { ChevronRight, GitBranch } from 'lucide-react';

const sectionTitles = {
  1: { title: 'Data Source Ingestion', subtitle: 'Connect to PostgreSQL, MySQL, SQL Server, S3, or Azure Lakehouse' },
  2: { title: 'Schema Definition & Type Casting', subtitle: 'Inspect inferred DataFrame columns and customize Apache Spark data types' },
  3: { title: 'Lakehouse Staging Repository', subtitle: 'Browse flows and preview staged datasets stored in optimized Parquet format' },
  4: { title: 'Transformation Rule Studio', subtitle: 'Chain PySpark filters, math formulas, string operations, and Spark SQL' },
  5: { title: 'Pipeline DAG Execution', subtitle: 'Compile and run the end-to-end transformation job and export golden files' },
  6: { title: 'MySQL Metadata & Audit Logs', subtitle: 'Explore persistent execution history, ingestion metrics, and audit trail' },
};

export const TopHeader = ({ 
  currentStep, 
  flows = [], 
  activeFlowId, 
  onSelectFlow, 
  activeDatasetName 
}) => {
  const info = sectionTitles[currentStep] || sectionTitles[1];
  const activeFlow = flows.find((f) => f.id === activeFlowId);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider">
            Step {currentStep}
          </span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {info.title}
          </h2>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {info.subtitle}
        </p>
      </div>

      <div className="flex items-center space-x-3">
        {/* Flow Selector Dropdown */}
        {flows.length > 0 && (
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-xs">
            <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-slate-400 text-[10px] uppercase font-semibold">Active Flow:</span>
            <select
              value={activeFlowId || (flows[0]?.id || '')}
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {flows.map((f) => (
                <option key={f.id} value={f.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Active Dataset Pill */}
        {activeDatasetName && currentStep >= 3 && currentStep <= 5 && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 text-[10px]">Dataset:</span>
            <strong className="text-emerald-900 dark:text-emerald-200 font-bold">{activeDatasetName}</strong>
          </div>
        )}
      </div>
    </header>
  );
};
