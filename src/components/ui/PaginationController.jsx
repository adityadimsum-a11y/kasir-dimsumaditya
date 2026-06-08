import React from 'react';
import { ChevronLeft, ChevronRight, Rows } from 'lucide-react';

export default function PaginationController({ 
  currentPage, 
  totalPages, 
  totalRows, 
  rowsPerPage, 
  onPageChange, 
  onRowsPerPageChange 
}) {
  if (totalRows === 0) return null;

  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalRows);

  return (
    <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 no-print select-none">
      {/* Keterangan Data */}
      <div className="text-xs font-bold text-slate-500">
        Menampilkan <span className="text-slate-800">{startRow}</span> - <span className="text-slate-800">{endRow}</span> dari <span className="text-slate-900 font-black">{totalRows}</span> total baris data
      </div>

      {/* Pengatur Density Mode & Navigasi */}
      <div className="flex items-center gap-6">
        {/* Density Selector */}
        <div className="flex items-center gap-2">
          <Rows size={14} className="text-slate-400" />
          <select 
            value={rowsPerPage} 
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            className="bg-white border border-slate-200 text-xs font-black text-slate-700 py-1 px-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value={25}>25 / Halaman</option>
            <option value={50}>50 / Halaman</option>
            <option value={100}>100 / Halaman</option>
          </select>
        </div>

        {/* Tombol Halaman */}
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="text-xs font-black text-slate-700 px-3 py-1 bg-slate-200/60 rounded-lg">
            {currentPage} <span className="text-slate-400 font-normal">/</span> {totalPages || 1}
          </div>

          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
