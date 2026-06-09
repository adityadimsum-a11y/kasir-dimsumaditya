import React, { useState } from 'react';
import { Truck, Send, Package, MapPin, CheckCircle, Clock, ShieldCheck } from 'lucide-react';
import { getTodayStr, generateId } from '../../utils/helpers';

export default function TabDistribusi({ master_branches, distribution_orders, sendToSheet, user, showToast }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'UNKNOWN';
  const isHQ = user?.branch_type === 'HQ_FACTORY';

  const [form, setForm] = useState({ date: todayStr, to_branch: '', item_name: 'DIMSUM', qty: '', driver: '' });

  // Filter DO: Pusat melihat semua, Cabang hanya melihat yang dikirim ke mereka
  const visibleDO = (distribution_orders || [])
    .filter(doItem => !doItem.isDeleted)
    .filter(doItem => isHQ ? true : String(doItem.to_branch).toUpperCase() === currentBranch.toUpperCase())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Fungsi PUSAT: Kirim Barang
  const handleSendDO = async (e) => {
    e.preventDefault();
    if (!form.to_branch) { showToast('Pilih cabang tujuan!', 'error'); return; }
    
    if (!window.confirm(`Kirim ${form.qty} Pcs ${form.item_name} ke ${form.to_branch}?\nStok Pusat akan otomatis dipotong.`)) return;

    const payload = {
      do_id: generateId('DO', form.date),
      date: form.date,
      to_branch: form.to_branch,
      item_name: form.item_name,
      qty: Number(form.qty),
      driver: form.driver || 'Kurir Internal'
    };

    const ok = await sendToSheet('event_create_do', payload, 'auto');
    if (ok) {
      showToast('Surat Jalan sukses! Barang dalam perjalanan.', 'success');
      setForm({ ...form, to_branch: '', qty: '', driver: '' });
      window.location.reload();
    }
  };

  // Fungsi CABANG: Terima Barang
  const handleReceiveDO = async (doItem) => {
    if (!window.confirm(`Konfirmasi Terima Barang\n\nApakah fisik ${doItem.qty} Pcs ${doItem.item_name} sudah Anda terima dengan baik?`)) return;

    const payload = {
      do_id: doItem.id,
      item_name: doItem.item_name,
      qty: doItem.qty,
      receiver_name: user?.name || 'Staff Cabang'
    };

    const ok = await sendToSheet('event_receive_do', payload, 'auto');
    if (ok) {
      showToast('Barang diterima! Stok cabang otomatis bertambah.', 'success');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase flex items-center justify-center md:justify-start gap-3">
            <Truck className="text-indigo-400" /> Distribusi Global (Surat Jalan)
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
            {isHQ ? 'Pusat Kendali Pengiriman Logistik' : `Penerimaan Logistik - Node: ${currentBranch}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL KIRI: FORM PENGIRIMAN (HANYA MUNCUL DI PUSAT) */}
        <div className="lg:col-span-1">
          {isHQ ? (
            <div className="bg-white rounded-3xl border border-indigo-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center gap-2">
                <Send size={16} className="text-indigo-600"/>
                <h3 className="font-black text-indigo-900 text-xs uppercase tracking-widest">Buat Surat Jalan Baru</h3>
              </div>
              <form onSubmit={handleSendDO} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Cabang Tujuan</label>
                  <select required value={form.to_branch} onChange={e=>setForm({...form, to_branch: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold mt-1 outline-none">
                    <option value="">-- Pilih Cabang --</option>
                    {(master_branches || []).filter(b => b.branch_type !== 'HQ_FACTORY').map(b => (
                      <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Barang Dikirim</label>
                  <select value={form.item_name} onChange={e=>setForm({...form, item_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold mt-1 outline-none">
                    <option value="DIMSUM">DIMSUM FROZEN (Pcs)</option>
                    <option value="AYAM">DAGING AYAM (Kg)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Jumlah (Kuantitas)</label>
                  <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border rounded-xl font-black text-slate-800 mt-1 outline-none" placeholder="Cth: 1000" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Kurir / Supir</label>
                  <input type="text" value={form.driver} onChange={e=>setForm({...form, driver: e.target.value})} className="w-full p-3 border rounded-xl text-sm font-bold mt-1 outline-none" placeholder="Cth: Pak Budi" />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs flex justify-center items-center gap-2 mt-2 shadow-lg transition">
                  <Truck size={16}/> Kirim Barang Sekarang
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
              <ShieldCheck size={48} className="text-slate-300 mb-4" />
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest mb-2">Akses Terbatas</h3>
              <p className="text-xs font-bold text-slate-500">Hanya Pusat yang dapat membuat Surat Jalan pengiriman. Tugas cabang adalah menerima kedatangan fisik barang.</p>
            </div>
          )}
        </div>

        {/* PANEL KANAN: LIST SURAT JALAN */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
             <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
                <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2"><MapPin size={16} className="text-blue-600"/> Tracking Logistik Inter-Node</h4>
             </div>
             <div className="overflow-x-auto flex-1 p-2">
                <table className="w-full text-sm text-left">
                   <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Tgl & DO ID</th>
                        <th className="px-6 py-4">Tujuan</th>
                        <th className="px-6 py-4 text-center">Isi Muatan</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Aksi Cabang</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-xs font-bold">
                      {visibleDO.length === 0 ? (
                          <tr><td colSpan="5" className="text-center py-12 text-slate-400"><Package size={32} className="mx-auto mb-2 opacity-20"/>Belum ada aktivitas distribusi terdeteksi.</td></tr>
                      ) : (
                          visibleDO.map(doItem => (
                             <tr key={doItem.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4">
                                  <div className="text-slate-800">{doItem.date}</div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{doItem.id}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-black uppercase text-indigo-700">{doItem.to_branch}</div>
                                  <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">Oleh: {doItem.driver}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="font-black text-slate-800">{doItem.qty} <span className="text-[9px] text-slate-500">{doItem.item_name === 'AYAM' ? 'KG' : 'PCS'}</span></div>
                                  <div className="text-[9px] font-bold text-slate-500 mt-0.5">{doItem.item_name}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {doItem.status === 'DELIVERING' ? (
                                      <span className="flex items-center justify-center gap-1 text-orange-600 text-[9px] uppercase tracking-wider bg-orange-50 px-2 py-1 rounded-lg w-max mx-auto border border-orange-200"><Clock size={12} /> Di Jalan</span>
                                  ) : (
                                      <span className="flex items-center justify-center gap-1 text-emerald-600 text-[9px] uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-lg w-max mx-auto border border-emerald-200"><CheckCircle size={12} /> Diterima</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {doItem.status === 'DELIVERING' && !isHQ ? (
                                      <button onClick={() => handleReceiveDO(doItem)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition">Terima Fisik</button>
                                  ) : (
                                      <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{doItem.status === 'RECEIVED' ? 'Selesai' : '-'}</span>
                                  )}
                                </td>
                             </tr>
                          ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
