import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, Calculator, History, DollarSign, CheckCircle2, ArrowDownToLine, Printer, Edit2, Trash2, FileText } from 'lucide-react';

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

// 🔥 FIX BUG 1: Tambahkan setPrintData di parameter props
export default function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds, setPrintData }) {
  const currentMonthValue = todayStr.substring(0, 7);
  const [form, setForm] = useState({ 
    id: '', date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'CASH',
    isProrata: false, hariNormal: '26', hariHadir: '26' 
  });
  const [isEditing, setIsEditing] = useState(false);
  
  const selectedStafData = form.employeeId ? globalCompiled[form.employeeId] : null;
  const sisaHutangReal = selectedStafData ? selectedStafData.sisaHutang : 0;
  const masterGapok = selectedStafData ? selectedStafData.baseSalary : 0;
  
  const gajiPokokDihitung = useMemo(() => {
    if (!selectedStafData) return 0;
    if (!form.isProrata) return masterGapok;
    return Math.floor((Number(form.hariHadir) / Number(form.hariNormal)) * masterGapok);
  }, [selectedStafData, form.isProrata, form.hariNormal, form.hariHadir, masterGapok]);

  const totalMinusProrata = Math.max(0, masterGapok - gajiPokokDihitung);

  useEffect(() => {
    if (form.isProrata && !isEditing && selectedStafData) { setForm(p => ({ ...p, baseSalary: String(gajiPokokDihitung) })); }
  }, [gajiPokokDihitung, form.isProrata, isEditing, selectedStafData]);

  const { batasAmanKredit, rekomendasiCicilanSistem } = useMemo(() => {
    if (!selectedStafData) return { batasAmanKredit: 0, rekomendasiCicilanSistem: 0 };
    const batas = masterGapok * 0.3; 
    let cicilanBarangBerjalan = 0;
    selectedStafData.history_kredit.forEach(k => { if (k.status === 'BERJALAN' || k.status === 'BELUM BAYAR') cicilanBarangBerjalan += (k.cicilanSaranPerBulan || 0); });
    let saranSistem = Math.min(sisaHutangReal, cicilanBarangBerjalan); 
    if (saranSistem === 0 && sisaHutangReal > 0) saranSistem = Math.min(sisaHutangReal, batas); 
    return { batasAmanKredit: batas, rekomendasiCicilanSistem: saranSistem };
  }, [selectedStafData, sisaHutangReal, masterGapok]);

  const handlePilihKaryawan = (e) => {
    const empId = e.target.value; const emp = globalCompiled[empId];
    if (emp) {
      const gapok = form.isProrata ? ((Number(form.hariHadir) / Number(form.hariNormal)) * emp.baseSalary) : emp.baseSalary;
      const batas = emp.baseSalary * 0.3; let cicilanBerjalan = 0;
      emp.history_kredit.forEach(k => { if (k.status !== 'LUNAS') cicilanBerjalan += (k.cicilanSaranPerBulan || 0); });
      let saran = Math.min(emp.sisaHutang, cicilanBerjalan);
      if (saran === 0 && emp.sisaHutang > 0) saran = Math.min(emp.sisaHutang, batas);
      setForm(p => ({ ...p, employeeId: empId, baseSalary: String(Math.floor(gapok)), potKasbonInput: String(Math.floor(saran)) }));
    } else { setForm(p => ({ ...p, employeeId: '', baseSalary: '0', potKasbonInput: '' })); }
  };

  const hitungNetto = useMemo(() => { 
    const gapok = Number(form.baseSalary || 0); const tunj = Number(form.allowance || 0); const potLain = Number(form.otherDeduction || 0); 
    const potKasbonFinal = Math.min(Number(form.potKasbonInput || 0), sisaHutangReal, gapok + tunj); 
    return { potKasbonFinal, totalCair: (gapok + tunj) - (potKasbonFinal + potLain) }; 
  }, [form.baseSalary, form.allowance, form.otherDeduction, form.potKasbonInput, sisaHutangReal]);

  const historyGaji = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && !optimisticDeletedIds.has(e.id) && e.category === 'PAYROLL' && (targetBId === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === targetBId)).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch, optimisticDeletedIds]);

  const handleEdit = (log) => {
    const isDescPeriod = log.description && log.description.includes('Periode:');
    const extractedPeriod = isDescPeriod ? log.description.split('Periode:')[1].trim().split('(')[0].trim() : currentMonthValue;
    setForm({
      id: log.id, date: log.date.split('T')[0], periode_bulan: extractedPeriod, employeeId: log.employee_id,
      baseSalary: String(log.base_salary || 0), allowance: String(log.allowance || 0), potKasbonInput: String(log.kasbon_deduction || 0),
      otherDeduction: String(log.other_deduction || 0), paymentMethod: log.payment_method || 'CASH',
      isProrata: false, hariNormal: '26', hariHadir: '26'
    });
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(window.confirm("YAKIN INGIN MEMBATALKAN (VOID) SLIP GAJI INI?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id));
      // 🔥 FIX BUG 2: Ganti Hard Delete ke Karantina Cerdas (Soft Delete)
      const success = await sendToSheet('update', { id, isDeleted: true }, 'expenses');
      if(success) { if(showToast) showToast('GAJI DIVOID (DIKARANTINA).', 'success'); } else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 uppercase tracking-wider">
      <div className={`p-6 rounded-3xl border shadow-sm transition-all h-max ${isEditing ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'}`}>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; 
          const expenseId = isEditing ? form.id : generateId('PRL', form.date);
          let detailDesc = `GAJI BULANAN | PERIODE: ${form.periode_bulan}`;
          if (form.isProrata) detailDesc += ` (PRORATA ABSEN: MASUK ${form.hariHadir}/${form.hariNormal} HR. POTONG: RP ${totalMinusProrata})`;
          
          const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? selectedStafData?.branch_id : activeBranch;
          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, category: 'PAYROLL', employee_id: form.employeeId, base_salary: Number(form.baseSalary), allowance: Number(form.allowance), kasbon_deduction: hitungNetto.potKasbonFinal, other_deduction: Number(form.otherDeduction), amount: hitungNetto.totalCair, payment_method: form.paymentMethod, description: detailDesc, isDeleted: false };
          
          let success = false;
          if (isEditing) { success = await sendToSheet('update', payload, 'expenses'); } else { success = await sendToSheet('insert', payload, 'expenses'); }
          
          if (success) {
            if (!isEditing) await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'TANGERANG_PUSAT' : penempatanTrx, type: 'OUT', category: 'GAJI KARYAWAN', amount: hitungNetto.totalCair, method: form.paymentMethod, reference_id: expenseId, description: `PENCAIRAN PAYROLL GAJI BULANAN: ${selectedStafData?.name} (${form.periode_bulan})`, isDeleted: false }, 'cashflow_transactions');
            if (showToast) showToast(`GAJI BERHASIL DICAIRKAN! SALDO KAS/BANK OTOMATIS TERPOTONG.`, 'success');
            setForm({ id: '', date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'TF', isProrata: false, hariNormal: '26', hariHadir: '26' }); setIsEditing(false);
          }
        }} className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2 tracking-widest"><CalendarDays size={16} className={isEditing ? "text-amber-500" : "text-slate-800"}/> {isEditing ? 'EDIT DATA PENGGAJIAN' : 'SISTEM PENGGAJIAN BULANAN'}</h3>{isEditing && <button type="button" onClick={() => { setIsEditing(false); setForm({ id: '', date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'TF', isProrata: false, hariNormal: '26', hariHadir: '26' }); }} className="text-[10px] border border-slate-200 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-slate-500 bg-white shadow-sm hover:bg-slate-50 transition-colors">BATAL EDIT</button>}</div>
          
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">TGL EKSEKUSI CAIR</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:border-blue-400 cursor-pointer" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">PERIODE BULAN JATAH</label><input type="month" required value={form.periode_bulan} onChange={e=>setForm({...form, periode_bulan: e.target.value})} className="w-full p-2.5 border border-blue-200 rounded-xl text-xs font-black text-blue-800 bg-blue-50 outline-none focus:border-blue-500 cursor-pointer" /></div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">IDENTITAS STAF / KARYAWAN</label>
            <select required disabled={isEditing} value={form.employeeId} onChange={handlePilihKaryawan} className={`w-full p-3 border rounded-xl font-black text-xs uppercase tracking-wider outline-none cursor-pointer ${isEditing ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 focus:bg-white shadow-sm border-slate-200 focus:border-blue-400'}`}><option value="">-- PILIH STAF PENERIMA GAJI --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace('_', ' ')}) - CAB {k.branch_id.replace('_', ' ')}</option>)}</select>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" disabled={isEditing || !form.employeeId} checked={form.isProrata} onChange={e => { setForm({...form, isProrata: e.target.checked, baseSalary: e.target.checked ? String(Math.floor((Number(form.hariHadir)/Number(form.hariNormal))*masterGapok)) : String(masterGapok)}); }} className="w-4 h-4 accent-slate-800 cursor-pointer" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5"><Calculator size={14}/> POTONG GAJI PRORATA (CUTI / IZIN TAK DIBAYAR)</span></label>
            {form.isProrata && (
              <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in">
                <div><label className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">STANDAR KERJA SEBULAN</label><input type="number" min="1" max="31" value={form.hariNormal} onChange={e=>setForm({...form, hariNormal: e.target.value})} className="w-full p-2.5 border border-slate-200 bg-white rounded-xl text-sm font-black text-center outline-none focus:border-slate-400" /></div>
                <div><label className="text-[9px] font-black tracking-widest text-blue-600 uppercase block mb-1">FAKTUAL HADIR BEKERJA</label><input type="number" min="0" max="31" value={form.hariHadir} onChange={e=>setForm({...form, hariHadir: e.target.value})} className="w-full p-2.5 border border-blue-300 bg-blue-50 rounded-xl text-sm font-black text-center text-blue-800 outline-none focus:bg-white focus:border-blue-500" /></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between items-center tracking-widest block mb-1">GAJI POKOK {form.isProrata && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-black">AUTO</span>}</label>
              <input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className={`w-full p-3 border rounded-xl font-black text-sm outline-none transition-colors tracking-wider ${form.isProrata ? 'bg-emerald-50 text-emerald-900 border-emerald-200 focus:bg-white' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-400'}`} />
              {form.isProrata && totalMinusProrata > 0 && (<div className="text-[8px] font-black text-rose-500 mt-1.5 uppercase tracking-widest">KEPOTONG: -{formatRupiah(totalMinusProrata)}</div>)}
            </div>
            <div><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">BONUS/TUNJANGAN</label><input type="text" required value={formatRupiah(form.allowance)} onChange={e=>setForm({...form, allowance: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border border-blue-200 rounded-xl font-black text-sm bg-blue-50/50 outline-none focus:bg-white focus:border-blue-500 transition-colors tracking-wider" /></div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 shadow-inner">
            <div className="flex justify-between items-end mb-2"><label className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center gap-1.5"><History size={14}/> POTONG CICILAN KREDIT / KASBON</label><span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 uppercase tracking-wider">HUTANG AKTIF: {formatRupiah(sisaHutangReal)}</span></div>
            <input type="text" value={formatRupiah(form.potKasbonInput)} onChange={e=>setForm({...form, potKasbonInput: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border-2 border-orange-200 bg-white rounded-xl font-black text-sm text-orange-800 outline-none focus:border-orange-400 transition-colors tracking-wider" placeholder="RP 0" />
            <div className="text-[9px] font-black text-orange-600 mt-2.5 uppercase tracking-widest leading-relaxed">💡 LIMIT ANGSURAN AMAN (30% GAJI): {formatRupiah(batasAmanKredit)}<br/>REKOMENDASI AUTO-POTONG SISTEM: {formatRupiah(rekomendasiCicilanSistem)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">POTONGAN LAINNYA</label><input type="text" required value={formatRupiah(form.otherDeduction)} onChange={e=>setForm({...form, otherDeduction: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border border-rose-200 rounded-xl font-black text-sm bg-rose-50 outline-none focus:bg-white focus:border-rose-400 transition-colors text-rose-800 tracking-wider" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">SUMBER KAS UANG GAJI</label><select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl font-black text-xs bg-slate-50 outline-none cursor-pointer focus:border-blue-400"><option value="TF">TRANSFER BANK (REK PUSAT)</option><option value="CASH">CASH TUNAI (LACI CABANG)</option></select></div>
          </div>

          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800 relative overflow-hidden mt-2">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10 pointer-events-none" size={120} />
            <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1.5 mb-1"><CheckCircle2 size={12}/> TOTAL GAJI BERSIH (TAKE HOME PAY)</div>
            <div className="text-3xl font-black tracking-tight">{formatRupiah(hitungNetto.totalCair)}</div>
          </div>
          <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mt-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-900'}`}>{isEditing ? '💾 UPDATE LEMBAR GAJI' : 'CAIRKAN & POTONG KAS DOMPET'}</button>
        </form>
      </div>
      
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-500"/> HISTORI PENGGAJIAN {activeBranch === 'SEMUA_CABANG' ? 'NASIONAL (GABUNGAN)' : `AREA ${activeBranch.replace('_', ' ')}`}</div>
        <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">PERIODE / ID</th><th className="px-5 py-3 font-black">KARYAWAN PENERIMA</th><th className="px-5 py-3 font-black text-right">GAJI KOTOR + TUNJANGAN</th><th className="px-5 py-3 font-black text-right text-orange-600">CICILAN / KASBON</th><th className="px-5 py-3 font-black text-right text-emerald-600">NETTO CAIR RIIL</th><th className="px-5 py-3 font-black text-center">AKSI OPERASIONAL</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historyGaji.length === 0 ? (
                 <tr><td colSpan="6" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">BELUM ADA RIWAYAT PENGGAJIAN TERCATAT PADA BUKU INI.</td></tr>
              ) : (
                historyGaji.map(p => {
                  const emp = globalCompiled[p.employee_id];
                  const isDescPeriod = p.description && p.description.toUpperCase().includes('PERIODE:');
                  const extractedPeriod = isDescPeriod ? p.description.toUpperCase().split('PERIODE:')[1].trim().split('(')[0] : formatDate(p.date);
                  const isProrataLog = p.description && p.description.toUpperCase().includes('PRORATA');
                  const stringProrataCut = isProrataLog && p.description.toUpperCase().match(/POTONG: RP (\d+)/);
                  const valProrata = stringProrataCut ? Number(stringProrataCut[1]) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-sm uppercase tracking-wider">{extractedPeriod}</div><div className="text-[9px] font-mono text-slate-400 mt-1 tracking-wider">{p.id}</div></td>
                      <td onClick={() => emp && onViewDetails(emp)} className="px-5 py-4 flex items-center gap-3 cursor-pointer">
                        <img src={emp?.photo_url} alt="Profile" className="w-10 h-10 rounded-xl object-cover border shadow-sm group-hover:scale-105 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                        <div><span className="uppercase tracking-wider font-black text-slate-800 group-hover:text-blue-600 transition-colors block">{emp?.name || 'STAF KARYAWAN'}</span>{activeBranch === 'SEMUA_CABANG' && <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mt-1 block">LOKASI NODE: {emp?.branch_id.replace('_', ' ')}</span>}</div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600 tracking-wider">{formatRupiah((p.base_salary||0)+(p.allowance||0))}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-orange-600 tracking-wider">{formatRupiah(p.kasbon_deduction)}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-emerald-600 font-black text-sm flex items-center justify-end gap-1.5 tracking-wider"><ArrowDownToLine size={12}/> {formatRupiah(p.amount)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 🔥 FIX BUG 1: Panggil setPrintData dari Props Terpusat */}
                          <button type="button" onClick={() => {
                            if (typeof setPrintData === 'function') {
                              setPrintData({
                                type: 'INVOICE',
                                title: 'SLIP GAJI RESMI KARYAWAN', id: p.id, date: formatDate(p.date), periode: extractedPeriod,
                                branch_name: emp?.branch_id || activeBranch, admin_name: user?.name || 'ADMIN HRD', customer_name: emp?.name || 'STAF', position: emp?.position.replace('_', ' ') || 'STAF',
                                items: [
                                  { name: 'GAJI POKOK MASTER BULANAN', qty: 1, subtotal: (p.base_salary || 0) + valProrata }, 
                                  ...(isProrataLog ? [{ name: 'POTONGAN ABSENSI (CUTI/IZIN PRORATA)', qty: 1, subtotal: -valProrata }] : []),
                                  { name: 'BONUS KEDISIPLINAN & TUNJANGAN', qty: 1, subtotal: (p.allowance || 0) },
                                  { name: 'POTONGAN ANGSURAN KASBON / KREDIT', qty: 1, subtotal: -(p.kasbon_deduction || 0) },
                                  { name: 'DENDA / POTONGAN LAIN-LAIN', qty: 1, subtotal: -(p.other_deduction || 0) }
                                ], amount: p.amount, paymentMethod: p.payment_method || 'CASH TUNAI',
                                history: { kasbonList: [...(emp?.history_kredit || []), ...(emp?.history_kasbon || [])].slice(0, 3), labelLama: 'AKUMULASI TOTAL SISA HUTANG AWAL', nominalLama: (emp?.sisaHutang || 0) + (p.kasbon_deduction || 0), labelAksi: 'DIPOTONG UNTUK ANGSURAN BULAN INI', nominalAksi: p.kasbon_deduction || 0, labelBaru: 'SISA HUTANG AKTIF SEKARANG', nominalBaru: emp?.sisaHutang || 0 }
                              })
                            }
                          }} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Cetak Slip Gaji Printer Kasir"><Printer size={16}/></button>
                          
                          {isHQ && (<><button type="button" onClick={() => handleEdit(p)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Edit Rincian Gaji"><Edit2 size={16}/></button><button type="button" onClick={() => handleDelete(p.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Batalkan/Void Gaji"><Trash2 size={16}/></button></>)}
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
