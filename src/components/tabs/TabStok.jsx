import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Database, CheckCircle, Truck, Download, AlertTriangle } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, distributionOrders, purchases, orders, sendToSheet, role, user }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);

  const [adukanQty, setAdukanQty] = useState('');
  const [ayamUsed, setAyamUsed] = useState('');
  const [additionalCost, setAdditionalCost] = useState('200000');
  const [resultPcs, setResultPcs] = useState('');
  const PCS_PER_MIKA = 50;

  // MODAL DISCREPANCY STATE
  const [receiveModal, setReceiveModal] = useState(null);
  const [formReceive, setFormReceive] = useState({ received: 0, missing: 0, damaged: 0, notes: '' });

  // ... (KODE useMemo stockRealtime dan handleSimpanProduksi TETAP SAMA SEPERTI FASE 7) ...
  const stockRealtime = useMemo(() => {
      let ayamGudang = 0; let frozenStock = 0;
      const myMovements = role === 'admin' ? stockMovements : (stockMovements || []).filter(m => m.branch_id === user.branch_id);
      (myMovements || []).forEach(m => {
          const qty = Number(m.qty) || 0;
          if (role === 'admin' && m.item_name === 'AYAM') { if(m.to_location === 'GUDANG') ayamGudang += qty; if(m.from_location === 'GUDANG') ayamGudang -= qty; }
          const targetFreezer = role === 'admin' ? 'FREEZER_PUSAT' : 'FREEZER_CABANG';
          if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
              if (m.to_location === targetFreezer) frozenStock += qty;
              if (m.from_location === targetFreezer) frozenStock -= qty;
          }
      });
      return { ayamGudang, frozenStock };
  }, [stockMovements, purchases, orders, role, user.branch_id]);

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      const batchId = generateId('BATCH', date);
      const payload = { id: batchId, date: date, adukan_qty: Number(adukanQty), ayam_used: Number(ayamUsed), additional_cost: Number(additionalCost), result_pcs: Number(resultPcs), result_mika: Number(resultPcs) / PCS_PER_MIKA, status: 'SELESAI', branch_id: 'PUSAT' };
      sendToSheet('event_production', payload, 'production_batches');
      alert("Batch Produksi Sukses & HPP Dihitung Server!");
      setAdukanQty(''); setAyamUsed(''); setResultPcs('');
  };

  // ==========================================
  // DISCREPANCY & RECEIVING ENGINE
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
          alert(`TOTAL TIDAK BALANCE!\nYang dikirim pusat: ${receiveModal.qty}\nYang Anda laporkan: ${totalKlaim}\nPastikan jumlah Utuh + Hilang + Rusak sesuai dengan total DO.`);
          return;
      }

      const confirmMsg = `Konfirmasi Penerimaan:\n- Kondisi Baik: ${formReceive.received}\n- Hilang/Kurang: ${formReceive.missing}\n- Rusak: ${formReceive.damaged}\n\nLanjutkan?`;
      if(window.confirm(confirmMsg)) {
          const payload = {
              doId: receiveModal.id, branch_id: user.branch_id, qty_sent: receiveModal.qty,
              qty_received: formReceive.received, qty_missing: formReceive.missing, 
              qty_damaged: formReceive.damaged, notes: formReceive.notes
          };
          
          sendToSheet('event_receive_do', payload, 'system_lifecycle');
          alert("Receiving Protocol & Discrepancy Log tereksekusi di Backend!");
          setReceiveModal(null);
      }
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 relative">
      
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
          </div>
      </div>

      {/* MODULE PENERIMAAN BARANG (KHUSUS CABANG) */}
      {role === 'branch' && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4 border-b pb-4"><div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Truck size={20}/></div><div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Receiving Dashboard</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Truk sedang di perjalanan dari Pusat</p></div></div>

              {incomingDO.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300"><Package size={32} className="mx-auto text-slate-300 mb-2"/><p className="text-slate-500 font-bold text-sm">Tidak ada barang dalam perjalanan.</p></div>
              ) : (
                  <div className="space-y-3">
                      {incomingDO.map(doItem => (
                          <div key={doItem.id} className="flex justify-between items-center bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm">
                              <div><div className="text-[10px] font-bold text-orange-600 uppercase mb-1">Status: DIKIRIM (Menuju Lokasi)</div><div className="font-black text-slate-800 text-lg">{doItem.qty} PCS DIMSUM</div><div className="text-xs font-bold text-slate-600 mt-1">Ref ID: {doItem.id}</div></div>
                              <button onClick={() => openReceiveModal(doItem)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 transition"><Download size={18}/> Buka Form Penerimaan</button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* DISCREPANCY RECEIVING MODAL */}
      {receiveModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-6 border-b pb-4">
                      <div className="flex items-center gap-3"><div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl"><PackageOpen size={24}/></div><div><h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Cek & Terima Barang</h3><p className="text-[10px] font-bold text-slate-500 uppercase">DO: {receiveModal.id}</p></div></div>
                      <div className="text-right"><div className="text-[10px] font-bold text-slate-500 uppercase">Total Kirim Pusat</div><div className="font-black text-2xl text-slate-800">{receiveModal.qty} <span className="text-sm">Pcs</span></div></div>
                  </div>
                  
                  <form onSubmit={executeReceiveDO} className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1"><label className="text-[10px] font-black text-emerald-600 uppercase">Diterima Baik</label><input type="number" required value={formReceive.received} onChange={e=>setFormReceive({...formReceive, received: e.target.value})} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 text-center text-lg" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black text-red-600 uppercase">Barang Kurang</label><input type="number" required value={formReceive.missing} onChange={e=>setFormReceive({...formReceive, missing: e.target.value})} className="w-full p-3 bg-red-50 border border-red-200 rounded-xl font-black text-red-700 text-center text-lg" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black text-orange-600 uppercase">Barang Rusak</label><input type="number" required value={formReceive.damaged} onChange={e=>setFormReceive({...formReceive, damaged: e.target.value})} className="w-full p-3 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 text-center text-lg" /></div>
                      </div>
                      
                      {(Number(formReceive.missing) > 0 || Number(formReceive.damaged) > 0) && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 animate-in fade-in zoom-in">
                              <AlertTriangle size={24} className="text-amber-500 shrink-0"/>
                              <div className="space-y-2 w-full"><div className="text-xs font-bold text-amber-800">Terdapat Selisih (Discrepancy) sejumlah {Number(formReceive.missing) + Number(formReceive.damaged)} Pcs. Barang ini akan masuk ke daftar WASTE. Wajib sertakan alasan!</div><textarea required placeholder="Tulis alasan hilang/rusak..." value={formReceive.notes} onChange={e=>setFormReceive({...formReceive, notes: e.target.value})} className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg outline-none font-medium resize-none" rows="2"></textarea></div>
                          </div>
                      )}

                      <div className="flex gap-3 pt-4 border-t">
                          <button type="button" onClick={() => setReceiveModal(null)} className="w-1/3 bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition">Batal</button>
                          <button type="submit" className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2"><CheckCircle size={18}/> Konfirmasi & Update Stok</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* ... (MODUL PRODUKSI PUSAT SAMA SEPERTI FASE 7) ... */}
    </div>
  );
}
