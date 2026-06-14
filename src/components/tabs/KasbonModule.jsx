import React, { useState, useMemo } from 'react';
import { ShoppingCart, Banknote, Link, History, Printer, Edit2, Trash2 } from 'lucide-react';

// 🔥 FIX JALUR KABEL PRINTER: Cukup mundur 2 langkah (../../)
import { triggerPrint } from '../../utils/PrintUtility';

// --- HELPER LOKAL ANTI-CRASH ---
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const generateId = (prefix, dateStr) => {
  const dStr = dateStr ? dateStr.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dStr}-${randomPart}`;
};

export default function KasbonModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds }) {
  const [activeTabKasbon, setActiveTabKasbon] = useState('KREDIT'); 
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', date: todayStr, employeeId: '', amount: '', notes: '', tenor: '1', foto_url: '' });
  
  const historyKasbonLog = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && !optimisticDeletedIds.has(e.id) && ['KASBON', 'KREDIT_BARANG'].includes(e.category) && (targetBId === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === targetBId)).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch, optimisticDeletedIds]);

  const handleEdit = (log) => {
    const isKredit = log.category === 'KREDIT_BARANG'; setActiveTabKasbon(isKredit ? 'KREDIT' : 'TUNAI');
    setForm({ id: log.id, date: log.date.split('T')[0], employeeId: log.employee_id, amount: String(log.amount || 0), notes: log.description || '', tenor: String(log.tenor || 1), foto_url: log.foto_url || '' });
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin menghapus secara permanen data hutang kredit/kasbon ini?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id)); const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { if(showToast) showToast('Data hutang sukses divoid.', 'success'); } else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={`p-6 rounded-3xl border transition-all duration-300 h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'}`}>
        <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/60">
          <button type="button" disabled={isEditing} onClick={()=>setActiveTabKasbon('KREDIT')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTabKasbon==='KREDIT' ? 'bg-white shadow-md text-blue-600 scale-105' : 'text-slate-500 hover:text-slate-800'} disabled:opacity-50`}>Kredit Barang Fisik</button>
          <button type="button" disabled={isEditing} onClick={()=>setActiveTabKasbon('TUNAI')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTabKasbon==='TUNAI' ? 'bg-white shadow-md text-orange-600 scale-105' : 'text-slate-500 hover:text-slate-800'} disabled:opacity-50`}>Kasbon Uang Tunai</button>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; 
          const isKredit = activeTabKasbon === 'KREDIT'; const expenseId = isEditing ? form.id : generateId(isKredit ? 'KRD' : 'KSB', form.date);
          const empData = globalCompiled[form.employeeId]; const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? empData?.branch_id : activeBranch;
          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, employee_id: form.employeeId, category: isKredit ? 'KREDIT_BARANG' : 'KASBON', amount: Number(form.amount), description: form.notes.toUpperCase() };
          if (isKredit) { payload.tenor = Number(form.tenor); payload.foto_url = form.foto_url; }

          let success = false;
          if(isEditing) { success = await sendToSheet('update', payload, 'expenses'); } else { success = await sendToSheet('insert', payload, 'expenses'); }
          if (success) {
            if (!isKredit && !isEditing) await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: penempatanTrx, type: 'OUT', category: 'KASBON KARYAWAN', amount: Number(form.amount), method: 'CASH', reference_id: expenseId, description: `Pencairan Kasbon Tunai Laci Kasir Staf: ${empData?.name}` }, 'cashflow_transactions');
            setForm({ id: '', date: todayStr, employeeId: '', amount: '', notes: '', tenor: '1', foto_url: '' }); setIsEditing(false);
            if (showToast) showToast(`Transaksi pengajuan ${isKredit ? 'Kredit Barang' : 'Kasbon Tunai'} berhasil dicatat dan disahkan.`, 'success');
          }
        }} className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-xs uppercase text-slate-800 tracking-wider flex items-center gap-2">{activeTabKasbon === 'KREDIT' ? <ShoppingCart size={16} className={isEditing ? "text-amber-500" : "text-blue-500"}/> : <Banknote size={16} className={isEditing ? "text-amber-500" : "text-orange-500"}/>} {isEditing ? 'Edit Lembar Pengajuan' : `Form Pengajuan Baru ${activeTabKasbon}`}</h3>{isEditing && <button type="button" onClick={() => { setIsEditing(false); setForm({ id: '', date: todayStr, employeeId: '', amount: '', notes: '', tenor: '1', foto_url: '' }); }} className="text-[10px] border border-slate-200 px-3 py-1.5 rounded-lg font-black uppercase text-slate-500 bg-white shadow-sm hover:bg-slate-50 transition-colors tracking-widest">Batal Edit</button>}</div>
          
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Identitas Staf Peminjam / Kreditur</label>
            <select required disabled={isEditing} value={form.employeeId} onChange={e=>setForm({...form, employeeId: e.target.value})} className={`w-full p-3 border rounded-xl font-black text-xs uppercase outline-none cursor-pointer ${isEditing ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 focus:bg-white shadow-sm border-slate-200 focus:border-blue-400'}`}><option value="">-- Pilih Staf Peminjam --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace('_', ' ')}) - CAB {k.branch_id}</option>)}</select>
          </div>
          
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${activeTabKasbon === 'KREDIT' ? 'text-blue-600' : 'text-orange-600'}`}>{activeTabKasbon === 'KREDIT' ? 'Harga Total Barang Pokok (Bukan Cicilan)' : 'Nominal Tarik Tunai Uang Laci'}</label>
            <input type="text" required value={formatRupiah(form.amount)} onChange={e=>setForm({...form, amount: e.target.value.replace(/\D/g, '')})} className={`w-full p-3.5 bg-slate-50 border rounded-2xl font-black text-lg outline-none transition-colors ${activeTabKasbon === 'KREDIT' ? 'focus:border-blue-400 text-blue-900 border-blue-200 focus:bg-white' : 'focus:border-orange-400 text-orange-900 border-orange-200 focus:bg-white'}`} placeholder="Rp 0" />
          </div>
          
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{activeTabKasbon === 'KREDIT' ? 'Nama Barang Fisik (Misal: HP SAMSUNG A55)' : 'Keterangan Kebutuhan (Misal: Bayar Kontrakan)'}</label>
            <input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className={`w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white transition-colors ${activeTabKasbon === 'KREDIT' ? 'focus:border-blue-400' : 'focus:border-orange-400'}`} placeholder="Ketik rincian sedetail mungkin..." />
          </div>
          
          {activeTabKasbon === 'KREDIT' && (
            <div className="space-y-4 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl shadow-inner mt-4">
              <div><label className="text-[10px] font-black text-blue-800 uppercase flex justify-between tracking-widest mb-1.5 border-b border-blue-100 pb-2"><span>Tenor Angsuran (Bulan)</span><span>Estimasi Auto-Potong: {formatRupiah((Number(form.amount || 0) / Number(form.tenor || 1)))}/Bln</span></label><input type="number" min="1" max="24" required value={form.tenor} onChange={e=>setForm({...form, tenor: e.target.value})} className="w-full p-3.5 border border-blue-200 rounded-xl text-base font-black text-center text-blue-900 outline-none focus:bg-white focus:border-blue-400 shadow-sm transition-colors" /></div>
              <div><label className="text-[10px] font-black text-blue-800 uppercase flex items-center gap-1.5 mb-1.5 tracking-widest"><Link size={12}/> Link Bukti Foto Barang (Google Drive)</label><input type="text" required value={form.foto_url} onChange={e=>setForm({...form, foto_url: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-400 transition-colors" placeholder="Paste link URL foto produk dari Google Drive di sini..." /></div>
            </div>
          )}
          
          <button type="submit" className={`w-full text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 mt-4 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : (activeTabKasbon === 'KREDIT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700')}`}>{isEditing ? '💾 Update Data Transaksi' : `Simpan Dokumen Pengajuan ${activeTabKasbon}`}</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><History size={16} className="text-orange-500"/> Buku Hutang &amp; Kredit Aktif Berjalan ({activeBranch === 'SEMUA_CABANG' ? 'SKALA NASIONAL' : `AREA ${activeBranch.replace('_', ' ')}`})</div>
        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">Waktu Nota &amp; ID</th><th className="px-5 py-3 font-black">Karyawan / Peminjam</th><th className="px-5 py-3 font-black">Keterangan Dokumen Pinjaman</th><th className="px-5 py-3 font-black text-right">Nilai Nominal Awal</th><th className="px-5 py-3 font-black text-center">Aksi Operasional</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historyKasbonLog.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-24 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Bersih Total! Tidak ada riwayat pengajuan pinjaman/kasbon berjalan.</td></tr>
              ) : (
                historyKasbonLog.map(log => {
                  const emp = globalCompiled[log.employee_id]; const isKredit = log.category === 'KREDIT_BARANG';
                  return (
                    <tr key={log.id} className="hover:bg-orange-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 font-bold mt-1">{log.id}</div></td>
                      <td onClick={() => emp && onViewDetails(emp)} className="px-5 py-4 flex items-center gap-3 cursor-pointer">
                        <img src={emp?.photo_url} alt="Profile" className="w-10 h-10 rounded-xl object-cover border shadow-sm group-hover:scale-105 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                        <div><span className="uppercase font-black text-slate-800 group-hover:text-blue-600 transition-colors block tracking-wide">{emp?.name || 'STAF KARYAWAN'}</span>{activeBranch === 'SEMUA_CABANG' && <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mt-1 block">LOKASI CABANG: {emp?.branch_id.replace('_', ' ')}</span>}</div>
                      </td>
                      <td className="px-5 py-4 min-w-[220px]">
                        <span className={`px-2.5 py-1 text-[8px] font-black uppercase rounded-md border tracking-wider shadow-sm inline-block mb-2 ${isKredit ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{isKredit ? 'KREDIT BARANG INVENTARIS' : 'KASBON UANG TUNAI LACI'}</span>
                        <div className="text-slate-700 text-[11px] font-bold uppercase line-clamp-2 leading-relaxed">"{log.description}"</div>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-800 font-black text-sm whitespace-nowrap">{formatRupiah(log.amount)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                            title: isKredit ? 'SLIP BUKTI PERSETUJUAN KREDIT BARANG' : 'SLIP BUKTI PENCAIRAN KASBON TUNAI', id: log.id, date: formatDate(log.date), periode: formatDate(log.date).substring(3),
                            branch_name: emp?.branch_id || activeBranch, admin_name: user?.name || 'ADMIN HRD', customer_name: emp?.name || 'STAF KARYAWAN', position: emp?.position.replace('_', ' ') || 'STAF',
                            items: [{ name: `${log.description}`, qty: 1, subtotal: log.amount }], amount: log.amount, paymentMethod: isKredit ? 'SISTEM AUTO-POTONG GAJI (NON-CASH)' : 'DARI UANG FISIK CASH LACI KASIR',
                            history: { kasbonList: [{ ...log, status: 'BARU DIAJUKAN', sisa: log.amount, cicilanKe: 0 }], labelLama: 'Akumulasi Sisa Hutang / Kredit Aktif Sebelumnya', nominalLama: Math.max(0, (emp?.sisaHutang || 0) - log.amount), labelAksi: 'Penambahan Limit Kasbon / Kredit Baru Hari Ini', nominalAksi: log.amount, labelBaru: 'TOTAL HUTANG / KREDIT BERJALAN SAAT INI', nominalBaru: emp?.sisaHutang || 0 }
                          })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Cetak Surat Perjanjian Hutang"><Printer size={16}/></button>
                          
                          {isHQ && (<><button type="button" onClick={() => handleEdit(log)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Edit Data Pengajuan"><Edit2 size={16}/></button><button type="button" onClick={() => handleDelete(log.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Batalkan/Void Pengajuan Pinjaman"><Trash2 size={16}/></button></>)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
