import React from 'react';
import { ChevronRight, GitBranch, Menu, PanelLeftOpen, Clock, Layers } from 'lucide-react';
import { useTimezone } from '../../context/TimezoneContext';

const sectionTitles = {
  0: { title: 'Data Flows', subtitle: 'Manage and monitor your data pipelines' },
  1: { title: 'Connect Source', subtitle: 'Connect to databases, cloud storage, or APIs' },
  2: { title: 'Schema Profiling', subtitle: 'Review and configure data types' },
  3: { title: 'Staging Area', subtitle: 'Preview and manage staged datasets' },
  4: { title: 'Transformations', subtitle: 'Build data transformation rules' },
  5: { title: 'Execute Pipeline', subtitle: 'Run and export transformed data' },
  6: { title: 'History', subtitle: 'View execution logs and audit trail' },
  7: { title: 'Schedules', subtitle: 'Automate pipeline execution with cron jobs' },
  8: { title: 'Settings', subtitle: 'Configure database and preferences' },
  9: { title: 'Documentation', subtitle: 'Client guide to every application tab and workflow' },
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
  const { currentTime, formatTime, timezoneShort, effectiveTimezone } = useTimezone();

  return (
    <header className="h-16 glass border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
      <div className="flex items-center space-x-4 min-w-0 flex-1">
        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle */}
        {isSidebarHidden && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm font-medium"
            title="Show Sidebar (Ctrl+B)"
            aria-label="Show Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <span>Show Sidebar</span>
          </button>
        )}

        {/* Page Title */}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {info.title}
          </h1>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 truncate">
            {info.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 shrink-0">
        {/* Flow Selector */}
        {flows.length > 0 && currentStep !== 8 && (
          <div className="hidden sm:flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg text-sm shadow-sm">
            <GitBranch className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={activeFlowId || 'all'}
              onChange={(e) => onSelectFlow && onSelectFlow(e.target.value)}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white focus:outline-none cursor-pointer max-w-[150px] truncate"
            >
              <option value="all">All Flows ({flows.length})</option>
              {flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Active Dataset Badge */}
        {activeDatasetName && currentStep >= 3 && currentStep <= 5 && (
          <div className="hidden lg:flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 rounded-lg">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate max-w-[120px]">
              {activeDatasetName}
            </span>
          </div>
        )}

        {/* Live Clock */}
        <div
          className="hidden md:flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg"
          title={`Timezone: ${effectiveTimezone}`}
        >
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {timezoneShort}
          </span>
        </div>
      </div>
    </header>
  );
};
