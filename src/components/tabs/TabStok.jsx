import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Database, CheckCircle, Truck, DollarSign } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, purchases, sendToSheet, role }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  const [adukanQty, setAdukanQty] = useState('');
  const [ayamUsed, setAyamUsed] = useState('');
  const [additionalCost, setAdditionalCost] = useState('200000'); // Biaya bumbu, kulit, dll
  const [resultPcs, setResultPcs] = useState('');
  const PCS_PER_MIKA = 50;

  // ... (Gunakan useMemo stockRealtime seperti kode Anda sebelumnya) ...

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      const batchId = generateId('BATCH', date);
      
      const payload = { 
          id: batchId, date: date, 
          adukan_qty: Number(adukanQty), ayam_used: Number(ayamUsed), 
          additional_cost: Number(additionalCost), // <-- DIKIRIM KE SERVER
          result_pcs: Number(resultPcs), result_mika: Number(resultPcs) / PCS_PER_MIKA, 
          status: 'SELESAI', branch_id: 'PUSAT' 
      };

      // THE MAGIC TRIGGER: Minta server potong ayam via FIFO & Kalkulasi HPP!
      sendToSheet('event_production', payload, 'production_batches');
      
      alert("Batch Produksi Sukses!\nServer sedang menghitung HPP (Harga Pokok Penjualan) secara otomatis menggunakan algoritma Cost Layering FIFO.");
      setAdukanQty(''); setAyamUsed(''); setResultPcs('');
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* ... (Summary Cards) ... */}

      {role === 'admin' && (
      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-6 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Factory size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Auto-HPP Production Engine</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sistem otomatis menghitung Modal Asli per Dimsum (FIFO)</p></div>
          </div>
          
          <form onSubmit={handleSimpanProduksi} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Eksekusi</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Jml Adukan</label><input type="number" required placeholder="0" value={adukanQty} onChange={e=>setAdukanQty(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Ayam Dipakai (KG)</label><input type="number" step="0.1" required placeholder="0" value={ayamUsed} onChange={e=>setAyamUsed(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-purple-600 uppercase">Biaya Bumbu & Kulit</label><input type="number" required value={additionalCost} onChange={e=>setAdditionalCost(e.target.value)} className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl font-black text-sm text-purple-800" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Hasil Jadi (Pcs)</label><input type="number" required placeholder="0" value={resultPcs} onChange={e=>setResultPcs(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-blue-200 rounded-xl font-black text-blue-700 text-sm" /></div>
              
              <div className="md:col-span-5 mt-2">
                  <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2">
                      <CheckCircle size={18}/> Eksekusi & Kalkulasi HPP Otomatis
                  </button>
              </div>
          </form>
      </div>
      )}

      {role === 'admin' && (
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3"><ListChecks size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log HPP Produksi</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">Batch ID & Tgl</th><th className="px-4 py-3 text-center">Bahan Baku Keluar</th><th className="px-4 py-3 text-center">Dimsum Freezer Masuk</th><th className="px-4 py-3 text-right">Total Biaya Produksi</th><th className="px-4 py-3 text-center">HPP Per Pcs</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBatches.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{b.id}</div><div className="text-[10px] text-slate-500">{formatDate(b.date)}</div></td>
                              <td className="px-4 py-3 text-center font-black text-orange-600">-{b.ayam_used} KG AYAM</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">+{b.result_pcs} PCS DIMSUM</td>
                              <td className="px-4 py-3 text-right font-black text-slate-800">{b.total_cost ? formatRp(b.total_cost) : '-'}</td>
                              <td className="px-4 py-3 text-center font-black bg-emerald-50 text-emerald-700 border-l border-emerald-100">{b.hpp_per_pcs ? formatRp(Math.round(b.hpp_per_pcs)) : 'Menghitung...'}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
      )}
    </div>
  );
}
