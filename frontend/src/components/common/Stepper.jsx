import React from 'react';

const steps = [
  { number: 1, label: 'Data Source Ingestion' },
  { number: 2, label: 'Schema Profiler & Types' },
  { number: 3, label: 'Lakehouse Staging' },
  { number: 4, label: 'Transformation Studio' },
  { number: 5, label: 'Spark Execution' },
];

export const Stepper = ({ currentStep, onStepChange, maxStepReached }) => {
  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800/80 px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Pipeline Workflow:</span>
          <span className="text-slate-900 dark:text-white font-bold font-mono">
            {steps.find((s) => s.number === currentStep)?.label}
          </span>
        </div>

        {/* Minimal Progress Dots */}
        <div className="flex items-center space-x-2">
          {steps.map((step) => {
            const isCurrent = currentStep === step.number;
            const isCompleted = step.number < currentStep;
            const isClickable = step.number <= Math.max(currentStep, maxStepReached);

            return (
              <button
                key={step.number}
                type="button"
                onClick={() => isClickable && onStepChange(step.number)}
                disabled={!isClickable}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                  isCurrent
                    ? 'bg-slate-900 text-white dark:bg-sky-500/20 dark:text-sky-300 dark:border dark:border-sky-500/40 font-semibold'
                    : isCompleted
                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>Step {step.number}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
