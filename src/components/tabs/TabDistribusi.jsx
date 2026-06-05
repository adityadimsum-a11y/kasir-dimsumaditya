import React, { useState, useMemo } from 'react';
import { Send, Package, Truck, Clock, MapPin, Printer } from 'lucide-react';
import { generateId, getTodayStr, formatDate } from '../../utils/helpers';

export default function TabDistribusi({ distributionOrders, stockMovements, masterBranches, sendToSheet, setPrintData }) {
  const todayStr = getTodayStr();
  const [form, setForm] = useState({ date: todayStr, to_branch: '', qty: '' });

  const PCS_PER_MIKA = 50;
  const PCS_PER_PORSI = 4;

  // ==========================================
  // CALCULATE STOK FREEZER PUSAT (REALTIME)
  // ==========================================
  const stockRealtime = useMemo(() => {
      let frozenStock = 0;
      (stockMovements || []).forEach(m => {
          const qty = Number(m.qty) || 0;
          if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
              if (m.to_location === 'FREEZER_PUSAT') frozenStock += qty;
              if (m.from_location === 'FREEZER_PUSAT') frozenStock -= qty;
          }
      });
      return frozenStock;
  }, [stockMovements]);

  // ==========================================
  // EKSEKUSI PENGIRIMAN
  // ==========================================
  const handleSubmit = (e) => {
    e.preventDefault();

    // HARD LOCK: Cegah minus stok!
    if (Number(form.qty) > stockRealtime) {
        alert(`⛔ PENGIRIMAN DITOLAK!\n\nStok Freezer Pusat tidak mencukupi.\nAnda mencoba mengirim ${Number(form.qty).toLocaleString('id-ID')} Pcs, sementara stok hanya tersisa ${stockRealtime.toLocaleString('id-ID')} Pcs.`);
        return;
    }

    const doId = generateId('DO', form.date);
    
    // 1. Buat Surat Jalan (DO)
    const payloadDO = {
      id: doId, date: form.date, from_branch: 'PUSAT', to_branch: form.to_branch,
      item_name: 'DIMSUM FROZEN', qty: Number(form.qty), status: 'DIKIRIM', branch_id: 'PUSAT'
    };

    // 2. Potong Stok Freezer & Pindahkan ke Status "Di Perjalanan / Reserved"
    const payloadMovement = {
      id: 'MOV-RES-' + doId, date: form.date, item_name: 'DIMSUM',
      from_location: 'FREEZER_PUSAT', to_location: 'RESERVED_DELIVERY',
      qty: Number(form.qty), unit: 'PCS', movement_type: 'RESERVATION', branch_id: 'PUSAT', reference_id: doId
    };

    // Tembak berbarengan
    sendToSheet('insert', payloadDO, 'distribution_orders');
    sendToSheet('insert', payloadMovement, 'stock_movements');

    setForm({ ...form, to_branch: '', qty: '' });
  };

  const activeBranches = (masterBranches || []).filter(b => b.branch_id !== 'PUSAT');
  const listDO = (distributionOrders || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* WIDGET STOK FREEZER PUSAT */}
      <div className="bg-blue-900 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-800">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} className="text-white"/></div>
          <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">STOK FREEZER PUSAT (SIAP KIRIM)</h3>
          <div className="text-4xl font-black text-white">{stockRealtime.toLocaleString('id-ID')} <span className="text-sm text-cyan-300">PCS</span></div>
          <div className="mt-4 pt-4 border-t border-blue-800/50 flex gap-6">
              <div>
                <div className="text-[10px] text-blue-400 uppercase font-bold">Total Pack ({PCS_PER_MIKA} Pcs)</div>
                <div className="font-bold text-emerald-300">{(stockRealtime / PCS_PER_MIKA).toLocaleString('id-ID')} Mika</div>
              </div>
              <div>
                <div className="text-[10px] text-blue-400 uppercase font-bold">Total Porsi ({PCS_PER_PORSI} Pcs)</div>
                <div className="font-bold text-blue-200">{(stockRealtime / PCS_PER_PORSI).toLocaleString('id-ID')} Porsi</div>
              </div>
          </div>
      </div>

      {/* FORM BUAT DO */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Send size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Delivery Order (Manual)</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Barang akan masuk status perjalanan & stok di-reserve</p></div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pengiriman</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Cabang Tujuan</label>
                      <select required value={form.to_branch} onChange={e=>setForm({...form, to_branch: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm text-slate-700">
                          <option value="">-- Pilih Cabang --</option>
                          {activeBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name} ({b.branch_type})</option>)}
                      </select>
                  </div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-600 uppercase">Jumlah Kirim (Pcs)</label><div className="relative"><input type="number" required placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700" /><span className="absolute right-4 top-3.5 text-xs font-bold text-blue-400">Pcs</span></div></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"><Package size={18}/> Submit DO ke Tim Ekspedisi</button>
          </form>
      </div>

      {/* TABEL TRACKER */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3"><Clock size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Distribution Lifecycle Tracker</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">ID DO & Tgl</th><th className="px-4 py-3">Tujuan</th><th className="px-4 py-3 text-center">Qty (Pcs)</th><th className="px-4 py-3 text-center">Lifecycle Status</th><th className="px-4 py-3 text-right">Aksi Gudang</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listDO.map(d => {
                          const isSent = d.status === 'DIKIRIM';
                          return (
                          <tr key={d.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{d.id}</div><div className="text-[10px] text-slate-500">{formatDate(d.date)}</div></td>
                              <td className="px-4 py-3 font-black text-slate-800 text-xs flex items-center gap-2"><MapPin size={12} className="text-slate-400"/> CABANG {d.to_branch}</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">{Number(d.qty).toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-center">
                                  {isSent ? <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 w-max mx-auto"><Truck size={12}/> DI PERJALANAN</span>
                                          : <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase w-max mx-auto inline-block">RECEIVED (DITERIMA)</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                  {/* Print DO Placeholder (Nanti Diaktifkan di Phase Cetak) */}
                                  <button onClick={() => alert('Fitur Print akan diaktifkan di UAT Phase Print.')} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition" title="Print Surat Jalan"><Printer size={16}/></button>
                              </td>
                          </tr>
                      )})}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
