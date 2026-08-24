import React from 'react';
import { Database, Sparkles, Layers, Sliders, PlayCircle, Cpu, Sun, Moon, History } from 'lucide-react';

const tabs = [
  { id: 1, label: '1. Ingest', icon: Database },
  { id: 2, label: '2. Schema Cast', icon: Sparkles },
  { id: 3, label: '3. Staging', icon: Layers },
  { id: 4, label: '4. Transform', icon: Sliders },
  { id: 5, label: '5. Pipeline', icon: PlayCircle },
  { id: 6, label: '6. History', icon: History },
];

export const Navbar = ({ currentStep, onStepClick, maxStepReached = 6, isDark, onToggleTheme }) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div 
          className="flex items-center space-x-2.5 cursor-pointer select-none"
          onClick={() => onStepClick(1)}
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-sky-500 text-white flex items-center justify-center shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">DataFlow Studio</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-2 font-mono">v1.0</span>
          </div>
        </div>

        {/* Modular Step Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentStep === tab.id;
            const isAccessible = tab.id <= Math.max(currentStep, maxStepReached) || tab.id === 6;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => isAccessible && onStepClick(tab.id)}
                disabled={!isAccessible}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-white shadow-sm font-semibold'
                    : isAccessible
                    ? 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Action Toolbar: Engine Status + Theme Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-sans font-medium">Spark Ready</span>
          </div>

          {/* Sun / Moon Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
