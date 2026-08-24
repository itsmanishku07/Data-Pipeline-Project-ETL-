import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/common/Sidebar';
import { TopHeader } from './components/common/TopHeader';
import { SourceConnectorView } from './components/sources/SourceConnectorView';
import { SchemaEditorView } from './components/schema/SchemaEditorView';
import { StagingAreaView } from './components/staging/StagingAreaView';
import { TransformationStudioView } from './components/transform/TransformationStudioView';
import { PipelineExecutionView } from './components/pipeline/PipelineExecutionView';
import { HistoryAuditView } from './components/history/HistoryAuditView';
import { DataFlowAPI } from './services/api';

export const App = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(6);

  // Flows state
  const [flows, setFlows] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(null);

  // Theme Management (Light / Dark)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('dataflow_theme');
    return saved !== null ? saved === 'dark' : false; // Default to clean light mode
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('dataflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('dataflow_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // Workflow shared state
  const [sourceRequest, setSourceRequest] = useState(null);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [activeStagedDataset, setActiveStagedDataset] = useState(null);
  const [allStagedDatasets, setAllStagedDatasets] = useState([]);
  const [activeRules, setActiveRules] = useState([]);

  // Load Flows & Staged Datasets
  const refreshFlowsAndDatasets = async () => {
    try {
      const flowList = await DataFlowAPI.listFlows();
      setFlows(flowList);
      if (flowList.length > 0 && !activeFlowId) {
        setActiveFlowId(flowList[0].id);
      }

      const list = await DataFlowAPI.listStagedDatasets(activeFlowId);
      setAllStagedDatasets(list);
      if (list.length > 0 && !activeStagedDataset) {
        setActiveStagedDataset(list[0]);
      }
    } catch (err) {
      console.error('Failed to load flows and staged datasets', err);
    }
  };

  useEffect(() => {
    refreshFlowsAndDatasets();
  }, []);

  const handleFlowSelect = async (flowId) => {
    setActiveFlowId(flowId);
    try {
      const list = await DataFlowAPI.listStagedDatasets(flowId);
      setAllStagedDatasets(list);
      if (list.length > 0) {
        setActiveStagedDataset(list[0]);
      } else {
        setActiveStagedDataset(null);
      }
    } catch (err) {
      console.error('Failed to switch flow datasets', err);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
    setMaxStepReached((prev) => Math.max(prev, step));
  };

  // Step 1 -> Step 2 Handlers
  const handleSourceInspected = (req, result) => {
    setSourceRequest(req);
    setInspectionResult(result);
    goToStep(2);
  };

  // Step 2 -> Step 3 Handlers
  const handleDatasetStaged = (stagedInfo) => {
    setActiveStagedDataset(stagedInfo);
    setAllStagedDatasets((prev) => [stagedInfo, ...prev.filter((d) => d.id !== stagedInfo.id)]);
    refreshFlowsAndDatasets();
    goToStep(3);
  };

  // Step 3 -> Step 4 Handlers
  const handleSelectDatasetForTransform = (dataset) => {
    setActiveStagedDataset(dataset);
    goToStep(4);
  };

  // Step 4 -> Step 5 Handlers
  const handleProceedToExecution = (dataset, rules) => {
    setActiveStagedDataset(dataset);
    setActiveRules(rules);
    goToStep(5);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200 antialiased">
      {/* Left Modern Sidebar */}
      <Sidebar
        currentStep={currentStep}
        onStepClick={goToStep}
        maxStepReached={maxStepReached}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        stagedCount={allStagedDatasets.length}
      />

      {/* Main Workspace Area (Clean, No Footer) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopHeader 
          currentStep={currentStep} 
          flows={flows}
          activeFlowId={activeFlowId}
          onSelectFlow={handleFlowSelect}
          activeDatasetName={activeStagedDataset?.name} 
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
          {currentStep === 1 && (
            <SourceConnectorView onSourceInspected={handleSourceInspected} />
          )}

          {currentStep === 2 && sourceRequest && inspectionResult && (
            <SchemaEditorView
              sourceRequest={sourceRequest}
              inspectionResult={inspectionResult}
              activeFlowId={activeFlowId}
              onBack={() => goToStep(1)}
              onDatasetStaged={handleDatasetStaged}
            />
          )}

          {currentStep === 3 && (
            <StagingAreaView
              initialDatasetId={activeStagedDataset?.id}
              activeFlowId={activeFlowId}
              onSelectFlow={handleFlowSelect}
              onSelectDatasetForTransform={handleSelectDatasetForTransform}
              onAddNewSource={() => goToStep(1)}
            />
          )}

          {currentStep === 4 && (
            <TransformationStudioView
              allDatasets={allStagedDatasets}
              onProceedToExecution={handleProceedToExecution}
              onBackToStaging={() => goToStep(3)}
            />
          )}

          {currentStep === 5 && activeStagedDataset && (
            <PipelineExecutionView
              stagedDataset={activeStagedDataset}
              rules={activeRules}
              onViewStagedDataset={(id) => {
                const ds = allStagedDatasets.find((d) => d.id === id);
                if (ds) setActiveStagedDataset(ds);
                goToStep(3);
              }}
              onRestartPipeline={() => goToStep(1)}
            />
          )}

          {currentStep === 6 && (
            <HistoryAuditView />
          )}
        </main>
      </div>
    </div>
  );
};
