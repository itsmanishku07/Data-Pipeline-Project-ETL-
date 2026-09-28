import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  Globe, 
  Check, 
  Settings, 
  Sparkles, 
  Sun, 
  Moon, 
  ShieldCheck, 
  RotateCcw,
  Zap
} from 'lucide-react';
import { useTimezone, TIMEZONE_OPTIONS } from '../../context/TimezoneContext';

export const SettingsModal = ({ isOpen, onClose, isDark, onToggleTheme }) => {
  const {
    timezone,
    effectiveTimezone,
    setTimezone,
    is24Hour,
    setIs24Hour,
    currentTime,
    timezoneShort,
    formatTime,
    formatDate,
    formatDateTime
  } = useTimezone();

  const [searchFilter, setSearchFilter] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  if (!isOpen) return null;

  const handleSelectTimezone = (tzValue) => {
    setTimezone(tzValue);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleAutoDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    handleSelectTimezone(detected || 'Asia/Kolkata');
  };

  const filteredTimezones = TIMEZONE_OPTIONS.filter((tz) =>
    tz.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
    tz.region.toLowerCase().includes(searchFilter.toLowerCase()) ||
    tz.value.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <span>Studio Settings & Preferences</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure application timezone, live clock, audit timestamps, and display
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* LIVE CLOCK & ACTIVE TIMEZONE HERO CARD */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-white dark:from-zinc-950 dark:to-zinc-900 dark:border dark:border-zinc-800 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Globe className="w-32 h-32" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Studio Clock</span>
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white mt-1 flex items-baseline space-x-2">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 text-white">
                    {timezoneShort}
                  </span>
                </div>
                <div className="text-xs text-zinc-300 font-mono mt-1">
                  {formatDate(currentTime)} • {effectiveTimezone}
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:self-center">
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center space-x-1.5 border border-white/10 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Auto-Detect</span>
                </button>
              </div>
            </div>
          </div>

          {/* TIMEZONE SELECTION SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-zinc-500" />
                <span>Application Timezone</span>
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">
                Current: <strong className="text-zinc-800 dark:text-zinc-200">{effectiveTimezone}</strong>
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search timezone (e.g. Kolkata, IST, UTC, New York, London, Tokyo)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-950/40">
                {filteredTimezones.map((tz) => {
                  const isSelected = timezone === tz.value || (timezone === 'AUTO' && tz.value === 'AUTO');
                  return (
                    <button
                      key={tz.value}
                      type="button"
                      onClick={() => handleSelectTimezone(tz.value)}
                      className={`p-2.5 rounded-lg text-left transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-medium shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs truncate">{tz.label}</div>
                        <div className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>
                          {tz.value}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TIME FORMAT & CLOCK DISPLAY TOGGLES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Time Format</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Toggle 24-hour military format or standard 12-hour AM/PM clock display.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIs24Hour(true)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-colors border ${
                    is24Hour
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  24-Hour (20:56)
                </button>
                <button
                  type="button"
                  onClick={() => setIs24Hour(false)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition-colors border ${
                    !is24Hour
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  12-Hour (08:56 PM)
                </button>
              </div>
            </div>

            {/* THEME SELECTOR */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
              <div className="flex items-center space-x-2">
                <Sun className="w-4 h-4 text-zinc-500" />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Interface Theme</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Switch between clean light canvas and high-contrast dark theme.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => isDark && onToggleTheme()}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1 border ${
                    !isDark
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => !isDark && onToggleTheme()}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1 border ${
                    isDark
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>

          {/* AUDIT TIMESTAMPS INFO CARD */}
          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 space-y-1.5">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <strong className="text-xs">Audit Column Localization Engine (`aud_last_update`)</strong>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/80">
              All ingested batches and incremental flow syncs automatically stamp `aud_last_update`. The DataFlow Studio UI automatically converts and renders all dates, logs, sync intervals, and stage timestamps in your active timezone (<strong>{effectiveTimezone} • {timezoneShort}</strong>).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-medium">
            {saveToast && (
              <span className="flex items-center space-x-1 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>Timezone saved</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-medium text-xs shadow-xs transition-colors"
            >
              Done & Apply
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
