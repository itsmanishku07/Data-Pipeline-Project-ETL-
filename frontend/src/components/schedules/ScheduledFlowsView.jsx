import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  FileText,
  Terminal,
  Copy,
  CheckCheck,
  Info,
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Search,
  Filter,
  Layers,
  Database,
  Cloud,
  FolderTree,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Activity,
  ChevronRight,
  ExternalLink,
  Sliders,
  Server,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  EyeOff,
  Key,
  FolderDown,
  X
} from 'lucide-react';
import { DataFlowAPI, extractErrorMessage } from '../../services/api';
import { ConfirmationModal } from '../common/ConfirmationModal';

const CRON_PRESET_CATEGORIES = [
  {
    category: 'High-Frequency Intervals (Minutes)',
    items: [
      { cron: '*/5 * * * *', label: 'Every 5 Minutes', subtitle: 'Runs continuously every 5 minutes across the hour', badge: '5 Min' },
      { cron: '*/15 * * * *', label: 'Every 15 Minutes', subtitle: 'Quarter-hourly execution (Recommended for near real-time sync)', badge: '15 Min' },
      { cron: '*/30 * * * *', label: 'Every 30 Minutes', subtitle: 'Runs twice an hour on the hour and half-hour', badge: '30 Min' },
    ]
  },
  {
    category: 'Hourly & Multi-Hour Triggers',
    items: [
      { cron: '0 * * * *', label: 'Hourly (Every Hour)', subtitle: 'Runs at minute 00 of every hour', badge: '1 Hour' },
      { cron: '0 */2 * * *', label: 'Every 2 Hours', subtitle: 'Runs every even hour (00:00, 02:00, 04:00...) UTC', badge: '2 Hours' },
      { cron: '0 */6 * * *', label: 'Every 6 Hours', subtitle: 'Runs 4 times a day (00:00, 06:00, 12:00, 18:00) UTC', badge: '6 Hours' },
    ]
  },
  {
    category: 'Daily & Periodic Batches',
    items: [
      { cron: '0 2 * * *', label: 'Daily at 02:00 AM UTC', subtitle: 'Overnight maintenance batch schedule', badge: 'Daily' },
      { cron: '0 0 * * *', label: 'Daily at Midnight UTC', subtitle: 'Runs once at 00:00 UTC at day rollover', badge: 'Midnight' },
      { cron: '0 0 * * 1', label: 'Weekly (Monday Midnight UTC)', subtitle: 'Runs once every week on Monday at 00:00 UTC', badge: 'Weekly' },
      { cron: '0 0 1 * *', label: 'Monthly (1st at Midnight UTC)', subtitle: 'Runs on the 1st day of every month at 00:00 UTC', badge: 'Monthly' },
    ]
  }
];

const CRON_PRESETS = CRON_PRESET_CATEGORIES.flatMap((c) => c.items);


/**
 * Modal to inspect execution history, failure diagnosis, and logs for a scheduled trigger.
 */
