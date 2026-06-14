import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, Calculator, History, DollarSign, CheckCircle2, ArrowDownToLine, Printer, Edit2, Trash2 } from 'lucide-react';
// 🔥 FIX KABEL PRINTER: Cuma mundur 2 langkah (../../)
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

export default function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds }) {
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
    if(window.confirm("Yakin ingin membatalkan (void) slip gaji ini?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id));
      const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { if(showToast) showToast('Gaji divoid.', 'success'); } else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={`p-6 rounded-3xl border shadow-sm transition-all h-max ${isEditing ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'}`}>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; 
          const expenseId = isEditing ? form.id : generateId('PRL', form.date);
          let detailDesc = `Gaji Bulanan | Periode: ${form.periode_bulan}`;
          if (form.isProrata) detailDesc += ` (Prorata Absen: Masuk ${form.hariHadir}/${form.hariNormal} Hr. Potong: Rp ${totalMinusProrata})`;
          
          const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? selectedStafData?.branch_id : activeBranch;
          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, category: 'PAYROLL', employee_id: form.employeeId, base_salary: Number(form.baseSalary), allowance: Number(form.allowance), kasbon_deduction: hitungNetto.potKasbonFinal, other_deduction: Number(form.otherDeduction), amount: hitungNetto.totalCair, payment_method: form.paymentMethod, description: detailDesc };
          
          let success = false;
          if (isEditing) { success = await sendToSheet('update', payload, 'expenses'); } else { success = await sendToSheet('insert', payload, 'expenses'); }
          
          if (success) {
            if (!isEditing) await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'TANGERANG_PUSAT' : penempatanTrx, type: 'OUT', category: 'GAJI KARYAWAN', amount: hitungNetto.totalCair, method: form.paymentMethod, reference_id: expenseId, description: `Pencairan Payroll Gaji Bulanan: ${selectedStafData?.name} (${form.periode_bulan})` }, 'cashflow_transactions');
            if (showToast) showToast(`Gaji berhasil dicairkan! Saldo kas/bank otomatis terpotong.`, 'success');
            setForm({ id: '', date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'TF', isProrata: false, hariNormal: '26', hariHadir: '26' }); setIsEditing(false);
          }
        }} className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2 tracking-widest"><CalendarDays size={16} className={isEditing ? "text-amber-500" : "text-slate-800"}/> {isEditing ? 'Edit Data Penggajian' : 'Sistem Penggajian Bulanan'}</h3>{isEditing && <button type="button" onClick={() => { setIsEditing(false); setForm({ id: '', date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'TF', isProrata: false, hariNormal: '26', hariHadir: '26' }); }} className="text-[10px] border border-slate-200 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-slate-500 bg-white shadow-sm hover:bg-slate-50 transition-colors">Batal Edit</button>}</div>
          
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tgl Eksekusi Cair</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:border-blue-400" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Periode Bulan Jatah</label><input type="month" required value={form.periode_bulan} onChange={e=>setForm({...form, periode_bulan: e.target.value})} className="w-full p-2.5 border border-blue-200 rounded-xl text-xs font-black text-blue-800 bg-blue-50 outline-none focus:border-blue-500" /></div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Identitas Staf / Karyawan</label>
            <select required disabled={isEditing} value={form.employeeId} onChange={handlePilihKaryawan} className={`w-full p-3 border rounded-xl font-black text-xs uppercase outline-none cursor-pointer ${isEditing ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 focus:bg-white shadow-sm border-slate-200 focus:border-blue-400'}`}><option value="">-- Pilih Staf Penerima Gaji --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace('_', ' ')}) - CAB {k.branch_id}</option>)}</select>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" disabled={isEditing || !form.employeeId} checked={form.isProrata} onChange={e => { setForm({...form, isProrata: e.target.checked, baseSalary: e.target.checked ? String(Math.floor((Number(form.hariHadir)/Number(form.hariNormal))*masterGapok)) : String(masterGapok)}); }} className="w-4 h-4 accent-slate-800 cursor-pointer" /><span
