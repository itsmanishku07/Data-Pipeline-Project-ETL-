import React from 'react';

const steps = [
  { number: 1, label: 'Data Source Ingestion' },
  { number: 2, label: 'Schema Profiler & Types' },
  { number: 3, label: 'Lakehouse Staging' },
  { number: 4, label: 'Transformation Studio' },
  { number: 5, label: 'Pipeline Execution' },
];

export const Stepper = ({ currentStep, onStepChange, maxStepReached }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-2 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Pipeline Workflow:</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">
            {steps.find((s) => s.number === currentStep)?.label}
          </span>
        </div>

        {/* Minimal Progress Dots */}
        <div className="flex items-center space-x-1.5">
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
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : isCompleted
                    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
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
