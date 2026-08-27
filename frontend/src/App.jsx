import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/common/Sidebar';
import { TopHeader } from './components/common/TopHeader';
import { FlowsOverviewTrackerView } from './components/flows/FlowsOverviewTrackerView';
import { SourceConnectorView } from './components/sources/SourceConnectorView';
import { SchemaEditorView } from './components/schema/SchemaEditorView';
import { StagingAreaView } from './components/staging/StagingAreaView';
import { TransformationStudioView } from './components/transform/TransformationStudioView';
import { PipelineExecutionView } from './components/pipeline/PipelineExecutionView';
import { HistoryAuditView } from './components/history/HistoryAuditView';
import { DataFlowAPI } from './services/api';
import { 
  GitBranch,
  Database, 
  Sparkles, 
  Layers, 
  Sliders, 
  PlayCircle, 
  History 
} from 'lucide-react';

const mobileNavItems = [
  { id: 0, label: 'Flows', icon: GitBranch },
  { id: 1, label: 'Sources', icon: Database },
  { id: 2, label: 'Schema', icon: Sparkles },
  { id: 3, label: 'Staging', icon: Layers },
  { id: 4, label: 'Transform', icon: Sliders },
  { id: 5, label: 'Pipeline', icon: PlayCircle },
  { id: 6, label: 'History', icon: History },
];

