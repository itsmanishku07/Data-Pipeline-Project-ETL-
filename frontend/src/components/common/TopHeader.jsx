import React from 'react';
import { ChevronRight, GitBranch, Menu } from 'lucide-react';

const sectionTitles = {
  1: { title: 'Data Source Ingestion', subtitle: 'Connect to PostgreSQL, MySQL, SQL Server, S3, or Azure Lakehouse' },
  2: { title: 'Schema Definition & Type Casting', subtitle: 'Inspect inferred DataFrame columns and customize Apache Spark data types' },
  3: { title: 'Lakehouse Staging Repository', subtitle: 'Browse flows and preview staged datasets stored in MySQL staging layer' },
  4: { title: 'Transformation Rule Studio', subtitle: 'Chain PySpark filters, math formulas, string operations, and Spark SQL' },
  5: { title: 'Pipeline DAG Execution', subtitle: 'Compile and run the end-to-end transformation job and export golden files' },
  6: { title: 'MySQL Metadata & Audit Logs', subtitle: 'Explore persistent execution history, ingestion metrics, and audit trail' },
};

export const TopHeader = ({ 
  currentStep, 
  flows = [], 
  activeFlowId, 
  onSelectFlow, 
  activeDatasetName,
  onOpenMobileMenu
}) => {
  const info = sectionTitles[currentStep] || sectionTitles[1];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sticky top-0 z-30 transition-colors">
      <div className="flex items-center space-x-3">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 md:hidden transition-colors"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider shrink-0">
              Step {currentStep}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {info.title}
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-xs sm:max-w-md md:max-w-none">
            {info.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 self-end sm:self-auto">
        {/* Flow Selector Dropdown */}
        {flows.length > 0 && (
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs">
            <GitBranch className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="hidden sm:inline text-slate-400 text-[10px] uppercase font-semibold">Flow:</span>
            <select
              value={activeFlowId || (flows[0]?.id || '')}
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[160px] truncate"
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
          <div className="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-mono">
            <span className="hidden sm:inline text-emerald-700 dark:text-emerald-400 text-[10px]">Dataset:</span>
            <strong className="text-emerald-900 dark:text-emerald-200 font-bold truncate max-w-[100px] sm:max-w-[140px]">{activeDatasetName}</strong>
          </div>
        )}
      </div>
    </header>
  );
};
