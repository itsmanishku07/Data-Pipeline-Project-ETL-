import React from 'react';
import { 
  GitBranch,
  Database, 
  Sparkles, 
  Layers, 
  Sliders, 
  PlayCircle, 
  History, 
  Sun, 
  Moon, 
  X,
  PanelLeftClose
} from 'lucide-react';

const navItems = [
  { 
    id: 0, 
    label: 'Flows Tracker', 
    description: 'Stage Progress & Matrix',
    icon: GitBranch,
    badge: 'Tracker'
  },
  { 
    id: 1, 
    label: 'Data Sources', 
    description: 'Connect & Ingest',
    icon: Database,
    badge: 'Ingest'
  },
  { 
    id: 2, 
    label: 'Schema Casting', 
    description: 'Spark Types & Profiling',
    icon: Sparkles,
    badge: 'Schema'
  },
  { 
    id: 3, 
    label: 'Staging Area', 
    description: 'Lakehouse Staged Sets',
    icon: Layers,
    badge: 'Staging'
  },
  { 
    id: 4, 
    label: 'Transform Studio', 
    description: 'Filters, SQL & Math Rules',
    icon: Sliders,
    badge: 'Studio'
  },
  { 
    id: 5, 
    label: 'Pipeline Runner', 
    description: 'Job DAG & File Exports',
    icon: PlayCircle,
    badge: 'Runner'
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
  stagedCount = 0,
  isOpen = false,
  onClose,
  isHidden = false,
  onToggleHide
}) => {
  const handleItemClick = (id) => {
    onStepClick(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed md:relative top-0 left-0 z-50 md:z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-screen transition-all duration-300 ease-in-out select-none ${
          isOpen
            ? 'w-72 translate-x-0 opacity-100 pointer-events-auto'
            : isHidden
            ? 'w-0 -translate-x-full md:w-0 md:opacity-0 md:pointer-events-none md:border-r-0 overflow-hidden'
            : 'w-72 md:w-64 -translate-x-full md:translate-x-0 md:opacity-100'
        }`}
      >
        {/* Brand Header & Menu Wrapper */}
        <div className="w-72 md:w-64 flex flex-col h-full">
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div 
              className="cursor-pointer"
              onClick={() => handleItemClick(0)}
            >
              <h1 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-none">
                DataFlow Studio
              </h1>
              <span className="text-[10px] text-slate-400 font-mono block mt-1">PySpark & Lakehouse</span>
            </div>

            <div className="flex items-center space-x-1">
              {/* Theme Switcher */}
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

              {/* Hide / Collapse Sidebar on Desktop */}
              {onToggleHide && (
                <button
                  type="button"
                  onClick={onToggleHide}
                  className="hidden md:flex p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Hide Sidebar (Ctrl+B)"
                  aria-label="Hide Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Close Button on Mobile */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 md:hidden transition-colors"
                title="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Menu List */}
          <div className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
            <div className="px-2 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pipeline Workspace
              </span>
              <span className="text-[9px] font-mono text-slate-400 hidden md:inline">Ctrl+B</span>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentStep === item.id;
              const isAccessible = item.id === 0 || item.id <= Math.max(currentStep, maxStepReached) || item.id === 6;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => isAccessible && handleItemClick(item.id)}
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
    </>
  );
};
