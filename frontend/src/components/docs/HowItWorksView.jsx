import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Database,
  FileClock, GitBranch, Layers, Play, Search, Settings, SlidersHorizontal,
  Sparkles, Timer, Workflow
} from 'lucide-react';

const sections = [
  {
    id: 'overview', title: 'Getting started', icon: Workflow,
    summary: 'A quick guide to the complete data pipeline workflow.',
    steps: [
      'Create a flow in Flows Tracker to represent the pipeline you want to manage.',
      'Connect a source and inspect a sample of its data.',
      'Review the schema, then stage the data so it is available to the other workspace tabs.',
      'Add and preview transformation rules, then run the pipeline and configure a destination.',
      'Use History & Logs to review previous ingestion and pipeline activity.'
    ]
  },
  {
    id: 'flows', title: 'Flows Tracker', icon: GitBranch,
    summary: 'Create and manage logical pipelines, see progress, and choose how source changes are handled.',
    steps: [
      'Select Create Flow and enter a clear name, category, description, and sync strategy.',
      'A flow groups its source configuration, schema/staging data, transformation rules, and pipeline history.',
      'Use Detect Changes for full-snapshot comparison, Full Refresh to reload the whole source on sync, or an incremental mode when the source has an appropriate watermark.',
      'Open a flow card to review its stages. Use the shortcuts to open its source, transformation rules, or pipeline runner.'
    ],
    note: 'Snapshot detection requires a connected source. A stable, unique primary key enables reliable new/changed/deleted classification. Without one, the application can only compare complete rows.'
  },
  {
    id: 'sources', title: 'Data Sources', icon: Database,
    summary: 'Connect to a database, file, cloud storage location, or supported API source.',
    steps: [
      'Select the flow that should own the source connection.',
      'Choose the source type and provide the endpoint, credentials, database/table or query, and any required cloud settings.',
      'Use the connection/test or inspect action to validate access and preview sample rows.',
      'When inspection succeeds, the source configuration is attached to the active flow and can be used for staging or change detection.'
    ],
    note: 'Use a read-only source account where possible. Do not paste production secrets into screenshots or documentation. Source connector options depend on the source type.'
  },
  {
    id: 'schema', title: 'Schema Casting', icon: Sparkles,
    summary: 'Review inferred columns and control the data types used when data is staged.',
    steps: [
      'Select the staged/source dataset and inspect its column names, inferred types, null counts, and samples.',
      'Add a cast rule for a column and choose a target type when automatic inference is not suitable.',
      'For dates and timestamps, provide an input format only when source values need an explicit format.',
      'Stage or re-stage the data and review the resulting schema and preview.'
    ],
    note: 'Invalid non-null values should be checked in the preview/log output. A cast does not repair malformed source values automatically.'
  },
  {
    id: 'staging', title: 'Staging Area', icon: Layers,
    summary: 'Inspect datasets that have been ingested and stored for pipeline work.',
    steps: [
      'Choose a flow or dataset to browse its staged rows and column metadata.',
      'Use paging and search to inspect records without opening the entire dataset in the browser.',
      'Confirm row counts and required columns before defining transformations.',
      'Return to Data Sources to ingest/re-stage data if the preview is empty or stale.'
    ],
    note: 'Staging is an intermediate layer. Staging data alone does not mean transformation rules ran or that a destination was updated.'
  },
  {
    id: 'transform', title: 'Transform Studio', icon: SlidersHorizontal,
    summary: 'Build an ordered list of rules to clean, reshape, and derive data.',
    steps: [
      'Select the flow and staged dataset whose data the rules should process.',
      'Add rules such as filter, select/drop columns, rename, cast, fill/remove null rows, remove duplicates, joins, derived columns, aggregations, or SQL.',
      'Configure each rule and keep the order intentional: rules execute in sequence.',
      'Preview the rules and check the resulting rows and step status before running the final pipeline.',
      'Save the rules to the flow so future runs use the same transformation configuration.'
    ],
    note: 'A failed transformation should be corrected before loading. Be cautious with filters, row removal, joins, and replace/overwrite operations because they can intentionally remove or reshape data.'
  },
  {
    id: 'runner', title: 'Pipeline Runner', icon: Play,
    summary: 'Execute transformations and optionally write the output to a configured destination.',
    steps: [
      'Select the flow and input staged dataset, then confirm the saved rules and output name.',
      'Choose whether to stage the transformed result and select the destination type, if an external destination is needed.',
      'Check credentials, target database/table/path, and write mode (append or replace/overwrite) carefully.',
      'Start the run and monitor its status, input/output row counts, logs, and errors.',
      'Verify the destination independently after a successful run, especially when using append or overwrite.'
    ],
    note: 'The Sync Now action on a flow is not the same as running the pipeline: source sync refreshes staging; Pipeline Runner applies rules and writes output.'
  },
  {
    id: 'history', title: 'History & Logs', icon: FileClock,
    summary: 'Review prior ingestion, transformation, pipeline, and audit activity.',
    steps: [
      'Open History & Logs from the utility area at the bottom of the sidebar.',
      'Review run status, timestamps, row counts, and available messages to troubleshoot a workflow.',
      'Use the history to identify which stage completed and where a failure occurred before retrying.'
    ],
    note: 'History is diagnostic metadata, not a live view of the destination. Check the destination system to confirm the actual output.'
  },
  {
    id: 'scheduler', title: 'Cron Scheduler', icon: Timer,
    summary: 'Create recurring triggers for a flow and choose an output destination.',
    steps: [
      'Select New Schedule, give the trigger a name, and choose its flow and staged dataset.',
      'Choose a preset interval or enter a standard five-field cron expression (minute hour day-of-month month day-of-week).',
      'Select the destination and enter the required connection and target details. Verify write mode and credentials.',
      'Create/activate the schedule and check its next run, last run status, and run history.',
      'Use Run Now to test the trigger path and inspect the reported result before relying on the schedule.'
    ],
    note: 'The scheduler operates on the selected staged dataset and saved flow rules. Keep the source/staged data current for the intended schedule and validate the destination behavior.'
  },
  {
    id: 'settings', title: 'Settings', icon: Settings,
    summary: 'Configure application preferences and metadata database settings.',
    steps: [
      'Open Settings from the bottom utility area of the sidebar.',
      'Review available metadata storage, timezone, theme, and display preferences.',
      'Restart the backend if a setting requires environment/configuration changes to take effect.'
    ],
    note: 'Store credentials in environment variables or a secrets manager for deployments. Avoid committing real secrets into source control.'
  },
];

