import React, { useState, useMemo } from 'react';
import { Users, Landmark, Banknote, UserPlus, Layers, TrendingDown, ShieldAlert, Trash2, Edit2, Check, X, Phone, Image } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

// Helper Format Rupiah Lokal agar seragam dan aman
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

export default function TabKaryawan({ 
  karyawan = [], 
  expenses = [], 
  masterBranches, 
  master_branches, 
  cashflowTransactions, 
  cashflow_transactions, 
  sendToSheet, 
  showToast, 
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  // State Utama Navigasi Kluster
  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  // FIX DOUBLE-BRIDGE: Menghubungkan camelCase dan snake_case dari App.jsx agar anti-meleset
  const realMasterBranches = master_branches || masterBranches || [];
  const realCashflowTransactions = cashflow_transactions || cashflowTransactions || [];

  // State Form Entry Identitas & Kasbon
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const [formMaster, setFormMaster] = useState({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', photo_url: '' });
  const [formPayroll, setFormPayroll] = useState({ 
    date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' 
  });

  // ========================================================
  // 1. DATABASE COMPILER ENGINE (PENGOLAH DATA UTAMA)
  // ========================================================
  const petaNamaCabang = useMemo(() => {
    const mapping = { PUSAT: '🍊 TANGERANG PUSAT' };
    (realMasterBranches || []).forEach(b => {
      if (b && !b.isDeleted && b.branch_id) {
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${String(b.branch_name || b.branch_id).toUpperCase()}`;
      }
    });
    return mapping;
  }, [realMasterBranches]);

  const daftarCabangId = useMemo(() => Object.keys(petaNamaCabang), [petaNamaCabang]);

  const globalEmployeeCompiled = useMemo(() => {
    const dataStaf = {};
    
    // Ambil basis data master karyawan
    (karyawan || []).forEach(k => {
      if (!k || k.isDeleted) return;
      const bId = String(k.branch_id || 'PUSAT').trim().toUpperCase();
      dataStaf[k.id] = {
        id: k.id,
        name: k.name || 'TANPA NAMA',
        position: k.position || 'STAF',
        baseSalary: Number(k.baseSalary || 0),
        branch_id: bId,
        status: k.status || 'AKTIF',
        phone: k.phone || '-',
        photo_url: k.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        totalKasbon: 0, totalDibayar: 0, sisaHutang: 0
      };
    });

    // Hitung sirkulasi kasbon & pelunasan dari nota expenses
    (expenses || []).forEach(e => {
      if (!e || e.isDeleted || !e.employee_id || !dataStaf[e.employee_id]) return;
      if (e.category === 'KASBON') dataStaf[e.employee_id].totalKasbon += Number(e.amount || 0);
      if (e.category === 'PAYROLL') dataStaf[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0);
    });

    Object.values(dataStaf).forEach(b => {
      b.sisaHutang = Math.max(0, b.totalKasbon - b.totalDibayar);
    });

    return dataStaf;
  }, [karyawan, expenses]);

  const employeesDiCabangAktif = useMemo(() => {
    const targetBId = String(activeProcessingBranch || 'PUSAT').trim().toUpperCase();
    return Object.values(globalEmployeeCompiled).filter(k => k.branch_id === targetBId);
  }, [globalEmployeeCompiled, activeProcessingBranch]);

  // ========================================================
  // 2. FINANCIAL RADAR TOTALIZER ENGINE
  // ========================================================
  const metrikSDM = useMemo(() => {
    let kasbonCabang = 0; let gajiCabangBulanIni = 0;
    let kasbonGlobal = 0; let gajiGlobal = 0;
    const targetBId = String(activeProcessingBranch || 'PUSAT').trim().toUpperCase();
    const curMonth = todayStr.substring(0, 7);

    Object.values(globalEmployeeCompiled).forEach(emp => {
      if (emp.status === 'AKTIF') {
        kasbonGlobal += emp.sisaHutang;
        if (emp.branch_id === targetBId) kasbonCabang += emp.sisaHutang;
      }
    });

    (expenses || []).forEach(e => {
      if (!e || e.isDeleted) return;
      const bId = String(e.branch_id || '').trim().toUpperCase();
      if (e.category === 'PAYROLL' && e.date && e.date.startsWith(curMonth)) {
        gajiGlobal += Number(e.amount || 0);
        if (bId === targetBId) gajiCabangBulanIni += Number(e.amount || 0);
      }
    });

    return { kasbonCabang, gajiCabangBulanIni, kasbonGlobal, gajiGlobal };
  }, [globalEmployeeCompiled, expenses, activeProcessingBranch, todayStr]);

  // KESANGGUPAN PAYROLL ENGINE (SINKRON KAS TANGERANG)
  const kecukupanDanaPusat = useMemo(() => {
    const totalWajibGajiNasional = Object.values(globalEmployeeCompiled)
      .filter(e => e.status === 'AKTIF').reduce((sum, emp) => sum + emp.baseSalary, 0);
    const sisaWajibBayarBulanIni = Math.max(0, totalWajibGajiNasional - metrikSDM.gajiGlobal);
    
    let totalKasCairPusat = 0;
    (realCashflowTransactions || []).forEach(c => {
      if (!c || c.isDeleted) return;
      if (['HQ_FACTORY', 'PUSAT'].includes(String(c.branch_id).toUpperCase())) {
        if (String(c.transaction_type).toUpperCase() === 'INFLOW') totalKasCairPusat += Number(c.amount || 0);
        else totalKasCairPusat -= Number(c.amount || 0);
      }
    });

    let status = 'AMAN'; let warnaBadge = 'bg-emerald-500 text-white';
    let rekomendasi = '🔥 AMAN! Saldo kas liquid pusat sangat mencukupi untuk meng-cover sisa kewajiban gaji seluruh cabang nasional.';

    if (sisaWajibBayarBulanIni > totalKasCairPusat) {
      status = 'BAHAYA / KRITIS'; warnaBadge = 'bg-rose-600 text-white animate-pulse';
      rekomendasi = '🚨 KAS TIDAK CUKUP! Segera tarik setoran omzet dari Pemalang & Cibinong untuk mengamankan runway payroll.';
    }

    return { sisaWajibBayarBulanIni, totalKasCairPusat, status, warnaBadge, rekomendasi };
  }, [globalEmployeeCompiled, metrikSDM.gajiGlobal, realCashflowTransactions]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* SECTION A: INDIKATOR DASHBOARD ATAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Kasbon Aktif Wilayah ({activeProcessingBranch})</div>
          <div className="text-xl font-black text-orange-600 mt-1">{formatRupiah(metrikSDM.kasbonCabang)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Gaji Terbayar ({activeProcessingBranch}) Bulan Ini</div>
          <div className="text-xl font-black text-red-600 mt-1">{formatRupiah(metrikSDM.gajiCabangBulanIni)}</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 md:col-span-2 grid grid-cols-2 gap-2 text-white">
          <div><div className="text-[9px] font-black text-red-400 uppercase">Total Gaji Global</div><div className="text-base font-black">{formatRupiah(metrikSDM.gajiGlobal)}</div></div>
          <div><div className="text-[9px] font-black text-orange-400 uppercase">Total Kasbon Company</div><div className="text-base font-black">{formatRupiah(metrikSDM.kasbonGlobal)}</div></div>
        </div>
      </div>

      {/* SECTION B: RADAR KESANGGUPAN FINANCIAL */}
      {isHQ && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 flex items-center justify-between text-xs font-bold text-blue-800">
          <div>💡 <strong>Radar Gaji Nasional:</strong> {kecukupanDanaPusat.rekomendasi}</div>
          <span className={`px-3 py-1 rounded-full uppercase font-black text-[9px] ${kecukupanDanaPusat.warnaBadge}`}>Sisa Wajib Gaji: {formatRupiah(kecukupanDanaPusat.sisaWajibBayarBulanIni)}</span>
        </div>
      )}

      {/* SECTION C: PIL SWITCHER CABANG (KHUSUS PUSAT) */}
      {isHQ && (
        <div className="bg-slate-900 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between shadow-lg gap-4">
          <div className="flex items-center gap-2 mb-1 md:mb-0">
            <Layers size={16} className="text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Cabang untuk Manajemen Keuangan Staf:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeProcessingBranch.toUpperCase() === brId.toUpperCase() ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* SECTION D: MENU NAVIGASI SUB TAB */}
      <div className="flex gap-2 border-b pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Gaji & Payroll</button>}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500'}`}>Master SDM Wilayah</button>
      </div>

      {/* MODULE DIVISION SPLIT */}
      {activeSubTab === 'payroll' && isHQ && (
        <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} showToast={showToast} />
      )}

      {activeSubTab === 'kasbon' && (
        <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} showToast={showToast} />
      )}

      {activeSubTab === 'master' && (
        <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} />
      )}

    </div>
  );
}

// =========================================================================
// SUB-COMPONENT 1: MODUL GAJI & PAYROLL
// =========================================================================
function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, showToast }) {
  const [form, setForm] = useState({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });

  const selectedStafKasbon = useMemo(() => {
    if (!form.employeeId || !globalCompiled[form.employeeId]) return 0;
    return globalCompiled[form.employeeId].sisaHutang || 0;
  }, [form.employeeId, globalCompiled]);

  const hitungNetto = useMemo(() => {
    const gapok = Number(form.baseSalary || 0);
    const tunj = Number(form.allowance || 0);
    const potLain = Number(form.otherDeduction || 0);
    const potKasbon = Math.min(selectedStafKasbon, gapok + tunj);
    return { potKasbon, totalCair: (gapok + tunj) - (potKasbon + potLain) };
  }, [form.baseSalary, form.allowance, form.otherDeduction, selectedStafKasbon]);

  const historyGaji = useMemo(() => {
    const targetBId = String(activeBranch || '').trim().toUpperCase();
    return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'PAYROLL' && String(e.branch_id || '').trim().toUpperCase() === targetBId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeBranch]);

  const handleEmpChange = (id) => {
    const emp = globalCompiled[id];
    setForm(p => ({ ...p, employeeId: id, baseSalary: emp ? String(emp.baseSalary || 0) : '0' }));
  };

  const submitGaji = async (e) => {
    e.preventDefault();
    if (!form.employeeId) return;
    const expenseId = generateId('PRL', form.date);
    const success = await sendToSheet('insert', {
      id: expenseId, date: form.date, branch_id: activeBranch, category: 'PAYROLL', employee_id: form.employeeId,
      base_salary: Number(form.baseSalary), allowance: Number(form.allowance), kasbon_deduction: hitungNetto.potKasbon, other_deduction: Number(form.otherDeduction), amount: hitungNetto.totalCair, payment_method: form.paymentMethod,
      description: `Gaji Bulanan [${activeBranch}]`
    }, 'expenses');

    if (success) {
      await sendToSheet('insert', {
        id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'HQ_FACTORY' : activeBranch,
        transaction_type: 'OUTFLOW', category: 'OPERATIONAL_EXPENSE', amount: hitungNetto.totalCair, payment_method: form.paymentMethod, reference_id: expenseId,
        description: `Payroll Jurnal — Cabang: ${activeBranch}`
      }, 'cashflow_transactions');
      setForm({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border p-6 border-t-4 border-t-red-600 h-max">
        <form onSubmit={submitGaji} className="space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-800">Kalkulator Potong Gaji</h3>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Pilih Anggota ({activeBranch})</label>
            <select required value={form.employeeId} onChange={e => handleEmpChange(e.target.value)} className="w-full p-2.5 border rounded-xl font-black text-sm uppercase outline-none">
              <option value="">-- Pilih Karyawan --</option>
              {employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label><input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" /></div>
            <div><label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan</label><input type="text" required value={formatRupiah(form.allowance)} onChange={e=>setForm({...form, allowance: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          </div>
          <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-xs font-bold text-orange-800">
            <div>Auto Potong Kasbon: {formatRupiah(hitungNetto.potKasbon)}</div>
            <div className="text-[10px] text-orange-600 mt-1">Sisa Hutang: {formatRupiah(selectedStafKasbon)}</div>
          </div>
          <div><label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Lain</label><input type="text" required value={formatRupiah(form.otherDeduction)} onChange={e=>setForm({...form, otherDeduction: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Sumber Dana Kas</label>
            <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-xs">
              <option value="TF">TF (POTONG CASH UTAMA TANGERANG PUSAT)</option>
              <option value="CASH">CASH (POTONG KAS LACI CABANG LOKAL)</option>
            </select>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl text-center text-emerald-400 font-black">
            <div className="text-[8px] text-slate-400">NETTO CAIR DIBAYARKAN</div>
            <div className="text-xl mt-1">{formatRupiah(hitungNetto.totalCair)}</div>
          </div>
          <button type="submit" className="w-full bg-red-600 text-white text-xs font-black py-3 rounded-xl uppercase tracking-wider">Record & Potong Kas Besar</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Histori Gaji Jurnal Wilayah {activeBranch}</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
            <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Karyawan</th><th className="text-right px-4">Gaji+Tunj</th><th className="text-right px-4 text-orange-600">Pot. Kasbon</th><th className="text-right px-4 text-emerald-600">Netto Cair</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyGaji.length === 0 ? <tr><td colSpan="5" className="text-center py-6 text-slate-400">Belum ada jurnal penggajian.</td></tr> :
              historyGaji.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 uppercase">{globalCompiled[p.employee_id]?.name || 'STAF'}</td>
                  <td className="px-4 py-3 text-right">{formatRupiah((p.base_salary||0)+(p.allowance||0))}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatRupiah(p.kasbon_deduction)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatRupiah(p.amount)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT 2: MODUL KASBON KARYAWAN
// =========================================================================
function KasbonModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, showToast }) {
  const [form, setForm] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });

  const selectedStaf = form.employeeId ? globalCompiled[form.employeeId] : null;
  const isOverlimit = useMemo(() => {
    if (!selectedStaf) return false;
    return (Number(form.amount || 0) + selectedStaf.sisaHutang) > selectedStaf.baseSalary;
  }, [form.amount, selectedStaf]);

  const historyKasbonLog = useMemo(() => {
    const targetBId = String(activeBranch || '').trim().toUpperCase();
    return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'KASBON' && String(e.branch_id || '').trim().toUpperCase() === targetBId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeBranch]);

  const submitKasbon = async (e) => {
    e.preventDefault();
    if (!form.employeeId || isOverlimit) return;
    const expenseId = generateId('KSB', form.date);
    const success = await sendToSheet('insert', {
      id: expenseId, date: form.date, branch_id: activeBranch, employee_id: form.employeeId, category: 'KASBON', amount: Number(form.amount), description: `Kasbon Nota Baru — Ket: ${form.notes}`
    }, 'expenses');

    if (success) {
      await sendToSheet('insert', {
        id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: activeBranch, transaction_type: 'OUTFLOW', category: 'KARYAWAN_KASBON', amount: Number(form.amount), payment_method: 'CASH', reference_id: expenseId, description: `Pencairan kasbon laci toko`
      }, 'cashflow_transactions');
      setForm({ date: todayStr, employeeId: '', amount: '', notes: '' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-orange-500 h-max">
        <form onSubmit={submitKasbon} className="space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-800">Pencairan Kasbon Nota Baru</h3>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Pilih Anggota ({activeBranch})</label>
            <select required value={form.employeeId} onChange={e=>setForm({...form, employeeId: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-sm uppercase outline-none">
              <option value="">-- Pilih Karyawan --</option>
              {employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Nominal Pinjaman</label>
            <input type="text" required value={formatRupiah(form.amount)} onChange={e=>setForm({...form, amount: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl font-black text-sm" />
            {isOverlimit && <div className="mt-1.5 p-2 bg-red-600 text-white rounded-lg font-black text-[9px] uppercase animate-pulse">🚨 Overlimit! Total pinjaman melebihi sisa gaji pokok!</div>}
          </div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Alasan Keperluan</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs" placeholder="Keperluan pinjaman" /></div>
          <button type="submit" disabled={isOverlimit || !form.employeeId} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl text-xs uppercase disabled:opacity-40">Simpan Jurnal Kasbon</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Buku Jurnal Kasbon Riil per Nota (Filter: {activeBranch})</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
            <tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3">Karyawan</th><th className="px-4 py-3">Keterangan</th><th className="text-right px-4 text-orange-600">Nominal Pinjam</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyKasbonLog.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada nota kasbon.</td></tr> :
              historyKasbonLog.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-3"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 font-bold mt-0.5">{log.id}</div></td>
                  <td className="px-4 py-3 uppercase">{globalCompiled[log.employee_id]?.name || 'STAF'}</td>
                  <td className="px-4 py-3 text-slate-500 font-normal">{log.description}</td>
                  <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{formatRupiah(log.amount)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// 📇 SUB-COMPONENT 3: MASTER DATA REKREASI SDM WILAYAH
// =========================================================================
function MasterSDMModule({ employees, branchListId, branchMapName, activeBranch, isHQ, sendToSheet, showToast }) {
  const [form, setForm] = useState({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', photo_url: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ position: '', baseSalary: '0', status: 'AKTIF' });

  const submitKaryawanBaru = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const penempatan = isHQ ? form.targetBranch : activeBranch;
    const success = await sendToSheet('insert', {
      id: generateId('EMP', new Date()), name: form.name.toUpperCase(), position: form.position, baseSalary: Number(form.baseSalary || 0), branch_id: penempatan, status: 'AKTIF', phone: form.phone, photo_url: form.photo_url
    }, 'karyawan');
    if (success) setForm({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', photo_url: '' });
  };

  const simpanInlineEdit = async (id) => {
    const success = await sendToSheet('update', { id, position: editForm.position, baseSalary: Number(editForm.baseSalary), status: editForm.status }, 'karyawan');
    if (success) { setEditingId(null); if (showToast) showToast('Data karyawan sukses di-update!', 'success'); }
  };

  const pecatKaryawan = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data karyawan ini dari sistem?")) {
      const success = await sendToSheet('update', { id, isDeleted: true }, 'karyawan');
      if (success && showToast) showToast('Karyawan telah berhasil dihapus.', 'success');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-slate-800 h-max">
        <form onSubmit={submitKaryawanBaru} className="space-y-3">
          <h3 className="font-black text-sm uppercase text-slate-800">Registrasi Identitas Staf</h3>
          {isHQ && (
            <div>
              <label className="text-[10px] font-bold text-red-600 uppercase">Cabang Penempatan</label>
              <select value={form.targetBranch} onChange={e=>setForm({...form, targetBranch: e.target.value})} className="w-full p-2 border rounded-lg text-xs uppercase font-black">{branchListId.map(br => <option key={br} value={br}>{branchMapName[br]}</option>)}</select>
            </div>
          )}
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label><input type="text" required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm uppercase" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase"><Phone size={10} className="inline mr-1"/> No. WA</label><input type="text" required placeholder="0812xxx" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded-lg text-xs" /></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase"><Image size={10} className="inline mr-1"/> Link Foto</label><input type="text" placeholder="https://..." value={form.photo_url} onChange={e=>setForm({...form, photo_url: e.target.value})} className="w-full p-2 border rounded-lg text-xs" /></div>
          </div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok Bulanan (Master)</label><input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Posisi Kerja</label>
            <select value={form.position} onChange={e=>setForm({...form, position: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold uppercase"><option value="KASIR">KASIR / RESTO FRONT</option><option value="DAPUR_RESTO">COOK / DAPUR RESTO</option><option value="WAITRESS">PRAMUSAJI / WAITRESS</option><option value="PRODUKSI_PABREK">STAFF PRODUKSI ADUKAN</option><option value="DRIVER">DRIVING LOGISTIK</option></select>
          </div>
          <button type="submit" className="w-full bg-slate-800 text-white font-black py-3 rounded-xl text-xs uppercase">Simpan Data Staf</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Database Staf Wilayah Node {activeBranch}</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
            <tr><th>Profil</th><th>Kontak/HP</th><th>Jabatan & Gaji</th><th className="text-center">Status</th><th className="text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {employees.map(k => {
              const isEditing = editingId === k.id;
              return (
                <tr key={k.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img src={k.photo_url} alt="Ava" className="w-10 h-10 rounded-full object-cover border shrink-0" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                    <div><div className="font-black text-slate-800 uppercase">{k.name}</div><div className="text-[9px] font-mono text-slate-400">{k.id}</div></div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{k.phone}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="space-y-1">
                        <select value={editForm.position} onChange={e=>setEditForm({...editForm, position: e.target.value})} className="p-1 border text-[10px] rounded uppercase font-black w-full"><option value="KASIR">KASIR</option><option value="DAPUR_RESTO">COOK</option><option value="WAITRESS">WAITRESS</option><option value="PRODUKSI_PABREK">PRODUKSI</option><option value="DRIVER">DRIVER</option></select>
                        <input type="text" value={formatRupiah(editForm.baseSalary)} onChange={e=>setEditForm({...editForm, baseSalary: e.target.value.replace(/\D/g, '')})} className="p-1 border text-[10px] font-black rounded w-full"/>
                      </div>
                    ) : (
                      <div><div className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase w-max mb-1">{k.position}</div><div className="text-slate-800 font-black">{formatRupiah(k.baseSalary)}</div></div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <select value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})} className="p-1 border text-[10px] rounded font-black"><option value="AKTIF">AKTIF</option><option value="NON-AKTIF">NON-AKTIF</option></select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${k.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{k.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button type="button" onClick={() => simpanInlineEdit(k.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14}/></button>
                          <button type="button" onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><X size={14}/></button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setEditingId(k.id); setEditForm({ position: k.position, baseSalary: String(k.baseSalary), status: k.status }); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={13}/></button>
                          <button type="button" onClick={() => pecatKaryawan(k.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Trash2 size={13}/></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
