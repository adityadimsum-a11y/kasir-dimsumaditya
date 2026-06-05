import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Database, CheckCircle, Truck, Download } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, distributionOrders, purchases, orders, sendToSheet, role, user }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  const [adukanQty, setAdukanQty] = useState('');
  const [ayamUsed, setAyamUsed] = useState('');
  const [resultPcs, setResultPcs] = useState('');
  const PCS_PER_MIKA = 50;

  // ==========================================
  // CORE ENGINE 1: STOK SEPARATION (PUSAT VS CABANG)
  // ==========================================
  const stockRealtime = useMemo(() => {
      let ayamGudang = 0;
      let frozenStock = 0;

      // Filter movement khusus cabang ini (Atau semua jika Pusat)
      const myMovements = role === 'admin' ? stockMovements : (stockMovements || []).filter(m => m.branch_id === user.branch_id);

      (myMovements || []).forEach(m => {
          const qty = Number(m.qty) || 0;
          
          if (role === 'admin' && m.item_name === 'AYAM') {
              if (m.to_location === 'GUDANG') ayamGudang += qty;
              if (m.from_location === 'GUDANG') ayamGudang -= qty;
          }
          
          // Logika Freezer sesuai Role
          const targetFreezer = role === 'admin' ? 'FREEZER_PUSAT' : 'FREEZER_CABANG';
          if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
              if (m.to_location === targetFreezer) frozenStock += qty;
              if (m.from_location === targetFreezer) frozenStock -= qty;
          }
      });

      // LEGACY BYPASS (Akan dihapus di masa depan)
      if (role === 'admin') {
          (purchases || []).forEach(p => { if(String(p.itemName).toUpperCase().includes('AYAM')) ayamGudang += (Number(p.qty) || 0); });
          (orders || []).filter(o => o.category !== 'Pemalang').forEach(o => { frozenStock -= (Number(o.qty) || 0); });
      } else {
          // Legacy Cabang (Khusus Pemalang lama)
          (orders || []).filter(o => o.category === 'Pemalang').forEach(o => { frozenStock -= (Number(o.qty) || 0); });
      }

      return { ayamGudang, frozenStock };
  }, [stockMovements, purchases, orders, role, user.branch_id]);

  // ==========================================
  // CORE ENGINE 2: PRODUCTION BATCH (PUSAT)
  // ==========================================
  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      const batchId = generateId('BATCH', date);
      
      const batchData = { id: batchId, date: date, adukan_qty: Number(adukanQty), ayam_used: Number(ayamUsed), result_pcs: Number(resultPcs), result_mika: Number(resultPcs) / PCS_PER_MIKA, status: 'SELESAI', branch_id: 'PUSAT' };
      const moveAyamOut = { id: generateId('MOV-OUT', date), date: date, item_name: 'AYAM', from_location: 'GUDANG', to_location: 'PRODUKSI', qty: Number(ayamUsed), unit: 'KG', movement_type: 'PRODUCTION_USAGE', branch_id: 'PUSAT', reference_id: batchId };
      const moveDimsumIn = { id: generateId('MOV-IN', date), date: date, item_name: 'DIMSUM', from_location: 'PRODUKSI', to_location: 'FREEZER_PUSAT', qty: Number(resultPcs), unit: 'PCS', movement_type: 'PRODUCTION_RESULT', branch_id: 'PUSAT', reference_id: batchId };

      sendToSheet('insert', batchData, 'production_batches');
      sendToSheet('insert', [moveAyamOut, moveDimsumIn], 'stock_movements');
      setAdukanQty(''); setAyamUsed(''); setResultPcs('');
  };

  // ==========================================
  // CORE ENGINE 3: RECEIVE DO (CABANG)
  // ==========================================
  const incomingDO = (distributionOrders || []).filter(d => d.to_branch === user.branch_id && d.status === 'DIKIRIM');
  
  const handleTerimaBarang = (doItem) => {
      const confirmReceive = window.confirm(`Terima barang sejumlah ${doItem.qty} Pcs dari DO: ${doItem.id}? Stok Freezer Cabang akan otomatis bertambah.`);
      if(!confirmReceive) return;

      // 1. Update status DO
      const updateDO = { id: doItem.id, status: 'DITERIMA' };

      // 2. Insert Stock Movement Cabang (Masuk)
      const moveReceive = {
          id: generateId('MOV-RCV', getTodayStr()),
          date: getTodayStr(),
          item_name: 'DIMSUM FROZEN',
          from_location: 'DELIVERY',
          to_location: 'FREEZER_CABANG',
          qty: Number(doItem.qty),
          unit: 'PCS',
          movement_type: 'DISTRIBUTION_IN',
          branch_id: user.branch_id,
          reference_id: doItem.id
      };

      sendToSheet('update', updateDO, 'distribution_orders');
      sendToSheet('insert', moveReceive, 'stock_movements');
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* SUMMARY REALTIME */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {role === 'admin' && (
          <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Database size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">STOK GUDANG AYAM</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.ayamGudang.toFixed(1)} <span className="text-sm text-orange-400">KG</span></div>
          </div>
          )}
          
          <div className="bg-blue-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">STOK FREEZER {role === 'admin' ? 'PUSAT' : 'CABANG'}</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.frozenStock} <span className="text-sm text-cyan-300">PCS</span></div>
              <div className="mt-4 pt-4 border-t border-blue-800/50 flex gap-4">
                 <div><div className="text-[10px] text-blue-400 uppercase font-bold">Porsi</div><div className="font-bold text-blue-200">{stockRealtime.frozenStock / 4} Prs</div></div>
                 <div><div className="text-[10px] text-blue-400 uppercase font-bold">Pack (Mika)</div><div className="font-bold text-blue-200">{stockRealtime.frozenStock / PCS_PER_MIKA} Mika</div></div>
              </div>
          </div>
      </div>

      {/* MODULE PENERIMAAN BARANG (KHUSUS CABANG) */}
      {role === 'branch' && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4 border-b pb-4">
                  <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Truck size={20}/></div>
                  <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Penerimaan Barang (Inbound)</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Barang sedang dikirim dari Pusat</p></div>
              </div>

              {incomingDO.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <Package size={32} className="mx-auto text-slate-300 mb-2"/>
                      <p className="text-slate-500 font-bold text-sm">Tidak ada barang dalam perjalanan.</p>
                  </div>
              ) : (
                  <div className="space-y-3">
                      {incomingDO.map(doItem => (
                          <div key={doItem.id} className="flex justify-between items-center bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm">
                              <div>
                                  <div className="text-[10px] font-bold text-orange-600 uppercase mb-1">ID Pengiriman: {doItem.id}</div>
                                  <div className="font-black text-slate-800 text-lg">{doItem.qty} PCS DIMSUM</div>
                                  <div className="text-xs font-bold text-slate-600 mt-1">Dikirim Tgl: {formatDate(doItem.date)}</div>
                              </div>
                              <button onClick={() => handleTerimaBarang(doItem)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 transition">
                                  <Download size={18}/> Terima Barang
                              </button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* MODUL INPUT BATCH PRODUKSI (HANYA PUSAT) */}
      {role === 'admin' && (
      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Factory size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Production Batch Engine</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ayam otomatis berkurang, Freezer otomatis bertambah</p></div>
          </div>
          
          <form onSubmit={handleSimpanProduksi} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Eksekusi</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Jml Adukan</label><div className="relative"><input type="number" required placeholder="0" value={adukanQty} onChange={e=>setAdukanQty(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">Adk</span></div></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Ayam Terpakai</label><div className="relative"><input type="number" step="0.1" required placeholder="0" value={ayamUsed} onChange={e=>setAyamUsed(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">KG</span></div></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Hasil Jadi Freezer</label><div className="relative"><input type="number" required placeholder="0" value={resultPcs} onChange={e=>setResultPcs(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-blue-200 rounded-xl font-black text-blue-700 text-sm pr-10" /><span className="absolute right-3 top-2.5 text-xs font-bold text-blue-400">Pcs</span></div></div>
              
              <div className="md:col-span-4 mt-2">
                  <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2">
                      <CheckCircle size={18}/> Eksekusi Batch Produksi
                  </button>
              </div>
          </form>
      </div>
      )}

      {/* TABEL HISTORI BATCH PRODUKSI (HANYA PUSAT) */}
      {role === 'admin' && (
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3">
              <ListChecks size={18} className="text-slate-600"/>
              <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log Produksi Terakhir</h4>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">Batch ID & Tgl</th><th className="px-4 py-3 text-center">Adukan</th><th className="px-4 py-3 text-center">Ayam Terpotong (Out)</th><th className="px-4 py-3 text-center">Dimsum Freezer (In)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBatches.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400 italic">Belum ada batch produksi.</td></tr> : listBatches.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{b.id}</div><div className="text-[10px] text-slate-500">{formatDate(b.date)}</div></td>
                              <td className="px-4 py-3 text-center font-bold text-slate-700">{b.adukan_qty} Adk</td>
                              <td className="px-4 py-3 text-center font-black text-orange-600">-{b.ayam_used} KG</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">+{b.result_pcs} PCS</td>
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
