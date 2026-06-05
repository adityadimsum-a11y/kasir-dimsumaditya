import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Activity, CheckCircle, Database } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, purchases, orders, sendToSheet, role }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  // Form Produksi
  const [adukanQty, setAdukanQty] = useState('');
  const [ayamUsed, setAyamUsed] = useState('');
  const [resultPcs, setResultPcs] = useState('');
  
  // Konstan Standard
  const PCS_PER_MIKA = 50;

  // ==========================================
  // CORE ENGINE 1: KALKULASI STOK DARI MOVEMENT
  // ==========================================
  const stockRealtime = useMemo(() => {
      let ayamGudang = 0;
      let frozenFreezer = 0;

      // Kalkulasi berdasarkan Log Pergerakan (Ledger System)
      (stockMovements || []).forEach(m => {
          const qty = Number(m.qty) || 0;
          
          // Logika Ayam
          if (m.item_name === 'AYAM') {
              if (m.to_location === 'GUDANG') ayamGudang += qty;
              if (m.from_location === 'GUDANG') ayamGudang -= qty;
          }
          
          // Logika Dimsum/Frozen
          if (m.item_name === 'DIMSUM' || m.item_name === 'FROZEN') {
              if (m.to_location === 'FREEZER') frozenFreezer += qty;
              if (m.from_location === 'FREEZER') frozenFreezer -= qty;
          }
      });

      // OTOMATIS: Tarik pembelian Ayam dari purchases (Untuk mem-bypass input manual)
      // (Di Phase 2 nanti ini akan dimigrasi sepenuhnya agar otomatis masuk ke stock_movements)
      (purchases || []).forEach(p => {
          if(String(p.itemName).toUpperCase().includes('AYAM')) ayamGudang += (Number(p.qty) || 0);
      });

      // OTOMATIS: Tarik Penjualan Pusat
      (orders || []).filter(o => o.category !== 'Pemalang').forEach(o => {
          frozenFreezer -= (Number(o.qty) || 0);
      });

      return { ayamGudang, frozenFreezer };
  }, [stockMovements, purchases, orders]);

  // ==========================================
  // CORE ENGINE 2: PRODUCTION BATCH INJECTION
  // ==========================================
  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      
      const batchId = generateId('BATCH', date);
      const mikaResult = Number(resultPcs) / PCS_PER_MIKA;

      // 1. DATA BATCH PRODUKSI
      const batchData = {
          id: batchId,
          date: date,
          adukan_qty: Number(adukanQty),
          ayam_used: Number(ayamUsed),
          result_pcs: Number(resultPcs),
          result_mika: mikaResult,
          status: 'SELESAI',
          branch_id: 'PUSAT'
      };

      // 2. DATA MOVEMENT OUT: PEMAKAIAN AYAM
      const moveAyamOut = {
          id: generateId('MOV-OUT', date),
          date: date,
          item_name: 'AYAM',
          from_location: 'GUDANG',
          to_location: 'PRODUKSI',
          qty: Number(ayamUsed),
          unit: 'KG',
          movement_type: 'PRODUCTION_USAGE',
          branch_id: 'PUSAT',
          reference_id: batchId
      };

      // 3. DATA MOVEMENT IN: HASIL DIMSUM MASUK FREEZER
      const moveDimsumIn = {
          id: generateId('MOV-IN', date),
          date: date,
          item_name: 'DIMSUM',
          from_location: 'PRODUKSI',
          to_location: 'FREEZER',
          qty: Number(resultPcs),
          unit: 'PCS',
          movement_type: 'PRODUCTION_RESULT',
          branch_id: 'PUSAT',
          reference_id: batchId
      };

      // Tembak 3 transaksi sekaligus ke database
      sendToSheet('insert', batchData, 'production_batches');
      sendToSheet('insert', [moveAyamOut, moveDimsumIn], 'stock_movements');

      // Reset Form
      setAdukanQty(''); setAyamUsed(''); setResultPcs('');
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER & SUMMARY REALTIME */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Database size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">STOK GUDANG (REALTIME)</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.ayamGudang.toFixed(1)} <span className="text-sm text-orange-400">KG</span></div>
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-4">
                 <div><div className="text-[10px] text-slate-500 uppercase font-bold">Estimasi Kantong</div><div className="font-bold text-emerald-400">{(stockRealtime.ayamGudang / 10).toFixed(1)} Ktg</div></div>
              </div>
          </div>
          
          <div className="bg-blue-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">STOK FREEZER PUSAT</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.frozenFreezer} <span className="text-sm text-cyan-300">PCS</span></div>
              <div className="mt-4 pt-4 border-t border-blue-800/50 flex gap-4">
                 <div><div className="text-[10px] text-blue-400 uppercase font-bold">Porsi (Prs)</div><div className="font-bold text-blue-200">{stockRealtime.frozenFreezer / 4} Prs</div></div>
                 <div><div className="text-[10px] text-blue-400 uppercase font-bold">Pack (Mika)</div><div className="font-bold text-blue-200">{stockRealtime.frozenFreezer / PCS_PER_MIKA} Mika</div></div>
              </div>
          </div>
      </div>

      {/* MODUL INPUT BATCH PRODUKSI (HANYA PUSAT) */}
      {role === 'admin' && (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Factory size={20}/></div>
              <div>
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Production Batch Engine</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ayam otomatis berkurang, Freezer otomatis bertambah</p>
              </div>
          </div>
          
          <form onSubmit={handleSimpanProduksi} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Eksekusi</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Jml Adukan</label><div className="relative"><input type="number" required placeholder="0" value={adukanQty} onChange={e=>setAdukanQty(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">Adk</span></div></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Ayam Terpakai</label><div className="relative"><input type="number" step="0.1" required placeholder="0" value={ayamUsed} onChange={e=>setAyamUsed(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">KG</span></div></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Hasil Jadi Freezer</label><div className="relative"><input type="number" required placeholder="0" value={resultPcs} onChange={e=>setResultPcs(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-blue-200 rounded-xl font-black text-blue-700 text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-blue-400">Pcs</span></div></div>
              
              <div className="md:col-span-4 mt-2">
                  <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2">
                      <CheckCircle size={18}/> Eksekusi Batch Produksi & Sinkronisasi Stok
                  </button>
              </div>
          </form>
      </div>
      )}

      {/* TABEL HISTORI BATCH PRODUKSI */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3">
              <ListChecks size={18} className="text-slate-600"/>
              <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log Produksi Terakhir</h4>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr>
                          <th className="px-4 py-3">Batch ID & Tgl</th>
                          <th className="px-4 py-3 text-center">Adukan</th>
                          <th className="px-4 py-3 text-center">Ayam Terpotong (Out)</th>
                          <th className="px-4 py-3 text-center">Dimsum Freezer (In)</th>
                          <th className="px-4 py-3 text-center">Status Engine</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBatches.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400 italic">Belum ada batch produksi yang terekam.</td></tr> : listBatches.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{b.id}</div><div className="text-[10px] text-slate-500">{formatDate(b.date)}</div></td>
                              <td className="px-4 py-3 text-center font-bold text-slate-700">{b.adukan_qty} Adk</td>
                              <td className="px-4 py-3 text-center font-black text-orange-600">-{b.ayam_used} KG</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">+{b.result_pcs} PCS <span className="text-[9px] font-bold text-slate-400 block">{b.result_mika} Mika</span></td>
                              <td className="px-4 py-3 text-center"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-bold tracking-widest border border-emerald-200">SYNCED</span></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
}
