import React, { useState, useMemo } from 'react';
import { Package, Factory, ListChecks, Database, CheckCircle, Truck, Download, AlertTriangle } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStok({ stockMovements, productionBatches, distributionOrders, purchases, orders, sendToSheet, role, user }) {
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

  // ==========================================
  // OTO-OTORISASI HYBRID (NEW LOGIC)
  // ==========================================
  const isSuperAdmin = role === 'super_admin';
  // Siapa yang boleh lihat & pakai mesin pabrik? Super Admin ATAU Cabang Pemalang
  const canProduce = isSuperAdmin || user.branch_id === 'PEMALANG';
  // Siapa yang butuh form terima DO? Semua cabang yang BUKAN pusat utama
  const isCabang = user.branch_id !== 'PUSAT';

  const stockRealtime = useMemo(() => {
      let ayamGudang = 0;
      let frozenStock = 0;

      // Filter Data Berdasarkan Identitas
      const myMovements = (stockMovements || []).filter(m => {
          if (isSuperAdmin) return m.branch_id === 'PUSAT';
          return m.branch_id === user.branch_id;
      });

      myMovements.forEach(m => {
          const qty = Number(m.qty) || 0;
          
          // Hitung Ayam Mentah (Hanya untuk yang punya otorisasi Pabrik)
          if (canProduce && m.item_name === 'AYAM') {
              if (m.to_location === 'GUDANG') ayamGudang += qty;
              if (m.from_location === 'GUDANG') ayamGudang -= qty;
          }
          
          // Hitung Freezer (Super Admin hitung PUSAT, Cabang hitung FREEZER CABANG masing-masing)
          const targetFreezer = isSuperAdmin ? 'FREEZER_PUSAT' : 'FREEZER_CABANG';
          if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
              if (m.to_location === targetFreezer) frozenStock += qty;
              if (m.from_location === targetFreezer) frozenStock -= qty;
          }
      });

      return { ayamGudang, frozenStock };
  }, [stockMovements, isSuperAdmin, canProduce, user.branch_id]);

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

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      // ALERT PENGAMAN SEMENTARA UNTUK UAT
      if (!isSuperAdmin) {
          alert('🚨 PERHATIAN BAPAK CTO:\n\nUI Pabrik untuk Pemalang sudah terbuka, tapi untuk UAT saat ini Backend masih mengunci HPP di Gudang Pusat. Jangan klik eksekusi produksi dulu ya! Kita selesaikan UAT Terima DO dulu!');
          return;
      }

      const batchId = generateId('BATCH', date);
      const payload = { 
          id: batchId, date: date, 
          adukan_qty: Number(adukanQty), ayam_used: Number(ayamUsed), 
          additional_cost: Number(additionalCost), result_pcs: Number(resultPcs), 
          result_mika: Number(resultPcs) / PCS_PER_MIKA, 
          status: 'SELESAI', branch_id: 'PUSAT' 
      };
      sendToSheet('event_production', payload, 'production_batches');
      setAdukanQty(''); setAyamUsed(''); setResultPcs(''); setAdditionalCost('0');
  };

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
          setReceiveModal(null);
      }
  };

  const listBatches = (productionBatches || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 relative">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canProduce && (
          <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Database size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">STOK GUDANG AYAM</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.ayamGudang.toLocaleString('id-ID')} <span className="text-sm text-orange-400">KG</span></div>
              <div className="mt-4 pt-4 border-t border-slate-800/50 flex gap-4">
                 <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Total Kantong ({KG_PER_KANTONG} KG)</div>
                    <div className="font-bold text-orange-300">{(stockRealtime.ayamGudang / KG_PER_KANTONG).toLocaleString('id-ID')} Kantong</div>
                 </div>
              </div>
          </div>
          )}
          
          <div className="bg-blue-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-800">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} className="text-white"/></div>
              <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">STOK FREEZER {isSuperAdmin ? 'PUSAT' : user.branch_id}</h3>
              <div className="text-4xl font-black text-white">{stockRealtime.frozenStock.toLocaleString('id-ID')} <span className="text-sm text-cyan-300">PCS</span></div>
              <div className="mt-4 pt-4 border-t border-blue-800/50 flex gap-6">
                 <div>
                    <div className="text-[10px] text-blue-400 uppercase font-bold">Total Pack ({PCS_PER_MIKA} Pcs)</div>
                    <div className="font-bold text-emerald-300">{(stockRealtime.frozenStock / PCS_PER_MIKA).toLocaleString('id-ID')} Mika</div>
                 </div>
                 <div>
                    <div className="text-[10px] text-blue-400 uppercase font-bold">Total Porsi ({PCS_PER_PORSI} Pcs)</div>
                    <div className="font-bold text-blue-200">{(stockRealtime.frozenStock / PCS_PER_PORSI).toLocaleString('id-ID')} Porsi</div>
                 </div>
              </div>
          </div>
      </div>

      {isCabang && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4 border-b pb-4">
                  <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Truck size={20}/></div>
                  <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Receiving Dashboard</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Truk sedang di perjalanan dari Pusat</p></div>
              </div>

              {incomingDO.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <Package size={32} className="mx-auto text-slate-300 mb-2"/>
                      <p className="text-slate-500 font-bold text-sm">Tidak ada barang dalam perjalanan.</p>
                  </div>
              ) : (
                  <div className="space-y-3">
                      {incomingDO.map(doItem => (
                          <div key={doItem.id} className="flex justify-between items-center bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm border-l-4 border-l-orange-500">
                              <div>
                                  <div className="text-[10px] font-bold text-orange-600 uppercase mb-1">Status: DIKIRIM (Menuju Lokasi)</div>
                                  <div className="font-black text-slate-800 text-lg">{Number(doItem.qty).toLocaleString('id-ID')} PCS DIMSUM</div>
                                  <div className="text-xs font-bold text-slate-600 mt-1">Ref ID: {doItem.id}</div>
                              </div>
                              <button onClick={() => openReceiveModal(doItem)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 transition animate-pulse">
                                  <Download size={18}/> Buka Form Penerimaan
                              </button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {receiveModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-6 border-b pb-4">
                      <div className="flex items-center gap-3"><div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl"><Package size={24}/></div><div><h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Cek & Terima Barang</h3><p className="text-[10px] font-bold text-slate-500 uppercase">DO: {receiveModal.id}</p></div></div>
                      <div className="text-right"><div className="text-[10px] font-bold text-slate-500 uppercase">Total Kirim Pusat</div><div className="font-black text-2xl text-slate-800">{Number(receiveModal.qty).toLocaleString('id-ID')} <span className="text-sm">Pcs</span></div></div>
                  </div>
                  
                  <form onSubmit={executeReceiveDO} className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1"><label className="text-[10px] font-black text-emerald-600 uppercase">Diterima Baik</label><input type="number" required value={formReceive.received} onChange={e=>setFormReceive({...formReceive, received: e.target.value})} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 text-center text-lg outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black text-red-600 uppercase">Hilang / Kurang</label><input type="number" required value={formReceive.missing} onChange={e=>setFormReceive({...formReceive, missing: e.target.value})} className="w-full p-3 bg-red-50 border border-red-200 rounded-xl font-black text-red-700 text-center text-lg outline-none focus:ring-2 focus:ring-red-500" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black text-orange-600 uppercase">Rusak (Waste)</label><input type="number" required value={formReceive.damaged} onChange={e=>setFormReceive({...formReceive, damaged: e.target.value})} className="w-full p-3 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 text-center text-lg outline-none focus:ring-2 focus:ring-orange-500" /></div>
                      </div>
                      
                      {(Number(formReceive.missing) > 0 || Number(formReceive.damaged) > 0) && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 animate-in fade-in zoom-in">
                              <AlertTriangle size={24} className="text-amber-500 shrink-0"/>
                              <div className="space-y-2 w-full"><div className="text-xs font-bold text-amber-800">Terdapat Selisih sejumlah {Number(formReceive.missing) + Number(formReceive.damaged)} Pcs. Wajib sertakan alasan!</div><textarea required placeholder="Tulis alasan..." value={formReceive.notes} onChange={e=>setFormReceive({...formReceive, notes: e.target.value})} className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg outline-none font-medium resize-none" rows="2"></textarea></div>
                          </div>
                      )}

                      <div className="flex gap-3 pt-4 border-t">
                          <button type="button" onClick={() => setReceiveModal(null)} className="w-1/3 bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition">Batal</button>
                          <button type="submit" className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2"><CheckCircle size={18}/> Konfirmasi & Terima</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {canProduce && (
      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-6 border-t-4 border-t-purple-600">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Factory size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Auto-HPP Production Engine</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ketik jumlah adukan, sistem menghitung otomatis berdasarkan Master Data</p></div>
          </div>
          
          <form onSubmit={handleSimpanProduksi} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Eksekusi</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-600 uppercase">Jml Adukan</label><input type="number" required placeholder="0" value={adukanQty} onChange={e=>handleAdukanChange(e.target.value)} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700 text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Ayam Dipakai (KG)</label><input type="text" readOnly placeholder="0" value={ayamUsed ? `${ayamUsed} KG` : ''} className="w-full p-2.5 bg-slate-100 border rounded-xl font-bold text-sm text-slate-500 cursor-not-allowed outline-none" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-purple-600 uppercase">Biaya Bumbu (Auto)</label><input type="text" readOnly value={additionalCost !== '0' ? formatRp(additionalCost) : ''} className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl font-black text-sm text-purple-800 outline-none cursor-not-allowed" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Hasil Jadi (Pcs)</label><input type="text" readOnly placeholder="0" value={resultPcs ? `${Number(resultPcs).toLocaleString('id-ID')} Pcs` : ''} className="w-full p-2.5 bg-slate-100 border rounded-xl font-black text-slate-500 text-sm cursor-not-allowed outline-none" /></div>
              
              <div className="md:col-span-5 mt-2">
                  <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2 ${isSuperAdmin ? 'bg-slate-800 hover:bg-slate-900' : 'bg-slate-400 cursor-not-allowed'}`}>
                      <CheckCircle size={18}/> {isSuperAdmin ? 'Eksekusi & Potong Stok Ayam (FIFO)' : 'Mode Pabrik Pusat Only'}
                  </button>
              </div>
          </form>
      </div>
      )}

      {isSuperAdmin && (
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
                              <td className="px-4 py-3 text-center font-black text-orange-600">-{Number(b.ayam_used).toLocaleString('id-ID')} KG AYAM</td>
                              <td className="px-4 py-3 text-center">
                                  <div className="font-black text-blue-600">+{Number(b.result_pcs).toLocaleString('id-ID')} PCS</div>
                                  <div className="text-[9px] font-bold text-slate-500 uppercase">({(Number(b.result_pcs) / PCS_PER_MIKA).toLocaleString('id-ID')} Mika)</div>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-800">{b.total_cost ? `Rp ${Number(b.total_cost).toLocaleString('id-ID')}` : '-'}</td>
                              <td className="px-4 py-3 text-center font-black bg-emerald-50 text-emerald-700 border-l border-emerald-100">{b.hpp_per_pcs ? `Rp ${Math.round(b.hpp_per_pcs).toLocaleString('id-ID')}` : 'Menghitung...'}</td>
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
