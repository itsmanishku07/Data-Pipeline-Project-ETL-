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
    <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sticky top-0 z-30 transition-colors shrink-0">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 md:hidden transition-colors shrink-0"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border transition-colors shrink-0 text-xs ${
            isSidebarHidden
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium'
              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
          }`}
          title={isSidebarHidden ? "Show Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
          aria-label="Toggle Sidebar"
        >
          {isSidebarHidden ? (
            <>
              <PanelLeftOpen className="w-3.5 h-3.5" />
              <span>Sidebar</span>
            </>
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate tracking-tight">
            {info.title}
          </h2>
          <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {info.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Flow Selector Dropdown */}
        {flows.length > 0 && (
          <div className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 rounded-md text-xs">
            <GitBranch className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span className="hidden md:inline text-zinc-400 dark:text-zinc-500 font-medium">Flow:</span>
            <select
              value={activeFlowId || 'all'}
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="bg-transparent text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[180px] truncate"
            >
              <option value="all" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                All Flows ({flows.length})
              </option>
              {flows.map((f) => (
                <option key={f.id} value={f.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Active Dataset Badge */}
        {activeDatasetName && currentStep >= 3 && currentStep <= 5 && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-md text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-zinc-500 dark:text-zinc-400">Dataset:</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate max-w-[140px]">{activeDatasetName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
