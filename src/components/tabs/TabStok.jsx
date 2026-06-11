import React, { useState, useMemo } from 'react';
import { Factory, Printer, Edit2, Trash2, Calendar, ClipboardList, CheckCircle2, Lock, Target, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
// 🔥 PERBAIKAN: Menambahkan 'formatRp' dari helpers dan membuang formatNumber lokal
import { getTodayStr, generateId, formatDate, formatRp } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

// Fungsi lokal formatNumber kita ganti pakai Number(...).toLocaleString biar aman
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({ 
  productionBatches = [], production_batches, 
  masterRules = [], master_rules, // 🔥 DATA RULES OTOMATIS MASUK
  user, sendToSheet, showToast, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: '', date: todayStr, productName: 'DIMSUM FROZEN CORE',
    ayamKg: '', yieldPcs: '', picName: '', notes: ''
  });

  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, productionBatches]);
  
  // --- ENGINE SAKTI: TARIK ATURAN DARI MASTER DATA ---
  const dynamicRules = useMemo(() => {
    const rulesData = master_rules || masterRules || [];
    if (rulesData.length > 0) return rulesData[0]; // Ambil data baris pertama
    // Fallback keamanan jika Master Data kosong
    return { resep_adukan: 30, target_yield: 1000 }; 
  }, [masterRules, master_rules]);

  // --- ALGORITMA KALKULATOR TARGET PRODUKSI (REAL-TIME) ---
  const { targetPcs, selisihYield, persenYield } = useMemo(() => {
    const ayamInput = Number(form.ayamKg || 0);
    const hasilInput = Number(form.yieldPcs || 0);
    
    // Rumus: (Ayam Dipakai / Standar Ayam Per Adukan) * Target Yield Per Adukan
    const ratio = Number(dynamicRules.target_yield) / Number(dynamicRules.resep_adukan);
    const target = Math.round(ayamInput * ratio);
    
    const selisih = hasilInput - target;
    const persen = target > 0 ? ((hasilInput / target) * 100).toFixed(1) : 0;

    return { targetPcs: target, selisihYield: selisih, persenYield: persen };
  }, [form.ayamKg, form.yieldPcs, dynamicRules]);

  // --- FILTER & TIME-LOCK ENGINE ---
  const filteredProduction = useMemo(() => {
    return realProduction.filter(p => {
      if (p.isDeleted) return false;
      if (!isHQ && p.branch_id !== currentBranch) return false;
      if (p.date.substring(0, 10) !== tableDateFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProduction, isHQ, currentBranch, tableDateFilter]);

  // --- ACTIONS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.yieldPcs) <= 0) return alert("Hasil jadi (Yield) tidak boleh 0!");

    // Konfirmasi extra jika hasil nyusut banyak (dibawah 90% dari target)
    if (persenYield > 0 && persenYield < 90) {
      if (!window.confirm(`PERINGATAN! Hasil produksi sangat rendah (${persenYield}% dari Target).\nAda kebocoran ${Math.abs(selisihYield)} Pcs.\n\nYakin ingin tetap menyimpan data ini?`)) return;
    }

    const trxId = isEditing ? form.id : generateId('PRD', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch,
      product_name: form.productName, total_ayam_kg: Number(form.ayamKg),
      total_yield_pcs: Number(form.yieldPcs), pic_name: form.picName.toUpperCase(),
      notes: form.notes.toUpperCase()
    };

    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'production_batches')) {
      showToast(`Data produksi berhasil ${isEditing ? 'diperbarui' : 'disimpan'}!`, 'success');
      if (!isEditing && window.confirm("Cetak Tiket Bukti Produksi?")) handlePrint(payload, targetPcs, selisihYield);
      handleCancelEdit();
    }
  };

  const handleEdit = (log) => {
    setForm({
      id: log.id, date: log.date.substring(0, 10), productName: log.product_name,
      ayamKg: log.total_ayam_kg, yieldPcs: log.total_yield_pcs, picName: log.pic_name, notes: log.notes || ''
    });
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setForm({ id: '', date: todayStr, productName: 'DIMSUM FROZEN CORE', ayamKg: '', yieldPcs: '', picName: '', notes: '' });
  };

  const handlePrint = (log, printTarget, printSelisih) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'TIKET PRODUKSI / YIELD REPORT', id: log.id, date: formatDate(log.date),
      branch_name: log.branch_id, admin_name: user?.name || 'ADMIN', customer_name: `PIC: ${log.pic_name}`,
      items: [
        { name: 'Bahan Daging Ayam Masuk', qty: log.total_ayam_kg, suffix: ' Kg', subtotal: 0 },
        { name: `Target Sistem (${dynamicRules.resep_adukan}Kg=${dynamicRules.target_yield}Pcs)`, qty: printTarget, suffix: ' Pcs', subtotal: 0 },
        { name: `Hasil Jadi Aktual (Fisik)`, qty: log.total_yield_pcs, suffix: ' Pcs', subtotal: 0 },
        { name: `Selisih / Susut`, qty: printSelisih, suffix: ' Pcs', subtotal: 0 }
      ],
      paymentMethod: 'DOKUMEN INTERNAL DAPUR'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10 animate-in fade-in duration-300">
      
      {/* FORM INPUT PRODUKSI */}
      <div className={`p-6 rounded-3xl border transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center border-b pb-3 mb-2">
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <Factory size={16} className={isEditing ? "text-amber-500" : "text-blue-600"}/> 
              {isEditing ? 'Revisi Laporan Produksi' : 'Lapor Hasil Produksi (Yield)'}
            </h3>
            {isEditing && <button type="button" onClick={handleCancelEdit} className="text-[10px] bg-white border px-2 py-1 rounded-lg text-slate-500 font-black uppercase hover:bg-slate-50">Batal</button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:border-blue-400" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kepala Dapur (PIC)</label><input type="text" required value={form.picName} onChange={e=>setForm({...form, picName: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase bg-slate-50 outline-none focus:border-blue-400" placeholder="Nama PIC..." /></div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 relative overflow-hidden">
            {/* Indikator Aturan Aktif */}
            <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest">
              Rule: {dynamicRules.resep_adukan}KG = {dynamicRules.target_yield}PCS
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">1. Bahan Ayam Dipakai (Kg)</label>
              <input type="number" step="0.1" required value={form.ayamKg} onChange={e=>setForm({...form, ayamKg: e.target.value})} className="w-full p-3 border border-rose-200 rounded-xl text-lg font-black text-rose-700 outline-none focus:border-rose-400 bg-white" placeholder="0 Kg" />
            </div>
            
            {/* RADAR TARGET PINTAR */}
            {form.ayamKg && (
               <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between animate-in fade-in">
                 <div className="flex items-center gap-2 text-blue-700">
                    <Target size={18} />
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-blue-500">Estimasi Target Sistem</div>
                      <div className="text-sm font-black tracking-wide">± {formatNumber(targetPcs)} PCS</div>
                    </div>
                 </div>
               </div>
            )}

            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">2. Hasil Jadi Aktual Dimsum (Pcs)</label>
              <input type="number" required value={form.yieldPcs} onChange={e=>setForm({...form, yieldPcs: e.target.value})} className="w-full p-3 border border-emerald-300 bg-emerald-50 rounded-xl text-2xl font-black text-emerald-800 text-center outline-none focus:border-emerald-500" placeholder="0 Pcs" />
            </div>

            {/* ANALISIS SELISIH */}
            {form.yieldPcs && form.ayamKg && (
              <div className={`p-3 rounded-xl border flex items-center justify-between animate-in fade-in ${selisihYield >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                 <div className="flex items-center gap-2">
                   {selisihYield >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                   <span className="text-xs font-black uppercase tracking-wider">
                     {selisihYield >= 0 ? 'Surplus / Pas' : 'Terjadi Susut'}
                   </span>
                 </div>
                 <div className="text-right">
                   <div className="font-black text-base">{selisihYield > 0 ? '+' : ''}{formatNumber(selisihYield)} PCS</div>
                   <div className="text-[9px] font-bold tracking-widest uppercase opacity-70">Ratio: {persenYield}%</div>
                 </div>
              </div>
            )}
          </div>

          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Catatan Tambahan / Alasan Susut</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-400" placeholder="Contoh: Adukan agak lembek..." /></div>

          <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md transition-transform active:scale-95 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{isEditing ? 'Simpan Revisi' : 'Laporkan & Cetak Tiket'}</button>
        </form>
      </div>

      {/* JURNAL PRODUKSI (DENGAN GEMBOK WAKTU) */}
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h4 className="font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><ClipboardList size={16} className="text-blue-500"/> Riwayat Produksi Dapur</h4>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm"><Calendar size={12} className="text-slate-400"/><input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" /></div>
        </div>

        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-4 py-4 font-black">Tgl & ID</th><th className="px-4 py-4 font-black">Kinerja Produksi</th><th className="px-4 py-4 font-black text-center">PIC</th><th className="px-4 py-4 font-black text-center">Aksi & Validasi</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredProduction.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Tidak ada aktivitas produksi hari ini.</td></tr>
              ) : (
                filteredProduction.map(log => {
                  // Re-kalkulasi on the fly untuk histori
                  const ratioHist = Number(dynamicRules.target_yield) / Number(dynamicRules.resep_adukan);
                  const targetHist = Math.round(Number(log.total_ayam_kg || 0) * ratioHist);
                  const selisihHist = Number(log.total_yield_pcs || 0) - targetHist;
                  const isSusut = selisihHist < 0;

                  // 🔥 LOGIKA GEMBOK WAKTU ANTI FRAUD (TIME-LOCK)
                  const isLogToday = log.date.substring(0, 10) === todayStr;
                  const canModify = isHQ || isLogToday; 

                  return (
                    <tr key={log.id} className={`hover:bg-slate-50 transition-colors group ${isSusut ? 'bg-rose-50/10' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div></td>
                      <td className="px-4 py-4 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2"><span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">Ayam: {log.total_ayam_kg} Kg</span></div>
                        <div className="font-black text-emerald-600 text-sm flex items-center gap-2">HASIL: {formatNumber(log.total_yield_pcs)} PCS</div>
                        
                        {/* Status Bar Selisih */}
                        <div className={`mt-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${isSusut ? 'text-rose-500' : 'text-blue-500'}`}>
                           {isSusut ? <AlertTriangle size={10}/> : <CheckCircle2 size={10}/>}
                           {isSusut ? `Susut ${formatNumber(Math.abs(selisihHist))} Pcs dari Target` : `Target Tercapai / Surplus`}
                        </div>
                        {log.notes && <div className="text-[9px] text-slate-400 mt-1 uppercase italic line-clamp-1 border-t pt-1 border-slate-100">Ket: "{log.notes}"</div>}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap"><div className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-700 uppercase inline-block border shadow-sm">{log.pic_name}</div></td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handlePrint(log, targetHist, selisihHist)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Cetak Tiket"><Printer size={15}/></button>
                          
                          {/* RENDER TOMBOL JIKA LOLOS GEMBOK WAKTU */}
                          {canModify ? (
                            <>
                              <button type="button" onClick={() => handleEdit(log)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100" title="Edit Data"><Edit2 size={13}/></button>
                              <button type="button" onClick={() => { if(window.confirm("Batalkan tiket produksi ini?")) requestDelete(log.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Void Transaksi"><Trash2 size={13}/></button>
                            </>
                          ) : (
                            <span className="text-[10px] flex items-center gap-1 text-slate-300 font-bold px-2 py-1 bg-slate-50 rounded border border-slate-100" title="Terkunci (Hanya Pusat yang bisa edit data lampau)"><Lock size={12}/> Locked</span>
                          )}
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
