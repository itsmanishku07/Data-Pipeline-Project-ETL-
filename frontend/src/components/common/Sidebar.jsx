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
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed md:relative top-0 left-0 z-50 md:z-30 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 h-screen transition-all duration-200 ease-in-out select-none ${
          isOpen
            ? 'w-72 translate-x-0 opacity-100 pointer-events-auto'
            : isHidden
            ? 'w-0 -translate-x-full md:w-0 md:opacity-0 md:pointer-events-none md:border-r-0 overflow-hidden'
            : 'w-72 md:w-60 -translate-x-full md:translate-x-0 md:opacity-100'
        }`}
      >
        {/* Brand Header & Menu Wrapper */}
        <div className="w-72 md:w-60 flex flex-col h-full">
          <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <div 
              className="cursor-pointer flex items-center space-x-2"
              onClick={() => handleItemClick(0)}
            >
              <div className="w-6 h-6 rounded bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xs">
                D
              </div>
              <div>
                <h1 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                  DataFlow Studio
                </h1>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono block mt-0.5">Lakehouse Engine</span>
              </div>
            </div>

            <div className="flex items-center space-x-0.5">
              {/* Theme Switcher */}
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? (
                  <Sun className="w-3.5 h-3.5 text-zinc-300" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </button>

              {/* Hide / Collapse Sidebar on Desktop */}
              {onToggleHide && (
                <button
                  type="button"
                  onClick={onToggleHide}
                  className="hidden md:flex p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 md:hidden transition-colors"
                title="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Menu List */}
          <div className="px-2.5 py-3 space-y-0.5 flex-1 overflow-y-auto">
            <div className="px-2 py-1 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Workspace
              </span>
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 hidden md:inline">⌘B</span>
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-colors text-xs ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium shadow-xs'
                      : isAccessible
                      ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'
                      : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'}`} />
                    <span className="truncate">
                      {item.label}
                    </span>
                  </div>

                  {item.id === 3 && stagedCount > 0 ? (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                      isActive 
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                    }`}>
                      {stagedCount}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive 
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' 
                        : 'text-zinc-400 dark:text-zinc-600'
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
