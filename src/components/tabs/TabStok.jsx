import React, { useState, useMemo } from 'react';
import { Layers, CheckCircle, Scale, CookingPot, Package } from 'lucide-react';
import { formatRp, getTodayStr, generateId } from '../../utils/helpers';
import PaginationController from '../ui/PaginationController'; // Kunci Phase 11 & 12

export default function TabStok({ productionBatches, stockMovements, inventoryCostLayers, purchases, orders, sendToSheet, requestDelete, role, user, distributionOrders, showToast }) {
  const todayStr = getTodayStr();
  
  // 1. FORM STATE
  const [formProd, setFormProd] = useState({
     date: todayStr, adukan_used: 1, result_pcs: 1000, overhead_cost: 50000, notes: ''
  });

  // 2. PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const totalAyamCalculated = Number(formProd.adukan_used) * 30; 
  const targetPcsStandard = Number(formProd.adukan_used) * 1000; 
  const currentYield = targetPcsStandard > 0 ? (Number(formProd.result_pcs) / targetPcsStandard) * 100 : 0;

  const autoConversion = useMemo(() => {
     const pcs = Number(formProd.result_pcs) || 0;
     return {
        mika: Math.ceil(pcs / 50),     
        porsi: Math.ceil(pcs / 4),     
        kantong: (totalAyamCalculated / 10).toFixed(1) 
     };
  }, [formProd.result_pcs, totalAyamCalculated]);

  const handleCreateProduction = (e) => {
     e.preventDefault();
     if(Number(formProd.result_pcs) <= 0) { showToast('Hasil produksi tidak boleh kosong!', 'error'); return; }

     const payload = {
        id: generateId('BATCH', formProd.date),
        date: formProd.date,
        adukan_used: Number(formProd.adukan_used),
        result_pcs: Number(formProd.result_pcs),
        overhead_cost: Number(formProd.overhead_cost),
        notes: formProd.notes,
        production_branch: user.branch_id
     };

     sendToSheet('event_production', payload, 'system_events').then(success => {
         if(success) {
             setFormProd({ date: todayStr, adukan_used: 1, result_pcs: 1000, overhead_cost: 50000, notes: '' });
             setCurrentPage(1);
         }
     });
  };

  // 3. COMPUTED MEMOIZED PACINATION LOGIC (ANTI BREAK)
  const sortedBatches = useMemo(() => {
    return (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [productionBatches]);

  const totalRows = sortedBatches.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const paginatedBatches = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return sortedBatches.slice(startIdx, startIdx + rowsPerPage);
  }, [sortedBatches, currentPage, rowsPerPage]);

  const handlePageChange = (newPage) => setCurrentPage(newPage);
  const handleRowsPerPageChange = (newRows) => { setRowsPerPage(newRows); setCurrentPage(1); };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-10">
      
      {/* CONVERSION PANEL */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-4 shadow-xl">
         <div className="p-3 bg-slate-800/60 rounded-xl text-center"><div className="text-[10px] text-slate-400 font-bold uppercase">1 Kantong</div><div className="text-lg font-black text-cyan-400">10 KG Ayam</div></div>
         <div className="p-3 bg-slate-800/60 rounded-xl text-center"><div className="text-[10px] text-slate-400 font-bold uppercase">1 Adukan</div><div className="text-lg font-black text-purple-400">30 KG Ayam</div></div>
         <div className="p-3 bg-slate-800/60 rounded-xl text-center"><div className="text-[10px] text-slate-400 font-bold uppercase">1 Adukan</div><div className="text-lg font-black text-emerald-400">1000 PCS</div></div>
         <div className="p-3 bg-slate-800/60 rounded-xl text-center"><div className="text-[10px] text-slate-400 font-bold uppercase">1 Mika</div><div className="text-lg font-black text-amber-400">50 PCS</div></div>
         <div className="p-3 bg-slate-800/60 rounded-xl text-center"><div className="text-[10px] text-slate-400 font-bold uppercase">1 Porsi</div><div className="text-lg font-black text-rose-400">4 PCS</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* PRODUCTION FORM */}
         <div className="bg-white p-6 rounded-2xl border shadow-sm h-max">
            <div className="flex items-center gap-2 mb-4 border-b pb-3 text-slate-800 font-black text-sm uppercase">
               <CookingPot size={18} className="text-purple-600"/> Entry Batch Produksi
            </div>
            <form onSubmit={handleCreateProduction} className="space-y-4">
               <div><label className="text-[10px] font-bold text-slate-500 uppercase">Tanggal Kerja</label><input type="date" required value={formProd.date} onChange={e=>setFormProd({...formProd, date:e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" /></div>
               <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] font-bold text-slate-500 uppercase">Jumlah Adukan</label><input type="number" min="1" required value={formProd.adukan_used} onChange={e=>setFormProd({...formProd, adukan_used:e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-sm" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 uppercase">Ayam Dibutuhkan</label><div className="w-full p-2.5 bg-slate-100 border text-slate-600 font-black text-sm rounded-xl">{totalAyamCalculated} KG</div></div>
               </div>
               <div><label className="text-[10px] font-bold text-purple-600 uppercase">Hasil Riil (Pcs Dimsum)</label><input type="number" required min="1" value={formProd.result_pcs} onChange={e=>setFormProd({...formProd, result_pcs:e.target.value})} className="w-full p-2.5 bg-purple-50 border border-purple-200 text-purple-700 font-black text-base rounded-xl" /></div>
               <div><label className="text-[10px] font-bold text-slate-500 uppercase">Biaya Overhead Pembantu (Gas/Bumbu)</label><input type="number" required value={formProd.overhead_cost} onChange={e=>setFormProd({...formProd, overhead_cost:e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
               <button type="submit" className="w-full bg-slate-900 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider flex items-center justify-center gap-2"><CheckCircle size={16}/> Amankan Yield Batch</button>
            </form>
         </div>

         {/* LIVE YIELD RENDER */}
         <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-6 flex flex-col justify-between">
            <div>
               <div className="flex items-center gap-2 mb-4 border-b pb-3 text-slate-800 font-black text-sm uppercase"><Scale size={18} className="text-amber-500"/> Live Yield Rendering & Costing</div>
               <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rendemen Yield</div>
                     <div className={`text-2xl font-black mt-1 ${currentYield >= 98 ? 'text-emerald-600' : 'text-rose-600'}`}>{currentYield.toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimasi Mika</div>
                     <div className="text-2xl font-black text-slate-800 mt-1">{autoConversion.mika} <span className="text-xs text-slate-400">Box</span></div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimasi Porsi</div>
                     <div className="text-2xl font-black text-slate-800 mt-1">{autoConversion.porsi} <span className="text-xs text-slate-400">Prc</span></div>
                  </div>
               </div>
               
               <div className="p-4 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5"><Package size={14}/> Auto-Packaging Allocation Layer</h4>
                  <p className="text-[11px] mt-1 font-medium">Sistem otomatis mendebit pengunaan aset pembungkus **{autoConversion.mika} Mika Plastik** dan **{autoConversion.porsi} Alas Porsi** dari inventaris logistik cabang secara berpasangan demi menjaga validitas HPP Gabungan.</p>
               </div>
            </div>
            
            <div className="border-t pt-4 text-[10px] font-bold text-slate-400 uppercase">Lini Produksi Node Terikat: <span className="text-red-600">{user.branch_id}</span></div>
         </div>
      </div>

      {/* HISTORI TABLE WITH INTEGRATED PAGINATION */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6 flex flex-col">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase"><tr><th className="p-3">ID Batch</th><th className="p-3 text-center">Adukan (KG)</th><th className="p-3 text-right">Hasil Jadi (Pcs)</th><th className="p-3 text-right">Konversi Mika</th><th className="p-3 text-center">Yield %</th><th className="p-3 text-right">HPP / Pcs</th><th className="p-3 text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
               {paginatedBatches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                     <td className="p-3 font-mono text-[10px] text-slate-500">{b.id}</td>
                     <td className="p-3 text-center text-purple-600">{b.adukan_used} Adukan ({b.total_ayam_kg} KG)</td>
                     <td className="p-3 text-right text-slate-900">{Number(b.result_pcs).toLocaleString('id-ID')} Pcs</td>
                     <td className="p-3 text-right text-amber-600">{b.total_mika} Mika</td>
                     <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${Number(b.yield_percent) >= 98 ? 'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{Number(b.yield_percent).toFixed(1)}%</span></td>
                     <td className="p-3 text-right text-emerald-600">{formatRp(b.hpp_per_pcs)}</td>
                     <td className="p-3 text-center">
                        {(role === 'super_admin' || role === 'admin') && (
                          <button type="button" onClick={() => requestDelete(b.id)} className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded">Hapus</button>
                        )}
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>

         {/* CONTROLLER INTEGRASI PHASE 11 */}
         <PaginationController 
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
         />
      </div>

    </div>
  );
}
