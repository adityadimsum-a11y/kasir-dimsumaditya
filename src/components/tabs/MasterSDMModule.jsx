import React, { useState } from 'react';
import { Users, Link, Database, Eye, Edit2, Trash2 } from 'lucide-react';

// --- HELPER LOKAL ANTI-CRASH ---
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const generateId = (prefix, dateStr) => {
  const dStr = dateStr ? dateStr.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dStr}-${randomPart}`;
};
const parseDriveLink = (url) => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/(.*?)\//);
    if (match && match[1]) { return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`; }
  }
  return url;
};

export default function MasterSDMModule({ employees, branchListId, branchMapName, activeBranch, isHQ, sendToSheet, showToast, onViewDetails, setOptimisticDeletedIds }) {
  const [form, setForm] = useState({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' });
  const [isEditingMode, setIsEditingMode] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleTriggerEditPencil = (k) => {
    setForm({ id: k.id, name: k.name, position: k.position, baseSalary: String(k.baseSalary || 0), targetBranch: k.branch_id, phone: k.phone === '-' ? '' : k.phone, address: k.address === 'ALAMAT BELUM DIISI' ? '' : k.address, photo_url: k.raw_photo_link || '', ktp_url: k.raw_ktp_link || '' });
    setIsEditingMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (showToast) showToast(`DATA SDM STAF ${k.name} SIAP UNTUK DIKOREKSI/EDIT!`, 'success');
  };

  const handleDeleteEmployeeInstantly = async (k) => {
    if (window.confirm(`PERINGATAN KRUSIAL: APAKAH ANDA YAKIN 100% INGIN MENGKARANTINA PROFIL STAF "${k.name}" DARI SISTEM OPERASIONAL?`)) {
      setOptimisticDeletedIds(prev => new Set(prev).add(k.id));
      // 🔥 FIX BUG: Ganti Hard Delete ke Karantina Cerdas (Soft Delete)
      const success = await sendToSheet('update', { id: k.id, isDeleted: true }, 'karyawan');
      if (success) { if (showToast) showToast(`PROFIL STAF SDM ${k.name} TELAH DIKARANTINA DARI SISTEM.`, 'success'); } 
      else { setOptimisticDeletedIds(prev => { const newSet = new Set(prev); newSet.delete(k.id); return newSet; }); if (showToast) showToast('GAGAL MENGKARANTINA KE SERVER.', 'error'); }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 uppercase tracking-wider">
      <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-sm h-max ${isEditingMode ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 border-t-4 border-t-emerald-500'}`}>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.name) return; const penempatan = isHQ ? form.targetBranch : activeBranch;
          const payload = { name: form.name.toUpperCase(), position: form.position, baseSalary: Number(form.baseSalary || 0), branch_id: penempatan, status: 'AKTIF', phone: form.phone || '-', address: form.address || 'ALAMAT BELUM DIISI', photo_url: form.photo_url || '', ktp_url: form.ktp_url || '' };
          let success = false;
          if (isEditingMode && form.id) { payload.id = form.id; success = await sendToSheet('update', payload, 'karyawan'); } else { payload.id = generateId('EMP', todayStr); success = await sendToSheet('insert', payload, 'karyawan'); }
          if (success) { 
            setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); setIsEditingMode(false); 
            if (showToast) showToast(isEditingMode ? 'DATA KARYAWAN SUKSES DIUPDATE!' : 'PENDAFTARAN PEGAWAI BARU BERHASIL DISAHKAN!', 'success');
          }
        }} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-xs uppercase tracking-widest text-slate-800 flex items-center gap-2"><Users size={16} className={isEditingMode ? "text-amber-500" : "text-emerald-500"}/> {isEditingMode ? `🔄 UPDATE FORM PROFIL: ${form.name}` : 'REGISTRASI MASUK PEGAWAI BARU SDM'}</h3>{isEditingMode && <button type="button" onClick={() => { setIsEditingMode(false); setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); }} className="text-[10px] font-black uppercase text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 bg-white shadow-sm hover:bg-slate-50 tracking-widest transition-colors">BATAL UPDATE</button>}</div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">NAMA LENGKAP SESUAI KTP</label><input type="text" required readOnly={isEditingMode} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className={`w-full p-3 border rounded-xl text-xs uppercase tracking-wider font-black outline-none transition-colors ${isEditingMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-slate-50 focus:bg-white focus:border-emerald-400'}`} placeholder="KETIK NAMA LENGKAP..." /></div>
            
            {isHQ && (
              <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">PENEMPATAN NODE KERJA CABANG</label>
                <select disabled={isEditingMode} value={form.targetBranch} onChange={e=>setForm({...form, targetBranch: e.target.value})} className={`w-full p-3 border rounded-xl text-xs uppercase font-black outline-none cursor-pointer transition-colors ${isEditingMode ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 focus:bg-white focus:border-emerald-400'}`}>
                  {branchListId.map(br => <option key={br} value={br}>{branchMapName[br]}</option>)}
                </select>
              </div>
            )}
            
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">POSISI JABATAN STRUKTURAL KERJA</label><select value={form.position} onChange={e=>setForm({...form, position: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-black uppercase outline-none cursor-pointer focus:bg-white focus:border-emerald-400 transition-colors">
               <option value="LEADER_TIM">LEADER TIM / KEPALA KORDINATOR</option>
               <option value="KASIR">KASIR POS / FRONT STAFF</option>
               <option value="DAPUR_RESTO">COOK / DAPUR RESTO CABANG</option>
               <option value="WAITRESS">PRAMUSAJI / WAITRESS JAGA</option>
               <option value="PRODUKSI_PABRIK">STAFF ADONAN PRODUKSI PABRIK PUSAT</option>
               <option value="DRIVER">SUPIR EKSPEDISI LOGISTIK ARMADA</option>
            </select></div>

            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">STANDAR GAJI POKOK MASTER / BULAN</label>
              <div className="relative"><span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span><input type="text" required value={form.baseSalary ? Number(form.baseSalary).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl font-black text-sm outline-none focus:border-emerald-400 focus:bg-white transition-colors tracking-wider" placeholder="0" /></div>
            </div>
          </div>

          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">NO. HANDPHONE / WHATSAPP AKTIF</label><input type="text" required placeholder="CONTOH: 081234567" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:bg-white transition-colors tracking-wider" /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ALAMAT TINGGAL / DOMISILI KTP SAAT INI</label><textarea required rows="2" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider outline-none focus:border-emerald-400 focus:bg-white transition-colors" placeholder="ISI DETAIL ALAMAT JALAN, RT/RW..."></textarea></div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-inner mt-2">
            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Link size={12}/> LINK URL FOTO PROFIL (G-DRIVE)</label><input type="text" placeholder="PASTE LINK URL FOTO WAJAH UNTUK ID CARD..." value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})} className="w-full p-3 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:border-emerald-400 transition-colors" /></div>
            <div><label className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Link size={12}/> LINK URL BERKAS SCAN KTP</label><input type="text" placeholder="PASTE LINK URL SCAN KTP ASLI..." value={form.ktp_url} onChange={e => setForm({...form, ktp_url: e.target.value})} className="w-full p-3 border border-orange-200 bg-orange-50 rounded-xl text-xs outline-none focus:border-orange-400 focus:bg-white transition-colors" /></div>
          </div>

          <button type="submit" className={`w-full text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 mt-4 ${isEditingMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{isEditingMode ? '💾 TERAPKAN & UPDATE PERUBAHAN DATA MASTER' : 'DAFTARKAN FORMULIR PEGAWAI BARU'}</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><Database size={16} className="text-emerald-500"/> BUKU DATABASE KARYAWAN AKTIF &amp; ARSIP LULUS ({activeBranch === 'SEMUA_CABANG' ? 'SKALA NASIONAL' : `AREA ${activeBranch.replace('_', ' ')}`})</div>
        <div className="overflow-x-auto p-2 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">PROFIL KARYAWAN (KLIK UNTUK ARSIP)</th><th className="px-5 py-3 font-black">POSISI JABATAN &amp; STANDAR GAJI MASTER</th><th className="px-5 py-3 font-black text-center">STATUS KEPEGAWAIAN</th><th className="px-5 py-3 font-black text-center">AKSI OPERASIONAL MASTER</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {employees.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">BELUM ADA SATUPUN DATA KARYAWAN TERDAFTAR DI NODE INI.</td></tr>
              ) : (
                employees.map(k => (
                  <tr key={k.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td onClick={() => onViewDetails(k)} className="px-5 py-4 flex items-center gap-4 cursor-pointer">
                      <img src={k.photo_url} alt="Ava Profil" className="w-12 h-12 rounded-2xl object-cover border shadow-sm group-hover:scale-110 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                      <div>
                        <div className="font-black text-slate-800 uppercase tracking-wider group-hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-sm">{k.name} <Eye size={12} className="text-slate-300 inline"/></div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1 font-black">NO WA: {k.phone} {activeBranch === 'SEMUA_CABANG' && <span className="text-slate-500 font-black tracking-widest ml-1 uppercase">| CABANG: {k.branch_id.replace('_', ' ')}</span>}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase w-max mb-1.5 border tracking-wider shadow-sm ${k.position==='LEADER_TIM'?'bg-blue-50 text-blue-700 border-blue-200':'bg-slate-50 text-slate-700 border-slate-200'}`}>{k.position.replace('_', ' ')}</div>
                      <div className="text-slate-800 font-black text-sm tracking-wider">{formatRupiah(k.baseSalary)} / BULAN</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border tracking-wider shadow-sm ${k.status === 'AKTIF' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{k.status}</span>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => handleTriggerEditPencil(k)} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors shadow-sm" title="Edit Data Profil"><Edit2 size={16}/></button>
                        <button type="button" onClick={() => handleDeleteEmployeeInstantly(k)} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-colors shadow-sm" title="Hapus/Karantina Keberadaan Staf"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
