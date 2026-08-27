import React from 'react';
import { ChevronRight, GitBranch, Menu, PanelLeft, PanelLeftOpen, PanelLeftClose } from 'lucide-react';

const sectionTitles = {
  0: { title: 'Data Flows Lifecycle Tracker', subtitle: 'Live stage progression monitoring across Ingestion, Schema, Staging, Transform & Execution' },
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
  onOpenMobileMenu,
  isSidebarHidden = false,
  onToggleSidebar
}) => {
  const info = sectionTitles[currentStep] || sectionTitles[1];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sticky top-0 z-30 transition-colors shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 md:hidden transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Sidebar Toggle / Unhide Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`hidden md:flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border transition-all shrink-0 ${
            isSidebarHidden
              ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 font-semibold shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title={isSidebarHidden ? "Unhide Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
          aria-label="Toggle Sidebar"
        >
          {isSidebarHidden ? (
            <>
              <PanelLeftOpen className="w-4 h-4" />
              <span className="text-[11px] font-bold">Sidebar</span>
            </>
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
            {info.title}
          </h2>
          <p className="hidden sm:block text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-xs sm:max-w-md md:max-w-none">
            {info.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Flow Selector Dropdown */}
        {flows.length > 0 && (
          <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs">
            <GitBranch className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="hidden md:inline text-slate-400 text-[10px] uppercase font-semibold">Flow:</span>
            <select
              value={activeFlowId || (flows[0]?.id || '')}
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[160px] truncate"
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
          <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 text-[10px]">Dataset:</span>
            <strong className="text-emerald-900 dark:text-emerald-200 font-bold truncate max-w-[100px] sm:max-w-[140px]">{activeDatasetName}</strong>
          </div>
        )}
      </div>
    </header>
  );
};
