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
    return (
      <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
        {typeStr}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs flex flex-col transition-colors w-full">
      {/* Header toolbar */}
      {(title || actionButton || subtitle) && (
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            {title && <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">{title}</h4>}
            {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setLocalPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full sm:w-48 transition-shadow"
              />
            </div>
            {actionButton}
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[420px] -webkit-overflow-scrolling-touch">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead className="bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 text-xs">
            <tr>
              <th className="py-2.5 px-3 text-zinc-400 dark:text-zinc-500 font-mono text-center w-10 font-normal">#</th>
              {columnDefs.map((col, idx) => (
                <th key={idx} className="py-2.5 px-3 font-medium text-zinc-700 dark:text-zinc-300 border-r border-zinc-200/60 dark:border-zinc-800/60 last:border-r-0 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <span>{col.name}</span>
                    {renderTypePill(col.spark_type)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 text-xs font-mono">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={columnDefs.length + 1} className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs font-sans">
                  No records available.
                </td>
              </tr>
            ) : (
              displayRows.map((row, rIdx) => {
                const rowNum = (activePage - 1) * pageSize + rIdx + 1;
                return (
                  <tr key={rIdx} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-2 px-3 text-zinc-400 dark:text-zinc-500 text-center select-none text-xs">{rowNum}</td>
                    {columnDefs.map((col, cIdx) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      return (
                        <td key={cIdx} className="py-2 px-3 text-zinc-800 dark:text-zinc-200 border-r border-zinc-100 dark:border-zinc-800/20 last:border-r-0 max-w-xs truncate">
                          {isNull ? (
                            <span className="text-[10px] px-1 py-0.5 rounded text-zinc-400 dark:text-zinc-500 font-sans italic">
                              null
                            </span>
                          ) : typeof val === 'boolean' ? (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${val ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'}`}>
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
      <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <div>
          Showing <span className="font-medium text-zinc-900 dark:text-zinc-100">{displayRows.length > 0 ? (activePage - 1) * pageSize + 1 : 0}</span>-
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{Math.min(activePage * pageSize, activeTotal)}</span> of{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{activeTotal}</span> rows
        </div>

        <div className="flex items-center space-x-1.5 self-end sm:self-auto">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => {
              if (onPageChange) onPageChange(activePage - 1);
              else setLocalPage((p) => Math.max(1, p - 1));
            }}
            className="p-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
            {activePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => {
              if (onPageChange) onPageChange(activePage + 1);
              else setLocalPage((p) => Math.min(totalPages, p + 1));
            }}
            className="p-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
