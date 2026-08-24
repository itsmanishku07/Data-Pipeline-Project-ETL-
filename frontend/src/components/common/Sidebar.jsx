import React from 'react';
import { 
  Database, 
  Sparkles, 
  Layers, 
  Sliders, 
  PlayCircle, 
  History, 
  Cpu, 
  Sun, 
  Moon, 
  ChevronRight,
  HardDrive
} from 'lucide-react';

const navItems = [
  { 
    id: 1, 
    label: 'Data Sources', 
    description: 'Connect & Ingest',
    icon: Database,
    badge: 'Step 1'
  },
  { 
    id: 2, 
    label: 'Schema Casting', 
    description: 'Spark Types & Profiling',
    icon: Sparkles,
    badge: 'Step 2'
  },
  { 
    id: 3, 
    label: 'Staging Area', 
    description: 'Lakehouse Staged Sets',
    icon: Layers,
    badge: 'Step 3'
  },
  { 
    id: 4, 
    label: 'Transform Studio', 
    description: 'Filters, SQL & Math Rules',
    icon: Sliders,
    badge: 'Step 4'
  },
  { 
    id: 5, 
    label: 'Pipeline Runner', 
    description: 'Job DAG & File Exports',
    icon: PlayCircle,
    badge: 'Step 5'
  },
  { 
    id: 6, 
    label: 'History & Logs', 
    description: 'MySQL Metadata & Audit',
    icon: History,
    badge: 'Store'
  },
];

export const Sidebar = ({ 
  currentStep, 
  onStepClick, 
  maxStepReached = 6, 
  isDark, 
  onToggleTheme,
  stagedCount = 0
}) => {
  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 transition-colors z-40 select-none">
      {/* Brand Header */}
      <div>
        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div 
            className="cursor-pointer"
            onClick={() => onStepClick(1)}
          >
            <h1 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-none">
              DataFlow Studio
            </h1>
            <span className="text-[10px] text-slate-400 font-mono block mt-1">PySpark & Lakehouse</span>
          </div>

          {/* Theme Switcher in Sidebar Header */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>
        </div>

        {/* Navigation Menu List */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Pipeline Workspace
            </span>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.id;
            const isAccessible = item.id <= Math.max(currentStep, maxStepReached) || item.id === 6;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => isAccessible && onStepClick(item.id)}
                disabled={!isAccessible}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm font-semibold'
                    : isAccessible
                    ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {item.label}
                    </p>
                    <p className={`text-[10px] truncate ${isActive ? 'text-slate-300 dark:text-sky-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.id === 3 && stagedCount > 0 ? (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {stagedCount}
                  </span>
                ) : (
                  <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