const FaqItem = ({ question, children }) => (
  <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
      {question}<ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
  </details>
);

export const HowItWorksView = () => {
  const [query, setQuery] = useState('');
  const filteredSections = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter((section) => [section.title, section.summary, ...section.steps, section.note]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [query]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-900 p-6 text-white shadow-lg sm:p-9">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium"><BookOpen className="h-3.5 w-3.5" /> Client guide</div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">DataFlow Studio Documentation</h2>
          <p className="mt-3 text-sm leading-relaxed text-blue-100 sm:text-base">A practical guide to every workspace tab: connect sources, stage and transform data, run pipelines, schedule jobs, and troubleshoot results.</p>
          <div className="mt-6 flex max-w-xl items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-blue-100" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-blue-100/70" aria-label="Search documentation" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredSections.map(({ id, title, summary, icon: Icon, steps, note }) => (
          <article key={id} id={`docs-${id}`} className="scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><Icon className="h-4 w-4" /></span>
              <div><h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{title}</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{summary}</p></div>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {steps.map((step, index) => <li key={index} className="pl-1">{step}</li>)}
            </ol>
            {note && <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{note}</div>}
          </article>
        ))}
      </section>
      {filteredSections.length === 0 && <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">No documentation sections match “{query}”.</div>}

      <section className="space-y-3">
        <div><h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Common questions</h3><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Quick answers to common pipeline workflow questions.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          <FaqItem question="Does Sync Now run transformations or write to the final destination?">No. Sync Now refreshes the flow's staged source data using its configured sync mode. Use Pipeline Runner to run the rules and load the output.</FaqItem>
          <FaqItem question="How does snapshot change detection identify an update?">With a unique, non-null primary key, it compares each key's row values against the last successful snapshot. Without a key, it can report whole-row additions/removals but cannot reliably identify updates.</FaqItem>
          <FaqItem question="Will a scheduled job automatically get fresh source data?">A schedule executes against its selected staged dataset and configured rules. Confirm the source ingestion/refresh setup and review last-run details to ensure staging contains the intended data.</FaqItem>
          <FaqItem question="What should I check when a run fails?">Check the run status and error in History & Logs, confirm source/destination connectivity, validate column names and types, and check the destination write mode before retrying.</FaqItem>
        </div>
      </section>

      <section className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div><h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Recommended workflow</h3><p className="mt-1 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">Create a flow <ArrowRight className="inline h-3.5 w-3.5" /> connect and inspect a source <ArrowRight className="inline h-3.5 w-3.5" /> review schema and staging <ArrowRight className="inline h-3.5 w-3.5" /> configure and preview rules <ArrowRight className="inline h-3.5 w-3.5" /> run and verify destination <ArrowRight className="inline h-3.5 w-3.5" /> schedule and monitor.</p></div>
      </section>
    </div>
  );
};
