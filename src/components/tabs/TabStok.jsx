import React, { useState, useMemo } from 'react';
import { Factory, Calculator, Layers, CheckCircle } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate, getLocalYMD } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const RULES = { KG_PER_ADUKAN: 30, PCS_PER_ADUKAN: 1000, PCS_PER_MIKA: 50 };

  const [formProd, setFormProd] = useState({ date: todayStr, adukan_used: '', result_pcs: '', overhead_cost: '' });

  const targetPcs = Number(formProd.adukan_used) * RULES.PCS_PER_ADUKAN;
  const targetKg = Number(formProd.adukan_used) * RULES.KG_PER_ADUKAN;
  const targetMika = Math.ceil(Number(formProd.result_pcs || 0) / RULES.PCS_PER_MIKA);
  const wastePcs = targetPcs > 0 && formProd.result_pcs ? targetPcs - Number(formProd.result_pcs) : 0;
  const yieldPercent = targetPcs > 0 && formProd.result_pcs ? (Number(formProd.result_pcs) / targetPcs) * 100 : 0;

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
      return { totalAdukan, totalKg, totalPcs, totalMika, potensiOmzet: totalPcs * 3000 };
  }, [productionBatches]);

  const handleSubmitProduksi = async (e) => {
      e.preventDefault();
      if(Number(formProd.result_pcs) > targetPcs) return;

      const payload = {
          id: generateId('PRD', formProd.date), date: formProd.date, branch_id: user?.branch_id || 'PUSAT',
          adukan_used: Number(formProd.adukan_used), result_pcs: Number(formProd.result_pcs), overhead_cost: Number(formProd.overhead_cost || 0)
      };

      const success = await sendToSheet('event_production', payload, 'production_batches');
      if(success) setFormProd({ date: todayStr, adukan_used: '', result_pcs: '', overhead_cost: '' });
  };

  const listBatches = (productionBatches || []).filter(b=>!b.isDeleted).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10 w-full md:w-1/3">
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2"><Factory className="text-blue-400"/> Production Summary Board</h2>
              <p className="text-xs text-slate-400 mt-1">Efisiensi konversi dapur 30 hari terakhir.</p>
          </div>
          <div className="relative z-10 w-full md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Olahan</div>
                  <div className="text-xl font-black text-white">{prodStats.totalKg} <span className="text-xs text-orange-400">KG</span></div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Hasil Jadi</div>
                  <div className="text-xl font-black text-white">{prodStats.totalPcs.toLocaleString('id-ID')} <span className="text-xs text-emerald-400">PCS</span></div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Mika Auto-Cut</div>
                  <div className="text-xl font-black text-white">{prodStats.totalMika.toLocaleString('id-ID')} <span className="text-xs text-blue-400">Mika</span></div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Potensi Pasar</div>
                  <div className="text-xl font-black text-emerald-400">{formatRp(prodStats.potensiOmzet)}</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-600 h-max">
              <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Calculator size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase">Input Batch Produksi</h3></div></div>
              <form onSubmit={handleSubmitProduksi} className="space-y-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Produksi</label>
                      <input type="date" required value={formProd.date} onChange={e=>setFormProd({...formProd, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Jumlah Olahan (Adukan)</label>
                      <input type="number" step="0.5" required placeholder="Cth: 2" value={formProd.adukan_used} onChange={e=>setFormProd({...formProd, adukan_used: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-black" />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-emerald-600 uppercase">Hasil Riil (Dimsum Jadi)</label>
                      <input type="number" required placeholder="0" value={formProd.result_pcs} onChange={e=>setFormProd({...formProd, result_pcs: e.target.value})} className="w-full p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-black" />
                  </div>

                  {formProd.result_pcs > 0 && formProd.adukan_used > 0 && (
                      <div className="p-3 rounded-xl border bg-slate-50 text-xs font-bold text-slate-600 space-y-1">
                          <div className="flex justify-between"><span>Yield Rendemen:</span><span className="text-emerald-600">{yieldPercent.toFixed(1)}%</span></div>
                          <div className="flex justify-between"><span>Waste Rusak:</span><span className="text-rose-600">{wastePcs} Pcs</span></div>
                          <div className="flex justify-between border-t pt-1 mt-1"><span>Potong Kemasan:</span><span className="text-blue-600">{targetMika} Mika</span></div>
                      </div>
                  )}

                  <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Biaya Overhead Pendukung</label>
                      <div className="relative"><span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span><input type="text" value={formProd.overhead_cost ? Number(formProd.overhead_cost).toLocaleString('id-ID') : ''} onChange={e=>setFormProd({...formProd, overhead_cost: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700" /></div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wide text-xs flex justify-center items-center gap-2 mt-2"><CheckCircle size={16}/> Validasi & Potong Stok</button>
              </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 text-xs uppercase flex items-center gap-2"><Layers size={18}/> Log Hasil Konversi Pabrik</h4></div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                          <tr><th>ID & Batch</th><th className="text-center">Dapur (Kg)</th><th className="text-center">Hasil (Pcs)</th><th className="text-center">Yield %</th><th className="text-center">Pack</th><th className="text-right">HPP FIFO</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {listBatches.map(b => (
                              <tr key={b.id} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3"><div>{formatDate(b.date)}</div><div className="text-[10px] text-slate-400 font-mono">{b.id}</div></td>
                                  <td className="px-4 py-3 text-center text-orange-600">{b.total_ayam_kg || Number(b.adukan_used)*30} Kg</td>
                                  <td className="px-4 py-3 text-center text-emerald-600">{Number(b.result_pcs).toLocaleString('id-ID')} Pcs</td>
                                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-slate-100 text-[10px]">{Number(b.yield_percent || 100).toFixed(1)}%</span></td>
                                  <td className="px-4 py-3 text-center text-blue-600">{b.total_mika || Math.ceil(Number(b.result_pcs)/50)} Mika</td>
                                  <td className="px-4 py-3 text-right text-slate-900 font-black">{formatRp(b.hpp_per_pcs)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
}
