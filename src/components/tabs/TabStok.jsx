import React, { useState, useMemo } from 'react';
import { Package, Factory, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Calculator, Layers } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate, getLocalYMD } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();

  // =====================================
  // MASTER CONVERSION RULES (PHASE 12.5)
  // =====================================
  const RULES = {
      KG_PER_ADUKAN: 30,
      PCS_PER_ADUKAN: 1000,
      PCS_PER_MIKA: 50,
      PCS_PER_PORSI: 4,
      KG_PER_KANTONG: 10
  };

  // =====================================
  // STATE FORM PRODUKSI
  // =====================================
  const [formProd, setFormProd] = useState({
      date: todayStr,
      adukan_used: '',
      result_pcs: '',
      overhead_cost: ''
  });

  // =====================================
  // HELPER: INPUT RUPIAH OTOMATIS
  // =====================================
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); // Kunci hanya angka
      setFormProd(prev => ({ ...prev, [field]: rawValue }));
  };

  // =====================================
  // REAL-TIME YIELD CALCULATION
  // =====================================
  const targetPcs = Number(formProd.adukan_used) * RULES.PCS_PER_ADUKAN;
  const targetKg = Number(formProd.adukan_used) * RULES.KG_PER_ADUKAN;
  const targetMika = Math.ceil(Number(formProd.result_pcs || 0) / RULES.PCS_PER_MIKA);
  
  const wastePcs = targetPcs > 0 && formProd.result_pcs ? targetPcs - Number(formProd.result_pcs) : 0;
  const yieldPercent = targetPcs > 0 && formProd.result_pcs ? (Number(formProd.result_pcs) / targetPcs) * 100 : 0;

  // =====================================
  // PRODUCTION BOARD ANALYTICS (30 HARI)
  // =====================================
  const prodStats = useMemo(() => {
      const today = new Date();
      const last30Days = new Date(today); last30Days.setDate(today.getDate() - 30);
      const str30Days = last30Days.toISOString().split('T')[0];

      let totalAdukan = 0, totalKg = 0, totalPcs = 0, totalMika = 0;

      (productionBatches || []).forEach(b => {
          if (!b.isDeleted && getLocalYMD(b.date) >= str30Days) {
              totalAdukan += Number(b.adukan_used) || 0;
              totalKg += Number(b.total_ayam_kg) || 0;
              totalPcs += Number(b.result_pcs) || 0;
              totalMika += Number(b.total_mika) || 0;
          }
      });

      // Potensi Omzet (Estimasi Eceran Rp3.000 / Tier 3)
      const potensiOmzet = totalPcs * 3000;

      return { totalAdukan, totalKg, totalPcs, totalMika, potensiOmzet };
  }, [productionBatches]);

  // =====================================
  // HANDLER SUBMIT PRODUKSI
  // =====================================
  const handleSubmitProduksi = async (e) => {
      e.preventDefault();
      
      if(Number(formProd.result_pcs) > targetPcs) {
          showToast('⛔ Hasil Pcs tidak boleh melebihi Target Standar (1 Adukan = 1000 Pcs).', 'error');
          return;
      }

      const payload = {
          id: generateId('PRD', formProd.date),
          date: formProd.date,
          branch_id: user.branch_id || 'PUSAT',
          adukan_used: Number(formProd.adukan_used),
          result_pcs: Number(formProd.result_pcs),
          overhead_cost: Number(formProd.overhead_cost || 0),
          // Sisa data turunan (waste, hpp, yield) akan dihitung otomatis oleh Backend GAS Phase 12.5
      };

      const success = await sendToSheet('event_production', payload, 'production_batches');
      if(success) {
          setFormProd({ date: todayStr, adukan_used: '', result_pcs: '', overhead_cost: '' });
      }
  };

  const listBatches = (productionBatches || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      {/* 1. PRODUCTION SUMMARY BOARD */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10"><Factory size={150} className="text-white"/></div>
          <div className="relative z-10 w-full md:w-1/3">
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2"><Factory className="text-blue-400"/> Production Summary Board</h2>
              <p className="text-xs text-slate-400 mt-1">Performa dapur & konversi bahan baku 30 hari terakhir.</p>
          </div>
          <div className="relative z-10 w-full md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Olahan</div>
                  <div className="text-xl font-black text-white">{prodStats.totalKg} <span className="text-xs text-orange-400">KG</span></div>
                  <div className="text-[10px] text-slate-500 font-bold">{prodStats.totalAdukan} Adukan</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hasil Dimsum</div>
                  <div className="text-xl font-black text-white">{prodStats.totalPcs.toLocaleString('id-ID')} <span className="text-xs text-emerald-400">PCS</span></div>
                  <div className="text-[10px] text-slate-500 font-bold">Siap Jual</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mika Terpakai</div>
                  <div className="text-xl font-black text-white">{prodStats.totalMika.toLocaleString('id-ID')} <span className="text-xs text-blue-400">Mika</span></div>
                  <div className="text-[10px] text-slate-500 font-bold">Auto-Deducted</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Potensi Omzet</div>
                  <div className="text-xl font-black text-emerald-400">{formatRp(prodStats.potensiOmzet)}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Estimasi Eceran</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 2. FORM ENGINE KONVERSI PRODUKSI */}
          <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-600 h-max">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                  <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Calculator size={20}/></div>
                  <div>
                      <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Input Batch Produksi</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Konversi & Yield Otomatis</p>
                  </div>
              </div>

              <form onSubmit={handleSubmitProduksi} className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Produksi</label>
                      <input type="date" required value={formProd.date} onChange={e=>setFormProd({...formProd, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                  </div>

                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Jumlah Adukan (Resep Utama)</label>
                      <div className="relative">
                          <input type="number" step="0.5" required min="0.5" placeholder="Contoh: 2" value={formProd.adukan_used} onChange={e=>setFormProd({...formProd, adukan_used: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-800 outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="absolute right-4 top-2.5 text-xs font-black text-blue-400">ADUKAN</span>
                      </div>
                      {formProd.adukan_used > 0 && (
                          <div className="text-[9px] font-bold text-slate-500 mt-1 bg-slate-100 p-2 rounded-lg">
                              💡 Target Sistem: <span className="text-orange-600">{targetKg} KG Ayam</span> ➔ <span className="text-emerald-600">{targetPcs.toLocaleString('id-ID')} Pcs Dimsum</span>
                          </div>
                      )}
                  </div>

                  <div className="space-y-1 pt-2 border-t border-dashed">
                      <label className="text-[10px] font-bold text-emerald-600 uppercase">Hasil Akhir Riil (Dimsum Jadi)</label>
                      <div className="relative">
                          <input type="number" required placeholder="0" value={formProd.result_pcs} onChange={e=>setFormProd({...formProd, result_pcs: e.target.value})} className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500" />
                          <span className="absolute right-4 top-2.5 text-xs font-black text-emerald-400">PCS</span>
                      </div>
                  </div>

                  {/* KALKULATOR YIELD LIVE */}
                  {formProd.result_pcs > 0 && formProd.adukan_used > 0 && (
                      <div className={`p-3 rounded-xl border flex flex-col gap-2 ${yieldPercent >= 95 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="flex justify-between items-center text-xs font-bold">
                              <span className={yieldPercent >= 95 ? 'text-emerald-700' : 'text-rose-700'}>Yield Produksi:</span>
                              <span className={`text-sm font-black ${yieldPercent >= 95 ? 'text-emerald-600' : 'text-rose-600'}`}>{yieldPercent.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span>Kebocoran (Waste):</span>
                              <span className="text-rose-600">{wastePcs.toLocaleString('id-ID')} Pcs</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t pt-1 mt-1">
                              <span>Auto-Potong Mika:</span>
                              <span className="text-blue-600">{targetMika.toLocaleString('id-ID')} Mika</span>
                          </div>
                      </div>
                  )}

                  {/* INPUT BIAYA OVERHEAD (LOCKED RP PREFIX) */}
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Biaya Overhead Lainnya (Opsional)</label>
                      <div className="relative">
                          <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                          <input type="text" placeholder="0" value={formProd.overhead_cost ? Number(formProd.overhead_cost).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('overhead_cost', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-slate-300" />
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">Bumbu tambahan, gas, dll. (Ayam dihitung otomatis dari HPP FIFO).</p>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-md transition uppercase tracking-wide text-xs flex items-center justify-center gap-2 mt-4">
                      <CheckCircle size={16}/> Proses Batch & Potong Stok
                  </button>
              </form>
          </div>

          {/* 3. TABEL HISTORI PRODUKSI & HPP */}
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm flex items-center gap-2"><Layers size={18} className="text-slate-500"/> Log Batch Produksi & Yield</h4>
              </div>
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                          <tr>
                              <th className="px-4 py-3">Tgl & ID Batch</th>
                              <th className="px-4 py-3 text-center">Ayam (Kg)</th>
                              <th className="px-4 py-3 text-center">Hasil (Pcs)</th>
                              <th className="px-4 py-3 text-center">Yield %</th>
                              <th className="px-4 py-3 text-center">Pack</th>
                              <th className="px-4 py-3 text-right">HPP / Pcs</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {listBatches.map(b => (
                              <tr key={b.id} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3">
                                      <div className="font-bold text-slate-700">{formatDate(b.date)}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">{b.id}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <div className="font-black text-orange-600">{b.total_ayam_kg} Kg</div>
                                      <div className="text-[9px] text-slate-400 font-bold">{b.adukan_used} Adukan</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <div className="font-black text-emerald-600">{Number(b.result_pcs).toLocaleString('id-ID')} Pcs</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black ${Number(b.yield_percent) >= 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                          {Number(b.yield_percent).toFixed(1)}%
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <div className="text-xs font-bold text-blue-600">{b.total_mika} Mika</div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className="font-black text-slate-800">{formatRp(b.hpp_per_pcs)}</div>
                                      <div className="text-[9px] text-slate-400 font-bold">FIFO Cost</div>
                                  </td>
                              </tr>
                          ))}
                          {listBatches.length === 0 && (
                              <tr><td colSpan="6" className="text-center py-8 text-slate-400 text-sm">Belum ada data batch produksi.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
}
