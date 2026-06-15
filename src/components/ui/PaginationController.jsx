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
    <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 no-print select-none rounded-b-2xl">
      {/* Keterangan Data */}
      <div className="text-[10px] font-bold text-slate-500 normal-case">
        Menampilkan <span className="text-slate-800 font-black">{startRow}</span> - <span className="text-slate-800 font-black">{endRow}</span> dari total <span className="text-blue-600 font-black">{totalRows}</span> baris data
      </div>

      {/* Pengatur Density Mode & Navigasi */}
      <div className="flex items-center gap-5">
        {/* Density Selector */}
        <div className="flex items-center gap-2">
          <Rows size={14} className="text-slate-400" />
          <select 
            value={rowsPerPage} 
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            className="bg-white border border-slate-200 text-[10px] font-black text-slate-700 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer focus:border-blue-500 shadow-3xs transition-colors"
          >
            <option value={25}>25 / Halaman</option>
            <option value={50}>50 / Halaman</option>
            <option value={100}>100 / Halaman</option>
          </select>
        </div>

        {/* Tombol Halaman */}
        <div className="flex items-center gap-1.5">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-3xs"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div className="text-[10px] font-black text-slate-700 px-3 py-1.5 bg-slate-200/50 rounded-lg border border-slate-200/50">
            {currentPage} <span className="text-slate-400 font-bold mx-0.5">/</span> {totalPages || 1}
          </div>

          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-3xs"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