export const ScheduleLogsModal = ({ schedule, isOpen, onClose, onRunNow, onEdit }) => {
  const [jobDetails, setJobDetails] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    if (isOpen && schedule?.last_run_job_id) {
      const loadJob = async () => {
        try {
          setLoadingJob(true);
          const data = await DataFlowAPI.getJob(schedule.last_run_job_id);
          if (active) setJobDetails(data);
        } catch (e) {
          if (active) setJobDetails(null);
        } finally {
          if (active) setLoadingJob(false);
        }
      };
      loadJob();
    } else {
      setJobDetails(null);
    }
    return () => { active = false; };
  }, [isOpen, schedule]);

  if (!isOpen || !schedule) return null;

  const isFailed = schedule.last_run_status === 'failed' || schedule.last_run_status === 'FAILED';
  const isCompleted = schedule.last_run_status === 'completed' || schedule.last_run_status === 'SUCCESS';

  const handleCopyMessage = () => {
    const textToCopy = schedule.last_run_message || (jobDetails?.logs ? jobDetails.logs.join('\n') : '');
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTriggerRun = async () => {
    try {
      setRunning(true);
      await onRunNow(schedule);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isFailed
                ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
            }`}>
              {isFailed ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Execution Diagnostic & Logs
                </h2>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  isFailed
                    ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    : isCompleted
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  {schedule.last_run_status || 'PENDING'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Schedule: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{schedule.name}</span> &bull; Flow: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{schedule.flow_name || schedule.flow_id}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Metadata Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">Last Run Time</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : 'Never'}
              </span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">Total Executions</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                {schedule.run_count || 0} runs
              </span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">Execution Job ID</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate block" title={schedule.last_run_job_id || 'N/A'}>
                {schedule.last_run_job_id || 'N/A'}
              </span>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">Next Trigger</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleTimeString() : 'Paused'}
              </span>
            </div>
          </div>

          {/* Error Failure Message Box */}
          {isFailed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-red-600 dark:text-red-400 flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Failure Reason & Diagnostic Analysis</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium text-[11px] flex items-center space-x-1 transition-colors"
                >
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Message'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 font-mono text-xs text-red-700 dark:text-red-300 space-y-2 select-text">
                <div className="font-semibold text-xs text-red-800 dark:text-red-200">
                  {schedule.last_run_message || 'Pipeline execution encountered an unexpected exception.'}
                </div>
                {schedule.last_run_message?.includes('Azure Authentication') || schedule.last_run_message?.includes('Connection string') ? (
                  <div className="pt-2 border-t border-red-200 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 font-sans">
                    <strong>💡 How to resolve:</strong> Click <strong>Edit Schedule</strong> below. Under Step 3 (Export Destination), select your saved Azure Lakehouse connection or enter your Storage Account Key / SAS Token, then save and re-run.
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Execution Log Console */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-indigo-500" />
                <span>PySpark Pipeline Execution Console Logs</span>
              </span>
              {loadingJob && (
                <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Loading trace logs...</span>
                </span>
              )}
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-[11px] text-zinc-300 max-h-60 overflow-y-auto space-y-1 select-text">
              {jobDetails?.logs && jobDetails.logs.length > 0 ? (
                jobDetails.logs.map((logLine, idx) => {
                  const isErr = logLine.includes('ERROR') || logLine.includes('failed') || logLine.includes('Exception');
                  const isSuccess = logLine.includes('SUCCESS') || logLine.includes('Successfully');
                  const isWarn = logLine.includes('WARN') || logLine.includes('NOTICE');
                  return (
                    <div
                      key={idx}
                      className={
                        isErr
                          ? 'text-red-400 font-semibold'
                          : isSuccess
                          ? 'text-emerald-400 font-semibold'
                          : isWarn
                          ? 'text-amber-400'
                          : 'text-zinc-300'
                      }
                    >
                      {logLine}
                    </div>
                  );
                })
              ) : schedule.last_run_message ? (
                <div className="space-y-1">
                  <div className="text-zinc-500">[{new Date(schedule.last_run_at || Date.now()).toISOString()}] Starting scheduled execution for flow '{schedule.flow_name}'...</div>
                  <div className="text-zinc-500">[{new Date(schedule.last_run_at || Date.now()).toISOString()}] Loading dataset '{schedule.staging_dataset_name || schedule.staging_dataset_id}' into Spark engine...</div>
                  <div className="text-red-400 font-semibold">[{new Date(schedule.last_run_at || Date.now()).toISOString()}] [ERROR] {schedule.last_run_message}</div>
                </div>
              ) : (
                <div className="text-zinc-500 italic">No execution logs recorded yet for this trigger.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950">
          <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
            Target: <span className="font-mono text-zinc-700 dark:text-zinc-300">{schedule.destination_config?.destination_type || 'lakehouse'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(schedule);
              }}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Configuration</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerRun}
              disabled={running}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Re-Run Trigger Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export const ScheduledFlowsView = ({ flows = [], allDatasets = [], activeFlowId, onSelectFlow }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'paused'
  const [triggeringId, setTriggeringId] = useState(null);

  // View Mode: 'list', 'create', 'edit'
  const [viewMode, setViewMode] = useState('list');
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Confirmation Modal State
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState(null);
  const [selectedLogsSchedule, setSelectedLogsSchedule] = useState(null);

  // Load Schedules
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DataFlowAPI.listSchedules(activeFlowId);
      setSchedules(data || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch flow schedules.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [activeFlowId]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Actions
  const handleToggleSchedule = async (schedId) => {
    try {
      const res = await DataFlowAPI.toggleSchedule(schedId);
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedId ? { ...s, enabled: res.enabled, next_run_at: res.next_run_at } : s))
      );
      setSuccessMessage(`Schedule status updated to ${res.status}.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to toggle schedule.'));
    }
  };

  const handleRunNow = async (sched) => {
    try {
      setTriggeringId(sched.id);
      await DataFlowAPI.runScheduleNow(sched.id);
      setSuccessMessage(`Manual execution triggered for '${sched.name}'. Execution is running in the background.`);
      setTimeout(() => {
        fetchSchedules();
        setTriggeringId(null);
      }, 1500);
    } catch (err) {
      setTriggeringId(null);
      setError(extractErrorMessage(err, 'Failed to trigger schedule run.'));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmSchedule) return;
    try {
      await DataFlowAPI.deleteSchedule(deleteConfirmSchedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteConfirmSchedule.id));
      setSuccessMessage(`Schedule '${deleteConfirmSchedule.name}' deleted successfully.`);
      setDeleteConfirmSchedule(null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete schedule.'));
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter((s) => s.enabled).length;
    const paused = total - active;
    const totalRuns = schedules.reduce((sum, s) => sum + (s.run_count || 0), 0);
    const successfulRuns = schedules.filter((s) => s.last_run_status === 'completed' || s.last_run_status === 'SUCCESS').length;
    return { total, active, paused, totalRuns, successfulRuns };
  }, [schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.flow_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.cron_expression || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.cron_human || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'active' ? s.enabled : !s.enabled;

      return matchesSearch && matchesStatus;
    });
  }, [schedules, searchTerm, statusFilter]);

  const openCreatePage = () => {
    setEditingSchedule(null);
    setViewMode('create');
  };

  const openEditPage = (sched) => {
    setEditingSchedule(sched);
    setViewMode('edit');
  };

  const openCreateModal = openCreatePage;
  const openEditModal = openEditPage;

  const handleBackToList = () => {
    setEditingSchedule(null);
    setViewMode('list');
  };

  // If in create or edit mode, render dedicated ScheduleConfigPageView
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <ScheduleConfigPageView
        schedule={editingSchedule}
        flows={flows}
        allDatasets={allDatasets}
        onBack={handleBackToList}
        onSaved={() => {
          handleBackToList();
          fetchSchedules();
          setSuccessMessage(editingSchedule ? 'Schedule updated successfully.' : 'New automated schedule created and activated.');
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Flow Cron Schedules & Automated Triggers
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Configure automated recurring triggers for flows with real-time PySpark transformations and auto-loading to Lakehouse, Database, or Cloud Storage.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchSchedules}
              disabled={loading}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs flex items-center space-x-1.5"
              title="Refresh Schedules"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={openCreatePage}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Flow Schedule</span>
            </button>
          </div>
        </div>

        {/* Metric Badges Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Schedules</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{metrics.total}</p>
            </div>
            <div className="p-2 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active Triggers</p>
              <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{metrics.active}</p>
            </div>
            <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Paused</p>
              <p className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">{metrics.paused}</p>
            </div>
            <div className="p-2 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              <Pause className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Total Runs Triggered</p>
              <p className="text-xl font-bold text-indigo-800 dark:text-indigo-300 mt-0.5">{metrics.totalRuns}</p>
            </div>
            <div className="p-2 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start space-x-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start space-x-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search schedules by flow, name, or cron expression..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All ({schedules.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'active' ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Active ({metrics.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paused')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'paused' ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-xs' : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Paused ({metrics.paused})
            </button>
          </div>
        </div>
      </div>

      {/* Schedules Grid */}
      {loading && schedules.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading flow schedules...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <CalendarClock className="w-10 h-10 text-zinc-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Flow Schedules Found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'No schedules match your search filters.'
              : 'Create automated cron triggers to automatically run transformation pipelines and stream data directly to Azure Blob, MySQL, Postgres, or S3.'}
          </p>
          <button
            type="button"
            onClick={openCreatePage}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Schedule</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchedules.map((sched) => {
            const isEnabled = sched.enabled;
            const isTriggering = triggeringId === sched.id;
            const dest = sched.destination_config;
            const destType = dest?.destination_type || 'lakehouse';

            let destLabel = 'Lakehouse Staging Table';
            let destDetail = '';
            if ((destType === 'azure' || destType === 'azure_lakehouse') && dest.azure_dest) {
              destLabel = 'Azure Lakehouse / ADLS';
              destDetail = `abfss://${dest.azure_dest.container_name}/${dest.azure_dest.path}`;
            } else if (destType === 'database' && dest.database_dest) {
              destLabel = `${dest.database_dest.db_type.toUpperCase()} Table`;
              destDetail = `${dest.database_dest.database}.${dest.database_dest.table_name}`;
            } else if (destType === 's3' && dest.s3_dest) {
              destLabel = 'AWS S3 Bucket';
              destDetail = `s3://${dest.s3_dest.bucket_name}/${dest.s3_dest.key_path}`;
            }

            return (
              <div
                key={sched.id}
                className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 flex flex-col justify-between transition-all shadow-xs ${
                  isEnabled
                    ? 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                    : 'border-zinc-200/60 dark:border-zinc-800/60 opacity-75'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                          {sched.flow_name || 'Flow'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center space-x-1 ${
                            isEnabled
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                          <span>{isEnabled ? 'ACTIVE' : 'PAUSED'}</span>
                        </span>
                      </div>

                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-1.5 truncate" title={sched.name}>
                        {sched.name}
                      </h3>
                      {sched.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                          {sched.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSchedule(sched.id)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isEnabled
                          ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                      title={isEnabled ? 'Pause automated trigger' : 'Activate automated trigger'}
                    >
                      {isEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Cron & Frequency Info */}
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2 mb-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">{sched.cron_human || sched.cron_expression}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                        {sched.cron_expression}
                      </span>
                    </div>

                    {/* Next Run Info */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/50 dark:border-zinc-800/60 pt-2">
                      <span className="flex items-center space-x-1">
                        <Clock3 className="w-3 h-3 text-zinc-400" />
                        <span>Next Run:</span>
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {sched.next_run_at ? new Date(sched.next_run_at).toLocaleString() : isEnabled ? 'Pending next cycle' : 'Paused'}
                      </span>
                    </div>
                  </div>

                  {/* Destination Info */}
                  <div className="text-xs space-y-1.5 mb-3">
                    <div className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400">
                      <Cloud className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{destLabel}</span>
                    </div>
                    {destDetail && (
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate bg-zinc-50 dark:bg-zinc-950 px-2 py-1 rounded border border-zinc-200/60 dark:border-zinc-800/60" title={destDetail}>
                        {destDetail}
                      </p>
                    )}
                  </div>

                  {/* Failure Alert Banner */}
                  {(sched.last_run_status === 'failed' || sched.last_run_status === 'FAILED') && (
                    <div
                      onClick={() => setSelectedLogsSchedule(sched)}
                      className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors flex items-start space-x-2 group mb-3 shadow-xs"
                      title="Click to view execution logs & failure diagnostics"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-red-800 dark:text-red-200">Execution Failed</span>
                          <span className="text-[10px] underline font-medium text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-200">View Logs &rarr;</span>
                        </div>
                        <p className="text-[10px] font-mono text-red-600/90 dark:text-red-400/90 truncate mt-0.5" title={sched.last_run_message}>
                          {sched.last_run_message || 'Pipeline failed during execution.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Succeeded Notice */}
                  {(sched.last_run_status === 'completed' || sched.last_run_status === 'SUCCESS') && (
                    <div
                      onClick={() => setSelectedLogsSchedule(sched)}
                      className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 transition-colors flex items-center justify-between mb-3 text-[11px]"
                      title="Click to view execution history & logs"
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-emerald-800 dark:text-emerald-200 truncate">Last Run Succeeded</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 underline shrink-0 ml-1">Logs &rarr;</span>
                    </div>
                  )}
                </div>

                {/* Card Footer & Action Buttons */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
                    <span>Runs:</span>
                    <strong className="text-zinc-700 dark:text-zinc-200">{sched.run_count || 0}</strong>
                    {sched.last_run_status && (
                      <button
                        type="button"
                        onClick={() => setSelectedLogsSchedule(sched)}
                        className={`ml-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-transform hover:scale-105 ${
                          sched.last_run_status === 'completed' || sched.last_run_status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200'
                        }`}
                        title="Click to view execution logs"
                      >
                        {sched.last_run_status}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* View Logs Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedLogsSchedule(sched)}
                      className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
                      title="View Execution History & Logs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunNow(sched)}
                      disabled={isTriggering}
                      className="p-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 transition-colors"
                      title="Run Immediately"
                    >
                      <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditPage(sched)}
                      className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
                      title="Edit Schedule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmSchedule(sched)}
                      className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition-colors"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Execution History & Logs Modal */}
      <ScheduleLogsModal
        schedule={selectedLogsSchedule}
        isOpen={!!selectedLogsSchedule}
        onClose={() => setSelectedLogsSchedule(null)}
        onRunNow={handleRunNow}
        onEdit={openEditPage}
      />

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={!!deleteConfirmSchedule}
        title="Delete Flow Schedule"
        message={`Are you sure you want to permanently delete the automated schedule '${deleteConfirmSchedule?.name}'? The automated background trigger will be stopped immediately.`}
        confirmText="Delete Schedule"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmSchedule(null)}
      />
    </div>
  );
};

// ==========================================
// Dedicated Full-Page Configuration Component
// ==========================================
export const ScheduleConfigPageView = ({ schedule, flows = [], allDatasets = [], onBack, onSaved }) => {
  const [name, setName] = useState(schedule?.name || '');
  const [description, setDescription] = useState(schedule?.description || '');
  const [flowId, setFlowId] = useState(schedule?.flow_id || (flows[0]?.id || ''));
  const [stagingDatasetId, setStagingDatasetId] = useState(schedule?.staging_dataset_id || '');
  const [cronExpression, setCronExpression] = useState(schedule?.cron_expression || '*/15 * * * *');
  const [cronMode, setCronMode] = useState('preset');
  const [enabled, setEnabled] = useState(schedule?.enabled !== undefined ? schedule.enabled : true);

  const [savedConnections, setSavedConnections] = useState([]);
  const [selectedSavedConnId, setSelectedSavedConnId] = useState('');
  const [loadingSavedConns, setLoadingSavedConns] = useState(false);

  const [destType, setDestType] = useState(schedule?.destination_config?.destination_type || 'azure_lakehouse');
  const [azureAccount, setAzureAccount] = useState(schedule?.destination_config?.azure_dest?.account_name || 'adfstorage07');
  const [azureContainer, setAzureContainer] = useState(schedule?.destination_config?.azure_dest?.container_name || 'adf-container');
  const [azurePath, setAzurePath] = useState(schedule?.destination_config?.azure_dest?.path || 'csv_files/scheduled_output.csv');
  const [azureFormat, setAzureFormat] = useState(schedule?.destination_config?.azure_dest?.file_format || 'csv');
  const [azureConnString, setAzureConnString] = useState(schedule?.destination_config?.azure_dest?.connection_string || '');

  const [dbType, setDbType] = useState(schedule?.destination_config?.database_dest?.db_type || 'mysql');
  const [dbHost, setDbHost] = useState(schedule?.destination_config?.database_dest?.host || 'localhost');
  const [dbPort, setDbPort] = useState(schedule?.destination_config?.database_dest?.port || 3306);
  const [dbName, setDbName] = useState(schedule?.destination_config?.database_dest?.database || 'pipeline_db');
  const [dbTable, setDbTable] = useState(schedule?.destination_config?.database_dest?.table_name || 'curated_output');
  const [dbUser, setDbUser] = useState(schedule?.destination_config?.database_dest?.username || 'root');
  const [dbPassword, setDbPassword] = useState(schedule?.destination_config?.database_dest?.password || '');
  const [dbWriteMode, setDbWriteMode] = useState(schedule?.destination_config?.database_dest?.write_mode || 'append');

  const [s3Bucket, setS3Bucket] = useState(schedule?.destination_config?.s3_dest?.bucket_name || '');
  const [s3Key, setS3Key] = useState(schedule?.destination_config?.s3_dest?.key_path || 'exports/scheduled_data.parquet');
  const [s3Format, setS3Format] = useState(schedule?.destination_config?.s3_dest?.file_format || 'parquet');
  const [s3Region, setS3Region] = useState(schedule?.destination_config?.s3_dest?.region || 'us-east-1');
  const [s3AccessKey, setS3AccessKey] = useState(schedule?.destination_config?.s3_dest?.access_key || '');
  const [s3SecretKey, setS3SecretKey] = useState(schedule?.destination_config?.s3_dest?.secret_key || '');

  // Credential Visibility Toggles
  const [showAzureConnString, setShowAzureConnString] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showS3SecretKey, setShowS3SecretKey] = useState(false);

  // Load Saved Connections
  useEffect(() => {
    let active = true;
    const fetchSavedConnections = async () => {
      try {
        setLoadingSavedConns(true);
        const data = await DataFlowAPI.getSavedConnections();
        if (active) {
          setSavedConnections(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load saved connections in ScheduleConfigPageView:', err);
      } finally {
        if (active) setLoadingSavedConns(false);
      }
    };
    fetchSavedConnections();
    return () => {
      active = false;
    };
  }, []);

  // Apply Saved Connection Details
  const handleApplySavedConnection = (connId) => {
    setSelectedSavedConnId(connId);
    if (!connId) return;
    const conn = savedConnections.find((c) => c.id === connId);
    if (!conn) return;

    const cfg = conn.config || {};
    const st = (conn.source_type || '').toLowerCase();

    if (['mysql', 'postgres', 'postgresql', 'sqlserver'].includes(st)) {
      setDestType('database');
      setDbType(st === 'postgresql' ? 'postgres' : st);
      setDbHost(cfg.host || cfg.dbHost || 'localhost');
      setDbPort(cfg.port || cfg.dbPort || (st === 'mysql' ? 3306 : st === 'sqlserver' ? 1433 : 5432));
      setDbName(cfg.dbName || cfg.database || cfg.databaseName || 'pipeline_db');
      setDbUser(cfg.username || cfg.user || cfg.dbUser || 'root');
      setDbPassword(cfg.password || cfg.pass || cfg.dbPassword || '');
      if (cfg.table_name || cfg.table || cfg.selectedTable || cfg.dbTable) {
        setDbTable(cfg.table_name || cfg.table || cfg.selectedTable || cfg.dbTable);
      }
    } else if (st === 'azure') {
      setDestType('azure_lakehouse');
      setAzureAccount(cfg.azureAccount || cfg.account_name || cfg.accountName || 'adfstorage07');
      setAzureContainer(cfg.azureContainer || cfg.container_name || cfg.containerName || 'adf-container');
      if (cfg.azurePath || cfg.path || cfg.blob_path) {
        setAzurePath(cfg.azurePath || cfg.path || cfg.blob_path);
      }
      const azKey = cfg.azureKey || cfg.connection_string || cfg.azureConnString || cfg.account_key || cfg.accountKey || cfg.sas_token || cfg.sasToken || cfg.key || '';
      setAzureConnString(azKey);
      if (cfg.azureFormat || cfg.file_format || cfg.format) {
        setAzureFormat(cfg.azureFormat || cfg.file_format || cfg.format);
      }
    } else if (st === 's3') {
      setDestType('s3');
      setS3Bucket(cfg.s3Bucket || cfg.bucket_name || cfg.bucket || '');
      if (cfg.s3Key || cfg.key_path || cfg.key) {
        setS3Key(cfg.s3Key || cfg.key_path || cfg.key);
      }
      setS3Region(cfg.s3Region || cfg.region || 'us-east-1');
      setS3AccessKey(cfg.s3AccessKey || cfg.access_key || cfg.accessKey || '');
      setS3SecretKey(cfg.s3SecretKey || cfg.secret_key || cfg.secretKey || '');
      if (cfg.s3Format || cfg.file_format || cfg.format) {
        setS3Format(cfg.s3Format || cfg.file_format || cfg.format);
      }
    }
  };

  const [cronPreview, setCronPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState(null);

  const [isIntervalDropdownOpen, setIsIntervalDropdownOpen] = useState(false);
  const [intervalSearchTerm, setIntervalSearchTerm] = useState('');

  const currentPreset = useMemo(() => {
    return CRON_PRESETS.find((p) => p.cron === cronExpression) || {
      cron: cronExpression,
      label: cronExpression || 'Select Frequency Interval',
      subtitle: 'Custom scheduled trigger',
      badge: 'Custom'
    };
  }, [cronExpression]);

  const activeFlowObj = useMemo(() => flows.find((f) => f.id === flowId), [flows, flowId]);

  const availableDatasets = useMemo(() => {
    if (!flowId) return allDatasets;
    return allDatasets.filter((ds) => ds.flow_id === flowId || !ds.flow_id);
  }, [allDatasets, flowId]);

  const activeDatasetObj = useMemo(() => availableDatasets.find((d) => d.id === stagingDatasetId), [availableDatasets, stagingDatasetId]);

  useEffect(() => {
    if (!stagingDatasetId && availableDatasets.length > 0) {
      setStagingDatasetId(availableDatasets[0].id);
    }
  }, [availableDatasets, stagingDatasetId]);

  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      if (!cronExpression.trim()) return;
      try {
        setPreviewLoading(true);
        const data = await DataFlowAPI.previewCron(cronExpression);
        if (active) setCronPreview(data);
      } catch {
        if (active) setCronPreview(null);
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    fetchPreview();
    return () => {
      active = false;
    };
  }, [cronExpression]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setPageError('Schedule name is required.');
      return;
    }
    if (!flowId) {
      setPageError('Please select a flow.');
      return;
    }
    if (!stagingDatasetId) {
      setPageError('Please select a source staged dataset.');
      return;
    }
    if (!cronExpression.trim()) {
      setPageError('Cron expression is required.');
      return;
    }

    try {
      setSaving(true);
      setPageError(null);

      let destinationConfig = null;
      if (destType === 'azure_lakehouse' || destType === 'azure') {
        destinationConfig = {
          destination_type: 'azure_lakehouse',
          azure_dest: {
            account_name: azureAccount || 'adfstorage07',
            container_name: azureContainer || 'adf-container',
            path: azurePath || 'csv_files/scheduled_output.csv',
            file_format: azureFormat || 'csv',
            connection_string: azureConnString || undefined
          }
        };
      } else if (destType === 'database') {
        destinationConfig = {
          destination_type: 'database',
          database_dest: {
            db_type: dbType,
            host: dbHost || 'localhost',
            port: Number(dbPort) || 3306,
            database: dbName || 'pipeline_db',
            table_name: dbTable || 'curated_output',
            username: dbUser || 'root',
            password: dbPassword || undefined,
            write_mode: dbWriteMode || 'append'
          }
        };
      } else if (destType === 's3') {
        destinationConfig = {
          destination_type: 's3',
          s3_dest: {
            bucket: s3Bucket,
            bucket_name: s3Bucket,
            key_prefix: s3Key,
            key_path: s3Key,
            file_format: s3Format,
            region: s3Region,
            access_key: s3AccessKey || undefined,
            secret_key: s3SecretKey || undefined
          }
        };
      } else {
        destinationConfig = {
          destination_type: 'lakehouse'
        };
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        flow_id: flowId,
        staging_dataset_id: stagingDatasetId,
        cron_expression: cronExpression.trim(),
        enabled,
        destination_config: destinationConfig
      };

      if (schedule) {
        await DataFlowAPI.updateSchedule(schedule.id, payload);
      } else {
        await DataFlowAPI.createSchedule(payload);
      }

      onSaved();
    } catch (err) {
      setPageError(extractErrorMessage(err, 'Failed to save automated schedule.'));
    } finally {
      setSaving(false);
    }
  };

  const filteredPresets = useMemo(() => {
    if (!intervalSearchTerm.trim()) return CRON_PRESETS;
    const term = intervalSearchTerm.toLowerCase();
    return CRON_PRESETS.filter(
      (p) =>
        p.label.toLowerCase().includes(term) ||
        p.subtitle.toLowerCase().includes(term) ||
        p.cron.toLowerCase().includes(term)
    );
  }, [intervalSearchTerm]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Return to Automated Flow Triggers list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span className="hover:underline cursor-pointer" onClick={onBack}>Automated Flow Triggers</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{schedule ? 'Edit Schedule' : 'New Schedule'}</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
              {schedule ? `Edit Trigger: ${schedule.name}` : 'Create Automated Flow Trigger'}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{schedule ? 'Update Schedule' : 'Create & Activate Schedule'}</span>
            )}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center space-x-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: 4 Step Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Schedule Trigger Name & Target Flow */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                1. Schedule & Source Flow Configuration
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Schedule Trigger Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Payment Curated Export"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Target Flow <span className="text-red-500">*</span>
                </label>
                <select
                  value={flowId}
                  onChange={(e) => setFlowId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {flows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Source Staged Dataset <span className="text-red-500">*</span>
              </label>
              <select
                value={stagingDatasetId}
                onChange={(e) => setStagingDatasetId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                {availableDatasets.length === 0 ? (
                  <option value="">No staged datasets available in this flow</option>
                ) : (
                  availableDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count || 0} rows, {d.file_format || 'csv'})
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                The recurring schedule will process transformations against this dataset and produce updated outputs.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Description <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <textarea
                placeholder="Details on what downstream consumer uses this data and export SLA..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Card 2: Execution Interval (Cron Schedule) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  2. Execution Interval (Cron Schedule)
                </h2>
              </div>

              <div className="flex items-center space-x-1 bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setCronMode('preset')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    cronMode === 'preset' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setCronMode('custom')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    cronMode === 'custom' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Custom Expression
                </button>
              </div>
            </div>

            {cronMode === 'preset' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsIntervalDropdownOpen(!isIntervalDropdownOpen)}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs flex items-center justify-between hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors shadow-xs group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-900/50">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="text-left truncate">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate text-xs">
                        {currentPreset.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-sans">
                        {currentPreset.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {cronExpression}
                    </span>
                    {isIntervalDropdownOpen ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {isIntervalDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsIntervalDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                      <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search interval frequencies (e.g. 5 min, hourly, daily, midnight)..."
                            value={intervalSearchTerm}
                            onChange={(e) => setIntervalSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-1">
                        {filteredPresets.length === 0 ? (
                          <div className="p-4 text-center text-xs text-zinc-500">
                            No matching intervals found.
                          </div>
                        ) : (
                          filteredPresets.map((preset) => {
                            const isSelected = cronExpression === preset.cron;
                            return (
                              <button
                                key={preset.cron}
                                type="button"
                                onClick={() => {
                                  setCronExpression(preset.cron);
                                  setIsIntervalDropdownOpen(false);
                                  setIntervalSearchTerm('');
                                }}
                                className={`w-full p-2.5 rounded-lg flex items-center justify-between text-left transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                                      {preset.label}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                      {preset.badge}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                    {preset.subtitle}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                  <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded">
                                    {preset.cron}
                                  </span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="*/15 * * * *"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  Format: minute hour day-of-month month day-of-week (UTC)
                </p>
              </div>
            )}

            {/* Next Execution Cycle Timeline Preview */}
            <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center space-x-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upcoming Execution Schedule</span>
                </span>
                {previewLoading && (
                  <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Calculating triggers...</span>
                  </span>
                )}
              </div>

              {cronPreview && (
                <div className="space-y-1.5 text-xs">
                  {cronPreview.next_run && (
                    <div className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                      <Zap className="w-3 h-3" />
                      <span>Next trigger: {new Date(cronPreview.next_run).toUTCString()}</span>
                    </div>
                  )}

                  {cronPreview.future_runs && cronPreview.future_runs.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1">
                        Subsequent 3 Triggers (UTC)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        {cronPreview.future_runs.slice(1, 4).map((runTime, idx) => (
                          <div key={idx} className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded">
                            {new Date(runTime).toISOString().replace('T', ' ').substring(0, 19)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Destination Configuration & Saved Connections */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <FolderDown className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  3. Export Destination Configuration
                </h2>
              </div>

              <div className="flex items-center space-x-1 bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setDestType('azure_lakehouse')}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    destType === 'azure_lakehouse' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Azure Lakehouse
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('database')}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    destType === 'database' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Database
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('s3')}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    destType === 's3' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  AWS S3
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('lakehouse')}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    destType === 'lakehouse' ? 'bg-white dark:bg-zinc-900 font-semibold shadow-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Lakehouse Staging
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Saved Connections ({savedConnections.length})</span>
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Click a card to auto-fill destination parameters
                </span>
              </div>

              {loadingSavedConns ? (
                <div className="p-3 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  Loading saved connections...
                </div>
              ) : savedConnections.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  No saved connections found. Fill out the destination form below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedConnections.map((conn) => {
                    const isSelected = selectedSavedConnId === conn.id;
                    const st = (conn.source_type || 'database').toLowerCase();
                    const isAzure = st === 'azure';
                    const isS3 = st === 's3';

                    return (
                      <div
                        key={conn.id}
                        onClick={() => handleApplySavedConnection(conn.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                              isAzure
                                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-500'
                                : isS3
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-500'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500'
                            }`}>
                              {isAzure ? <Cloud className="w-3.5 h-3.5" /> : isS3 ? <FolderTree className="w-3.5 h-3.5" /> : <Server className="w-3.5 h-3.5" />}
                            </div>
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {conn.name}
                            </span>
                          </div>

                          {isSelected ? (
                            <span className="flex items-center space-x-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full shrink-0">
                              <Check className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0">
                              Load →
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate" title={conn.summary}>
                          {conn.summary || (isAzure ? 'Azure Lakehouse storage' : isS3 ? 'AWS S3 bucket' : 'Database server')}
                        </p>

                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/80">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase font-mono font-semibold text-[9px]">
                            {conn.source_type}
                          </span>
                          <span className="text-zinc-400 text-[10px]">
                            {isSelected ? 'Applied to form' : 'Click to select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Azure Destination Config */}
            {(destType === 'azure_lakehouse' || destType === 'azure') && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Account Name</label>
                    <input
                      type="text"
                      value={azureAccount}
                      onChange={(e) => setAzureAccount(e.target.value)}
                      placeholder="e.g. adfstorage07"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Container Name</label>
                    <input
                      type="text"
                      value={azureContainer}
                      onChange={(e) => setAzureContainer(e.target.value)}
                      placeholder="e.g. adf-container"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Target File / Blob Path</label>
                    <input
                      type="text"
                      value={azurePath}
                      onChange={(e) => setAzurePath(e.target.value)}
                      placeholder="e.g. exports/sales_curated.csv"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Export Format</label>
                    <select
                      value={azureFormat}
                      onChange={(e) => setAzureFormat(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs uppercase"
                    >
                      <option value="csv">CSV</option>
                      <option value="parquet">Parquet</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Connection String / SAS Token <span className="text-zinc-400 font-normal">(Optional if saved)</span>
                    </label>
                    {azureConnString && (
                      <button
                        type="button"
                        onClick={() => setShowAzureConnString(!showAzureConnString)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center space-x-1"
                      >
                        {showAzureConnString ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showAzureConnString ? 'Hide' : 'Show Key'}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showAzureConnString ? 'text' : 'password'}
                      value={azureConnString}
                      onChange={(e) => setAzureConnString(e.target.value)}
                      placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;"
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAzureConnString(!showAzureConnString)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                      title={showAzureConnString ? 'Hide credentials' : 'Show credentials'}
                    >
                      {showAzureConnString ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Database Destination Config */}
            {destType === 'database' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Database Engine</label>
                    <select
                      value={dbType}
                      onChange={(e) => setDbType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      <option value="mysql">MySQL</option>
                      <option value="postgres">PostgreSQL</option>
                      <option value="sqlserver">SQL Server</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Host</label>
                    <input
                      type="text"
                      value={dbHost}
                      onChange={(e) => setDbHost(e.target.value)}
                      placeholder="localhost"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Port</label>
                    <input
                      type="number"
                      value={dbPort}
                      onChange={(e) => setDbPort(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Database Name</label>
                    <input
                      type="text"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Target Table</label>
                    <input
                      type="text"
                      value={dbTable}
                      onChange={(e) => setDbTable(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Username</label>
                    <input
                      type="text"
                      value={dbUser}
                      onChange={(e) => setDbUser(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Password</label>
                      {dbPassword && (
                        <button
                          type="button"
                          onClick={() => setShowDbPassword(!showDbPassword)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center space-x-1"
                        >
                          {showDbPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showDbPassword ? 'text' : 'password'}
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDbPassword(!showDbPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                      >
                        {showDbPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Write Mode</label>
                    <select
                      value={dbWriteMode}
                      onChange={(e) => setDbWriteMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      <option value="append">Append (Extend Rows)</option>
                      <option value="replace">Replace (Overwrite Table)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* S3 Destination Config */}
            {destType === 's3' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">S3 Bucket Name</label>
                    <input
                      type="text"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                      placeholder="e.g. my-lakehouse-bucket"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">AWS Region</label>
                    <input
                      type="text"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="e.g. us-east-1"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Key Path</label>
                    <input
                      type="text"
                      value={s3Key}
                      onChange={(e) => setS3Key(e.target.value)}
                      placeholder="e.g. exports/curated_data.parquet"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">File Format</label>
                    <select
                      value={s3Format}
                      onChange={(e) => setS3Format(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs uppercase"
                    >
                      <option value="parquet">Parquet</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Access Key ID</label>
                    <input
                      type="text"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Secret Access Key</label>
                      {s3SecretKey && (
                        <button
                          type="button"
                          onClick={() => setShowS3SecretKey(!showS3SecretKey)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center space-x-1"
                        >
                          {showS3SecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showS3SecretKey ? 'text' : 'password'}
                        value={s3SecretKey}
                        onChange={(e) => setS3SecretKey(e.target.value)}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        className="w-full pl-3 pr-8 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowS3SecretKey(!showS3SecretKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                      >
                        {showS3SecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lakehouse Destination Note */}
            {destType === 'lakehouse' && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                The curated output will be staged directly into your workspace Lakehouse storage with full metadata tracking.
              </p>
            )}
          </div>

          {/* Card 4: Initial Status Toggle */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Activate Schedule Immediately
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Trigger will start running automatically in the background on the next schedule cycle.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Right 1 Column: Live Summary & Actions */}
        <div className="space-y-6">
          {/* Summary Checklist Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <CalendarClock className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Schedule Summary
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Target Flow</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{activeFlowObj?.name || 'No Flow Selected'}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Source Dataset</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100 truncate block">
                  {activeDatasetObj ? `${activeDatasetObj.name} (${activeDatasetObj.row_count || 0} rows)` : 'None'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Cron Expression</span>
                <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40 inline-block mt-0.5">
                  {cronExpression}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Export Destination</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                  {destType === 'azure_lakehouse' ? `Azure (${azureContainer})` : destType === 'database' ? `${dbType.toUpperCase()} (${dbTable})` : destType === 's3' ? `AWS S3 (${s3Bucket || 'bucket'})` : 'Workspace Lakehouse'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Initial Status</span>
                <span className={`inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                  enabled
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                  <span>{enabled ? 'ACTIVE' : 'PAUSED'}</span>
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{schedule ? 'Update Schedule' : 'Create & Activate Schedule'}</span>
                )}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs font-medium"
              >
                Cancel & Return
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-semibold">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Background Automation Daemon</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              When activated, this schedule runs unattended on your configured UTC timeline. Each cycle executes transformation DAG rules in PySpark and directly writes the curated output to the configured destination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

