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
    <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div 
          className="flex items-center space-x-2.5 cursor-pointer select-none"
          onClick={() => onStepClick(1)}
        >
          <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight">DataFlow Studio</span>
          </div>
        </div>

        {/* Modular Step Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-md border border-zinc-200 dark:border-zinc-700/60">
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
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : isAccessible
                    ? 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
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
          <div className="flex items-center space-x-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-sans font-medium">Ready</span>
          </div>

          {/* Sun / Moon Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-xs"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
