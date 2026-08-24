import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const DataGrid = ({
  columns = [],
  rows = [],
  totalRows,
  pageSize = 25,
  currentPage = 1,
  onPageChange,
  title,
  subtitle,
  actionButton,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localPage, setLocalPage] = useState(1);

  const columnDefs = useMemo(() => {
    return columns.map((col) => {
      if (typeof col === 'string') {
        return { name: col, spark_type: 'StringType' };
      }
      return { name: col.name, spark_type: col.spark_type, profile: col };
    });
  }, [columns]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim() || onPageChange) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      )
    );
  }, [rows, searchTerm, onPageChange]);

  const activePage = onPageChange ? currentPage : localPage;
  const activeTotal = totalRows ?? filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(activeTotal / pageSize));

  const displayRows = onPageChange
    ? rows
    : filteredRows.slice((localPage - 1) * pageSize, localPage * pageSize);

  const renderTypePill = (typeStr) => {
    const t = (typeStr || '').toLowerCase();
    let color = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    if (t.includes('int') || t.includes('long')) color = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
    else if (t.includes('double') || t.includes('float') || t.includes('decimal')) color = 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20';
    else if (t.includes('timestamp') || t.includes('date')) color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
    else if (t.includes('bool')) color = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';

    return (
      <span className={`inline-block text-[10px] font-mono px-1.5 py-0.2 rounded border ${color}`}>
        {typeStr}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors">
      {/* Header toolbar */}
      {(title || actionButton || subtitle) && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
          <div>
            {title && <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{title}</h4>}
            {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setLocalPage(1);
                }}
                className="pl-7 pr-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-900 dark:focus:border-sky-500 w-44"
              />
            </div>
            {actionButton}
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px]">
            <tr>
              <th className="py-2.5 px-3 text-slate-500 dark:text-slate-500 font-mono text-center w-10">#</th>
              {columnDefs.map((col, idx) => (
                <th key={idx} className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800/40 last:border-r-0 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <span>{col.name}</span>
                    {renderTypePill(col.spark_type)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-xs font-mono">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={columnDefs.length + 1} className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs font-sans">
                  No records available.
                </td>
              </tr>
            ) : (
              displayRows.map((row, rIdx) => {
                const rowNum = (activePage - 1) * pageSize + rIdx + 1;
                return (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-400 dark:text-slate-500 text-center select-none text-[11px]">{rowNum}</td>
                    {columnDefs.map((col, cIdx) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      return (
                        <td key={cIdx} className="py-2 px-3 text-slate-800 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800/20 last:border-r-0 max-w-xs truncate">
                          {isNull ? (
                            <span className="text-[10px] px-1 rounded bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 font-sans">
                              null
                            </span>
                          ) : typeof val === 'boolean' ? (
                            <span className={`text-[10px] px-1 rounded font-sans ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {val ? 'TRUE' : 'FALSE'}
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Toolbar */}
      <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-900 dark:text-slate-200">{displayRows.length > 0 ? (activePage - 1) * pageSize + 1 : 0}</span>-
          <span className="font-semibold text-slate-900 dark:text-slate-200">{Math.min(activePage * pageSize, activeTotal)}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-200">{activeTotal}</span> rows
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => {
              if (onPageChange) onPageChange(activePage - 1);
              else setLocalPage((p) => Math.max(1, p - 1));
            }}
            className="p-1 rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
            {activePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => {
              if (onPageChange) onPageChange(activePage + 1);
              else setLocalPage((p) => Math.min(totalPages, p + 1));
            }}
            className="p-1 rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
