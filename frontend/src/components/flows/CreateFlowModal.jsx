import React, { useState } from 'react';
import { Plus, X, GitBranch, RefreshCw, Layers, ShieldCheck, Zap } from 'lucide-react';
import { DataFlowAPI, extractErrorMessage } from '../../services/api';

export const CreateFlowModal = ({ isOpen, onClose, onFlowCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Retail');
  const [syncMode, setSyncMode] = useState('incremental_merge');
  const [watermarkColumn, setWatermarkColumn] = useState('aud_last_update');
  const [primaryKey, setPrimaryKey] = useState('id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const newFlow = await DataFlowAPI.createFlow({
        name: name.trim(),
        description: description.trim(),
        category: category,
        sync_mode: syncMode,
        watermark_column: watermarkColumn.trim() || 'aud_last_update',
        primary_key: syncMode === 'incremental_merge' ? (primaryKey.trim() || null) : null,
      });
      onFlowCreated(newFlow);
      setName('');
      setDescription('');
      setSyncMode('incremental_merge');
      setWatermarkColumn('aud_last_update');
      setPrimaryKey('id');
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create flow'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-lg w-full p-5 shadow-xl space-y-4 transition-colors max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create New Data Flow</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Flow Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <option value="Retail">Retail & E-Commerce</option>
                <option value="Finance">Banking & Finance</option>
                <option value="CRM">CRM & Customer 360</option>
                <option value="IoT">IoT & Manufacturing</option>
                <option value="Healthcare">Healthcare & Life Sciences</option>
                <option value="General">General Data Engineering</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Watermark Column
              </label>
              <input
                type="text"
                value={watermarkColumn}
                onChange={(e) => setWatermarkColumn(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          {/* Sync Strategy Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Ingestion & Sync Strategy
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSyncMode('full')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  syncMode === 'full'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold">Full Refresh</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Overwrites entire staged dataset on every sync.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSyncMode('incremental_append')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  syncMode === 'incremental_append'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">Incr. Append</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Appends newly modified rows after high watermark.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSyncMode('incremental_merge')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  syncMode === 'incremental_merge'
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold">Incr. Merge</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Upserts records by primary key with audit stamp.
                </p>
              </button>
            </div>
          </div>

          {syncMode === 'incremental_merge' && (
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-lg space-y-2">
              <div className="flex items-center space-x-1.5 text-purple-700 dark:text-purple-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Primary Key / Merge Identifier</span>
              </div>
              <input
                type="text"
                required
                value={primaryKey}
                onChange={(e) => setPrimaryKey(e.target.value)}
                placeholder="e.g. order_id, customer_id, id"
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-purple-200 dark:border-purple-800 rounded-md text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Existing staged records matching this primary key will be replaced with incoming modified versions.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
            />
          </div>

          <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md flex items-start space-x-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">
              aud_last_update
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              All records extracted into this flow automatically receive an enterprise ISO-8601 UTC timestamp column (<code className="font-mono text-zinc-700 dark:text-zinc-300">aud_last_update</code>) to power high-watermark delta ingestion.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </p>
          )}

          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Create Flow'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
