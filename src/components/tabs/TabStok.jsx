import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Database, CheckCircle, Truck, Download } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, distributionOrders, sendToSheet, user }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  const [adukanQty, setAdukanQty] = useState('');
  const [ayamUsed, setAyamUsed] = useState('');
  const [additionalCost, setAdditionalCost] = useState('0'); 
  const [resultPcs, setResultPcs] = useState('');
  
  // MASTER DATA STANDAR (BOM)
  const AYAM_PER_ADUKAN = 30; 
  const PCS_PER_ADUKAN = 1000; 
  const PCS_PER_PORSI = 4; 
  const PCS_PER_MIKA = 50; 
  const KG_PER_KANTONG = 10; 
  const BIAYA_BUMBU_PER_ADUKAN = 25000; 

  const [receiveModal, setReceiveModal] = useState(null);
  const [formReceive, setFormReceive] = useState({ received: 0, missing: 0, damaged: 0, notes: '' });

  // DYNAMIC NODE CHECKER
  const isHQ = user?.branch_type === 'HQ_FACTORY';
  const isProductionNode = user?.branch_type === 'HQ_FACTORY' || user?.branch_type === 'PRODUCTION_BRANCH';

  // ==========================================
  // CORE ENGINE 1: STOK SEPARATION (DYNAMIC LOCATION)
  // ==========================================
  const stockRealtime = useMemo(() => {
      let ayamGudang = 0;
      let frozenStock = 0;

      // Filter movement hanya untuk branch yang sedang login
      const myMovements = (stockMovements || []).filter(m => m.branch_id === user.branch_id);

      myMovements.forEach(m => {
          const qty = Number(m.qty) || 0;
          const locRaw = `${user.branch_id}_RAW`;
          const locFreezer = `${user.branch_id}_FREEZER`;
          
          if (m.item_name === 'AYAM') {
              if (m.to_location === locRaw || m.to_location === 'GUDANG') ayamGudang += qty;
              if (m.from_location === locRaw || m.from_location === 'GUDANG') ayamGudang -= qty;
          }
          
          if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
              if (m.to_location === locFreezer || m.to_location === 'FREEZER_PUSAT' || m.to_location === 'FREEZER_CABANG') frozenStock += qty;
              if (m.from_location === locFreezer || m.from_location === 'FREEZER_PUSAT' || m.from_location === 'FREEZER_CABANG') frozenStock -= qty;
          }
      });

      return { ayamGudang, frozenStock };
  }, [stockMovements, user.branch_id]);

  // ==========================================
  // AUTO-CALCULATOR ADUKAN ENGINE
  // ==========================================
  const handleAdukanChange = (val) => {
      setAdukanQty(val);
      if (val && Number(val) > 0) {
          setAyamUsed((Number(val) * AYAM_PER_ADUKAN).toString());
          setResultPcs((Number(val) * PCS_PER_ADUKAN).toString());
          setAdditionalCost((Number(val) * BIAYA_BUMBU_PER_ADUKAN).toString()); 
      } else {
          setAyamUsed(''); setResultPcs(''); setAdditionalCost('0');
      }
  };

  // ==========================================
  // CORE ENGINE 2: PRODUCTION BATCH (MULTI-NODE AWARE)
  // ==========================================
  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      const batchId = generateId('BATCH', date);
      
      const payload = { 
          id: batchId, date: date, 
          adukan_qty: Number(adukanQty), ayam_used: Number(ayamUsed), 
          additional_cost: Number(additionalCost), result_pcs: Number(resultPcs), 
          result_mika: Number(resultPcs) / PCS_PER_MIKA, 
          status: 'SELESAI',
          
          // DYNAMIC BRANCH & LOCATION INJECTION
          branch_id: user.branch_id,
          production_branch: user.branch_id,
          production_location_raw: `${user.branch_id}_RAW`,
          production_location_freezer: `${user.branch_id}_FREEZER`
      };

      sendToSheet('event_production', payload, 'system_events');
      setAdukanQty(''); setAyamUsed(''); setResultPcs(''); setAdditionalCost('0');
  };

  // ==========================================
  // CORE ENGINE 3: RECEIVE DO
  // ==========================================
  const incomingDO = (distributionOrders || []).filter(d => d.to_branch === user.branch_id && d.status === 'DIKIRIM');
  
  const openReceiveModal = (doItem) => {
      setReceiveModal(doItem);
      setFormReceive({ received: doItem.qty, missing: 0, damaged: 0, notes: '' });
  };

  const executeReceiveDO = (e) => {
      e.preventDefault();
      const totalKlaim = Number(formReceive.received) + Number(formReceive.missing) + Number(formReceive.damaged);
      
      if (totalKlaim !== Number(receiveModal.qty)) {
          alert(`TOTAL TIDAK BALANCE!\nYang dikirim: ${receiveModal.qty}\nYang Anda laporkan: ${totalKlaim}`);
          return;
      }

      if(window.confirm(`Konfirmasi Penerimaan?\nBaik: ${formReceive.received}\nHilang: ${formReceive.missing}\nRusak: ${formReceive.damaged}`)) {
          const payload = {
              doId: receiveModal.id, branch_id: user.branch_id, qty_sent: receiveModal.qty,
              qty_received: formReceive.received, qty_missing: formReceive.missing, 
              qty_damaged: formReceive.damaged, notes: formReceive.notes,
              destination_location: `${user.branch_id}_FREEZER` // Dynamic receiving location
          };
          sendToSheet('event_receive_do', payload, 'system_events');
          setReceiveModal(null);
      }
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 relative">
      
      {/* SUMMARY REALTIME */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isProductionNode && (
          <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Database size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">STOK GUDANG AYAM ({user.branch_id})</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.ayamGudang.toLocaleString('id-ID')} <span className="text-sm text-orange-400">KG</span></div>
          </div>
          )}
          
          <div className="bg-blue-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">STOK FREEZER ({user.branch_id})</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.frozenStock.toLocaleString('id-ID')} <span className="text-sm text-cyan-300">PCS</span></div>
          </div>
      </div>

      {/* MODULE PENERIMAAN BARANG (DO) */}
      {!isHQ && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4 border-b pb-4">
                  <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Truck size={20}/></div>
                  <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Receiving Dashboard</h3></div>
              </div>
              {incomingDO.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-500 font-bold text-sm">Tidak ada barang dalam perjalanan.</p>
                  </div>
              ) : (
                  <div className="space-y-3">
                      {incomingDO.map(doItem => (
                          <div key={doItem.id} className="flex justify-between items-center bg-orange-50 border p-4 rounded-xl shadow-sm">
                              <div><div className="font-black text-slate-800">{doItem.qty} PCS DIMSUM</div></div>
                              <button onClick={() => openReceiveModal(doItem)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl shadow-md flex items-center gap-2"><Download size={16}/> Terima</button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* DISCREPANCY RECEIVING MODAL */}
      {receiveModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <h3 className="font-black text-lg mb-4 text-slate-800">Form Penerimaan Barang</h3>
                <form onSubmit={executeReceiveDO} className="space-y-4">
                    <div><label className="text-xs font-bold text-emerald-600">Diterima Utuh (Pcs)</label><input type="number" required value={formReceive.received} onChange={e=>setFormReceive({...formReceive, received: e.target.value})} className="w-full p-2 border rounded-lg bg-emerald-50" /></div>
                    <div><label className="text-xs font-bold text-orange-600">Rusak (Pcs)</label><input type="number" required value={formReceive.damaged} onChange={e=>setFormReceive({...formReceive, damaged: e.target.value})} className="w-full p-2 border rounded-lg bg-orange-50" /></div>
                    <div><label className="text-xs font-bold text-red-600">Hilang/Kurang (Pcs)</label><input type="number" required value={formReceive.missing} onChange={e=>setFormReceive({...formReceive, missing: e.target.value})} className="w-full p-2 border rounded-lg bg-red-50" /></div>
                    <div><label className="text-xs font-bold text-slate-600">Catatan Supir/Ekspedisi</label><input type="text" value={formReceive.notes} onChange={e=>setFormReceive({...formReceive, notes: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={()=>setReceiveModal(null)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Batal</button>
                        <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl">Simpan DO</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODUL INPUT BATCH PRODUKSI (HQ & PRODUCTION BRANCH) */}
      {isProductionNode && (
      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-6 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Factory size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Auto-HPP Production Engine</h3></div>
          </div>
          
          <form onSubmit={handleSimpanProduksi} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Eksekusi</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-600 uppercase">Jml Adukan</label><input type="number" required placeholder="0" value={adukanQty} onChange={e=>handleAdukanChange(e.target.value)} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700 text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Ayam Dipakai (KG)</label><input type="text" readOnly placeholder="0" value={ayamUsed ? `${ayamUsed} KG` : ''} className="w-full p-2.5 bg-slate-100 border rounded-xl font-bold text-sm text-slate-500 cursor-not-allowed outline-none" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-purple-600 uppercase">Biaya Bumbu (Auto)</label><input type="text" readOnly value={additionalCost !== '0' ? formatRp(additionalCost) : ''} className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl font-black text-sm text-purple-800 outline-none cursor-not-allowed" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Hasil Jadi (Pcs)</label><input type="text" readOnly placeholder="0" value={resultPcs ? `${Number(resultPcs).toLocaleString('id-ID')} Pcs` : ''} className="w-full p-2.5 bg-slate-100 border rounded-xl font-black text-slate-500 text-sm cursor-not-allowed outline-none" /></div>
              <div className="md:col-span-5 mt-2"><button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2"><CheckCircle size={18}/> Eksekusi & Potong Stok (FIFO)</button></div>
          </form>
      </div>
      )}

      {/* TABEL HISTORI BATCH PRODUKSI */}
      {isProductionNode && (
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3"><ListChecks size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log HPP Produksi Node {user.branch_id}</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">Batch ID & Tgl</th><th className="px-4 py-3 text-center">Bahan Baku Keluar</th><th className="px-4 py-3 text-center">Freezer Masuk</th><th className="px-4 py-3 text-right">Total Biaya</th><th className="px-4 py-3 text-center">HPP/Pcs</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBatches.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{b.id}</div><div className="text-[10px] text-slate-500">{formatDate(b.date)}</div></td>
                              <td className="px-4 py-3 text-center font-black text-orange-600">-{Number(b.ayam_used).toLocaleString('id-ID')} KG</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">+{Number(b.result_pcs).toLocaleString('id-ID')} PCS</td>
                              <td className="px-4 py-3 text-right font-black text-slate-800">{b.total_cost ? `Rp ${Number(b.total_cost).toLocaleString('id-ID')}` : '-'}</td>
                              <td className="px-4 py-3 text-center font-black bg-emerald-50 text-emerald-700">{b.hpp_per_pcs ? `Rp ${Math.round(b.hpp_per_pcs).toLocaleString('id-ID')}` : 'Menghitung...'}</td>
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