export const App = () => {
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem('dataflow_current_step');
      const num = Number(saved);
      return num >= 0 && num <= 6 ? num : 0;
    } catch {
      return 0;
    }
  });

  const [maxStepReached, setMaxStepReached] = useState(6);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Flows state with persistence
  const [flows, setFlows] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(() => {
    try {
      return localStorage.getItem('dataflow_active_flow_id') || null;
    } catch {
      return null;
    }
  });

  // Sidebar Hide / Unhide State
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      const saved = localStorage.getItem('dataflow_sidebar_hidden');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('dataflow_sidebar_hidden', String(sidebarHidden));
    } catch {}
  }, [sidebarHidden]);

  const toggleSidebar = () => {
    setSidebarHidden((prev) => !prev);
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarHidden((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('dataflow_current_step', String(currentStep));
    } catch {}
  }, [currentStep]);

  useEffect(() => {
    try {
      if (activeFlowId) {
        localStorage.setItem('dataflow_active_flow_id', activeFlowId);
      }
    } catch {}
  }, [activeFlowId]);

  // Theme Management (Light / Dark)
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('dataflow_theme');
      return saved !== null ? saved === 'dark' : false; // Default to clean light mode
    } catch {
      return false;
    }
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

  // Workflow shared state with session persistence for in-progress schema profiling
  const [sourceRequest, setSourceRequest] = useState(() => {
    try {
      const saved = sessionStorage.getItem('dataflow_source_request');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [inspectionResult, setInspectionResult] = useState(() => {
    try {
      const saved = sessionStorage.getItem('dataflow_inspection_result');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (sourceRequest) sessionStorage.setItem('dataflow_source_request', JSON.stringify(sourceRequest));
      else sessionStorage.removeItem('dataflow_source_request');
    } catch {}
  }, [sourceRequest]);

  useEffect(() => {
    try {
      if (inspectionResult) sessionStorage.setItem('dataflow_inspection_result', JSON.stringify(inspectionResult));
      else sessionStorage.removeItem('dataflow_inspection_result');
    } catch {}
  }, [inspectionResult]);

  const [activeStagedDataset, setActiveStagedDataset] = useState(null);
  const [allStagedDatasets, setAllStagedDatasets] = useState([]);
  const [activeRules, setActiveRules] = useState([]);

  useEffect(() => {
    try {
      if (activeStagedDataset?.id) {
        localStorage.setItem('dataflow_active_dataset_id', activeStagedDataset.id);
      }
    } catch {}
  }, [activeStagedDataset]);

  // Load Flows & Staged Datasets
  const refreshFlowsAndDatasets = async () => {
    try {
      const flowList = await DataFlowAPI.listFlows();
      setFlows(flowList);
      
      let effectiveFlow = activeFlowId;
      if (flowList.length > 0) {
        const found = flowList.find((f) => f.id === activeFlowId);
        if (!found) {
          effectiveFlow = flowList[0].id;
          setActiveFlowId(effectiveFlow);
        }
      }

      const list = await DataFlowAPI.listStagedDatasets(effectiveFlow);
      setAllStagedDatasets(list);

      const savedDsId = localStorage.getItem('dataflow_active_dataset_id');
      if (savedDsId && list.length > 0) {
        const match = list.find((d) => d.id === savedDsId);
        if (match) {
          setActiveStagedDataset(match);
        } else {
          setActiveStagedDataset(list[0]);
        }
      } else if (list.length > 0 && !activeStagedDataset) {
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

  // Sources -> Schema Handlers
  const handleSourceInspected = (req, result) => {
    setSourceRequest(req);
    setInspectionResult(result);
    goToStep(2);
  };

  // Schema -> Staging Handlers
  const handleDatasetStaged = (stagedInfo) => {
    setActiveStagedDataset(stagedInfo);
    setAllStagedDatasets((prev) => [stagedInfo, ...prev.filter((d) => d.id !== stagedInfo.id)]);
    refreshFlowsAndDatasets();
    goToStep(3);
  };

  // Staging -> Transform Handlers
  const handleSelectDatasetForTransform = (dataset) => {
    setActiveStagedDataset(dataset);
    goToStep(4);
  };

  // Transform -> Pipeline Execution Handlers
  const handleProceedToExecution = (dataset, rules, flowId = null) => {
    setActiveStagedDataset(dataset);
    setActiveRules(rules);
    if (flowId) {
      setActiveFlowId(flowId);
    } else if (dataset?.flow_id) {
      setActiveFlowId(dataset.flow_id);
    }
    goToStep(5);
  };

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200 antialiased overflow-hidden">
      {/* Left Modern Sidebar (Desktop + Mobile Sliding Drawer) */}
      <Sidebar
        currentStep={currentStep}
        onStepClick={goToStep}
        maxStepReached={maxStepReached}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        stagedCount={allStagedDatasets.length}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isHidden={sidebarHidden}
        onToggleHide={toggleSidebar}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        <TopHeader 
          currentStep={currentStep} 
          flows={flows}
          activeFlowId={activeFlowId}
          onSelectFlow={handleFlowSelect}
          activeDatasetName={activeStagedDataset?.name} 
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          isSidebarHidden={sidebarHidden}
          onToggleSidebar={toggleSidebar}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-20 md:pb-6">
          {currentStep === 0 && (
            <FlowsOverviewTrackerView
              flows={flows}
              activeFlowId={activeFlowId}
              onSelectFlow={handleFlowSelect}
              onNavigateToStep={goToStep}
              onRefreshFlows={refreshFlowsAndDatasets}
            />
          )}

          {currentStep === 1 && (
            <SourceConnectorView 
              flows={flows}
              activeFlowId={activeFlowId}
              onSelectFlow={handleFlowSelect}
              onRefreshFlows={refreshFlowsAndDatasets}
              onSourceInspected={handleSourceInspected}
              onNavigateToStep={goToStep}
            />
          )}

          {currentStep === 2 && (
            sourceRequest && inspectionResult ? (
              <SchemaEditorView
                sourceRequest={sourceRequest}
                inspectionResult={inspectionResult}
                activeFlowId={activeFlowId}
                onBack={() => goToStep(1)}
                onDatasetStaged={handleDatasetStaged}
              />
            ) : (
              <SourceConnectorView 
                flows={flows}
                activeFlowId={activeFlowId}
                onSelectFlow={handleFlowSelect}
                onRefreshFlows={refreshFlowsAndDatasets}
                onSourceInspected={handleSourceInspected}
                onNavigateToStep={goToStep}
              />
            )
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
              activeFlowId={activeFlowId}
              flows={flows}
              onSelectFlow={handleFlowSelect}
              onProceedToExecution={handleProceedToExecution}
              onBackToStaging={() => goToStep(3)}
            />
          )}

          {currentStep === 5 && (
            <PipelineExecutionView
              stagedDataset={activeStagedDataset}
              rules={activeRules}
              flows={flows}
              activeFlowId={activeFlowId}
              allStagedDatasets={allStagedDatasets}
              onSelectFlow={handleFlowSelect}
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

      {/* Mobile Bottom Navigation Bar (Ultra Fast 1-Tap Mobile Switching) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-30 md:hidden flex items-center justify-between px-1.5 py-1 safe-area-pb shadow-lg">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentStep === item.id;
          const isAccessible = item.id === 0 || item.id <= Math.max(currentStep, maxStepReached) || item.id === 6;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => isAccessible && goToStep(item.id)}
              disabled={!isAccessible}
              className={`flex-1 min-w-[40px] max-w-[56px] flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400 font-bold'
                  : isAccessible
                  ? 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  : 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className={`p-1 rounded-md ${isActive ? 'bg-sky-50 dark:bg-sky-500/10' : ''}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] leading-tight mt-0.5 tracking-tight truncate w-full text-center">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
