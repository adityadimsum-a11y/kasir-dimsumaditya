import React, { useState, useMemo } from 'react';
import { Users, Landmark, Banknote, UserPlus, Layers, TrendingDown, ShieldAlert, Trash2, Edit2, Check, X, Phone, Image, Eye, MapPin } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

export default function TabKaryawan({ 
  karyawan = [], expenses = [], masterBranches = [], master_branches, cashflowTransactions = [], cashflow_transactions, sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  // 📝 STATE BARU: Untuk menampung jendela detail popup karyawan yang di klik
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);

  const realMasterBranches = master_branches || masterBranches || [];
  const realCashflowTransactions = cashflow_transactions || cashflowTransactions || [];

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
    (karyawan || []).forEach(k => {
      if (!k || k.isDeleted) return;
      const bId = String(k.branch_id || 'PUSAT').trim().toUpperCase();
      dataStaf[k.id] = {
        id: k.id, name: k.name || 'TANPA NAMA', position: k.position || 'STAF', baseSalary: Number(k.baseSalary || 0), branch_id: bId, status: k.status || 'AKTIF',
        phone: k.phone || '-',
        address: k.address || 'ALAMAT BELUM DIISI',
        photo_url: k.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        ktp_url: k.ktp_url || '',
        totalKasbon: 0, totalDibayar: 0, sisaHutang: 0
      };
    });

    (expenses || []).forEach(e => {
      if (!e || e.isDeleted || !e.employee_id || !dataStaf[e.employee_id]) return;
      if (e.category === 'KASBON') dataStaf[e.employee_id].totalKasbon += Number(e.amount || 0);
      if (e.category === 'PAYROLL') dataStaf[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0);
    });

    Object.values(dataStaf).forEach(b => { b.sisaHutang = Math.max(0, b.totalKasbon - b.totalDibayar); });
    return dataStaf;
  }, [karyawan, expenses]);

  const employeesDiCabangAktif = useMemo(() => {
    const targetBId = String(activeProcessingBranch || 'PUSAT').trim().toUpperCase();
    return Object.values(globalEmployeeCompiled).filter(k => k.branch_id === targetBId);
  }, [globalEmployeeCompiled, activeProcessingBranch]);

  const metrikSDM = useMemo(() => {
    let kasbonCabang = 0; let gajiCabangBulanIni = 0; let kasbonGlobal = 0; let gajiGlobal = 0;
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

  const kecukupanDanaPusat = useMemo(() => {
    const totalWajibGajiNasional = Object.values(globalEmployeeCompiled).filter(e => e.status === 'AKTIF').reduce((sum, emp) => sum + emp.baseSalary, 0);
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
      
      {/* SUMMARY BOX */}
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

      {/* RADAR WIDGET */}
      {isHQ && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 flex items-center justify-between text-xs font-bold text-blue-800">
          <div>💡 <strong>Radar Gaji Nasional:</strong> {kecukupanDanaPusat.rekomendasi}</div>
          <span className={`px-3 py-1 rounded-full uppercase font-black text-[9px] ${kecukupanDanaPusat.warnaBadge}`}>Sisa Wajib Gaji: {formatRupiah(kecukupanDanaPusat.sisaWajibBayarBulanIni)}</span>
        </div>
      )}

      {/* PIL SWITCHER CABANG */}
      {isHQ && (
        <div className="bg-slate-900 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between shadow-lg gap-4">
          <div className="flex items-center gap-2 mb-1 md:mb-0"><Layers size={16} className="text-red-400" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Cabang untuk Keuangan Staf:</span></div>
          <div className="flex flex-wrap gap-2">
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeProcessingBranch.toUpperCase() === brId.toUpperCase() ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* NAV SUB TAB */}
      <div className="flex gap-2 border-b pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Gaji & Payroll</button>}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500'}`}>Master SDM Wilayah</button>
      </div>

      {/* MODUL DIVISION SWITCH */}
      {activeSubTab === 'payroll' && isHQ && (
        <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} />
      )}
      {activeSubTab === 'kasbon' && (
        <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} showToast={showToast} />
      )}
      {activeSubTab === 'master' && (
        <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} />
      )}

      {/* ======================================================== */}
      {/* 🔥 JENDELA POP-UP SULTAN: DETAIL IDENTITAS KARYAWAN + KTP DI-PERBESAR */}
      {/* ======================================================== */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border max-w-2xl w-full overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-amber-400"/>
                <h3 className="font-black text-sm uppercase tracking-wider">Berkas Profil & Dokumen KTP Staf</h3>
              </div>
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Grid Atas: Foto Profil + Biodata Utama */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b pb-5">
                <div className="w-36 h-36 rounded-2xl overflow-hidden border-4 border-slate-100 shadow-md shrink-0 bg-slate-100">
                  <img src={selectedEmployeeDetails.photo_url} alt="Foto Profil Gede" className="w-full h-full object-cover" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=250"}}/>
                </div>
                <div className="space-y-2 flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">{selectedEmployeeDetails.name}</h2>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase">{selectedEmployeeDetails.position}</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">NODE {selectedEmployeeDetails.branch_id}</span>
                  </div>
                  <div className="pt-2 text-xs font-bold text-slate-600 space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2"><Phone size={14} className="text-slate-400 font-mono"/> {selectedEmployeeDetails.phone}</div>
                    <div className="flex items-center justify-center sm:justify-start gap-2"><Landmark size={14} className="text-slate-400"/> Gaji Standar: <span className="text-slate-900 font-black">{formatRupiah(selectedEmployeeDetails.baseSalary)}</span></div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-orange-600"><Banknote size={14}/> Sisa Hutang Kasbon: <span className="font-black">{formatRupiah(selectedEmployeeDetails.sisaHutang)}</span></div>
                  </div>
                </div>
              </div>

              {/* Grid Tengah: Alamat Lengkap Karyawan */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1"><MapPin size={12}/> Alamat Rumah Tinggal</div>
                <p className="bg-slate-50 border p-3.5 rounded-xl text-xs font-bold text-slate-700 leading-relaxed uppercase">{selectedEmployeeDetails.address}</p>
              </div>

              {/* Grid Bawah: Foto KTP Diperbesar */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1"><Image size={12}/> Arsip Foto Kartu Tanda Penduduk (KTP) Diperbesar</div>
                <div className="w-full bg-slate-100 border rounded-2xl overflow-hidden shadow-inner flex items-center justify-center min-h-[220px]">
                  {selectedEmployeeDetails.ktp_url ? (
                    <img src={selectedEmployeeDetails.ktp_url} alt="KTP Gede" className="w-full h-auto max-h-[350px] object-contain hover:scale-105 transition-transform" />
                  ) : (
                    <div className="text-center p-8 text-slate-400 text-xs font-bold space-y-1">
                      <div>📁 Berkas KTP Belum Diunggah</div>
                      <div className="text-[10px] text-slate-400 font-normal">Silakan lakukan update berkas di menu registrasi.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-3 border-t text-right shrink-0">
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="px-5 py-2 bg-slate-900 text-white font-black text-xs uppercase rounded-xl hover:bg-slate-800 transition">Tutup Berkas</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// =========================================================================
// SUB-COMPONENT 1: MODUL GAJI & PAYROLL
// =========================================================================
function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails }) {
  const [form, setForm] = useState({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
  const selectedStafKasbon = useMemo(() => { if (!form.employeeId || !globalCompiled[form.employeeId]) return 0; return globalCompiled[form.employeeId].sisaHutang || 0; }, [form.employeeId, globalCompiled]);

  const hitungNetto = useMemo(() => {
    const gapok = Number(form.baseSalary || 0); const tunj = Number(form.allowance || 0); const potLain = Number(form.otherDeduction || 0);
    const potKasbon = Math.min(selectedStafKasbon, gapok + tunj);
    return { potKasbon, totalCair: (gapok + tunj) - (potKasbon + potLain) };
  }, [form.baseSalary, form.allowance, form.otherDeduction, selectedStafKasbon]);

  const historyGaji = useMemo(() => {
    const targetBId = String(activeBranch || '').trim().toUpperCase();
    return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'PAYROLL' && String(e.branch_id || '').trim().toUpperCase() === targetBId).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeBranch]);

  const handleEmpChange = (id) => { const emp = globalCompiled[id]; setForm(p => ({ ...p, employeeId: id, baseSalary: emp ? String(emp.baseSalary || 0) : '0' })); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border p-6 border-t-4 border-t-red-600 h-max">
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; const expenseId = generateId('PRL', form.date);
          const success = await sendToSheet('insert', { id: expenseId, date: form.date, branch_id: activeBranch, category: 'PAYROLL', employee_id: form.employeeId, base_salary: Number(form.baseSalary), allowance: Number(form.allowance), kasbon_deduction: hitungNetto.potKasbon, other_deduction: Number(form.otherDeduction), amount: hitungNetto.totalCair, payment_method: form.paymentMethod, description: `Gaji Bulanan [${activeBranch}]` }, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'HQ_FACTORY' : activeBranch, transaction_type: 'OUTFLOW', category: 'OPERATIONAL_EXPENSE', amount: hitungNetto.totalCair, payment_method: form.paymentMethod, reference_id: expenseId, description: `Payroll Jurnal — Cabang: ${activeBranch}` }, 'cashflow_transactions');
            setForm({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
          }
        }} className="space-y-4">
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
          <button type="submit" className="w-full bg-red-600 text-white text-xs font-black py-3 rounded-xl uppercase tracking-wider">Record & Potong Gaji</button>
        </form>
      </div>
      
      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Histori Gaji Jurnal Wilayah {activeBranch}</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
            <tr><th>Tanggal</th><th>Karyawan</th><th className="text-right">Gaji+Tunj</th><th className="text-right text-orange-600">Pot. Kasbon</th><th className="text-right text-emerald-600">Netto Cair</th><th className="text-center">Profil</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyGaji.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                <td className="px-4 py-3 uppercase">{globalCompiled[p.employee_id]?.name || 'STAF'}</td>
                <td className="px-4 py-3 text-right">{formatRupiah((p.base_salary||0)+(p.allowance||0))}</td>
                <td className="px-4 py-3 text-right text-orange-600">{formatRupiah(p.kasbon_deduction)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{formatRupiah(p.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <button type="button" onClick={() => onViewDetails(globalCompiled[p.employee_id])} className="p-1 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Eye size={12}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT 2: MODUL KASBON KARYAWAN
// =========================================================================
function KasbonModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet }) {
  const [form, setForm] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const selectedStaf = form.employeeId ? globalCompiled[form.employeeId] : null;
  const isOverlimit = useMemo(() => { if (!selectedStaf) return false; return (幕ber(form.amount || 0) + selectedStaf.sisaHutang) > selectedStaf.baseSalary; }, [form.amount, selectedStaf]);

  const historyKasbonLog = useMemo(() => {
    const targetBId = String(activeBranch || '').trim().toUpperCase();
    return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'KASBON' && String(e.branch_id || '').trim().toUpperCase() === targetBId).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeBranch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-orange-500 h-max">
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId || isOverlimit) return; const expenseId = generateId('KSB', form.date);
          const success = await sendToSheet('insert', { id: expenseId, date: form.date, branch_id: activeBranch, employee_id: form.employeeId, category: 'KASBON', amount: Number(form.amount), description: `Kasbon Nota Baru — Ket: ${form.notes}` }, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: activeBranch, transaction_type: 'OUTFLOW', category: 'KARYAWAN_KASBON', amount: Number(form.amount), payment_method: 'CASH', reference_id: expenseId, description: `Pencairan kasbon laci toko` }, 'cashflow_transactions');
            setForm({ date: todayStr, employeeId: '', amount: '', notes: '' });
          }
        }} className="space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-800">Pencairan Kasbon</h3>
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
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Alasan Keperluan</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs" placeholder="Keperluan" /></div>
          <button type="submit" disabled={isOverlimit || !form.employeeId} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl text-xs uppercase disabled:opacity-40">Simpan Jurnal Kasbon</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Buku Jurnal Kasbon Riil per Nota (Filter: {activeBranch})</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
            <tr><th>Tanggal & ID</th><th>Karyawan</th><th>Keterangan</th><th className="text-right">Nominal Pinjam</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyKasbonLog.map(log => (
              <tr key={log.id}>
                <td className="px-4 py-3"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 font-bold mt-0.5">{log.id}</div></td>
                <td className="px-4 py-3 uppercase">{globalCompiled[log.employee_id]?.name || 'STAF'}</td>
                <td className="px-4 py-3 text-slate-500 font-normal">{log.description}</td>
                <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{formatRupiah(log.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// 📇 SUB-COMPONENT 3: MASTER DATA REKREASI SDM WILAYAH DENGAN LIVE BASE64 UPLOAD
// =========================================================================
function MasterSDMModule({ employees, branchListId, branchMapName, activeBranch, isHQ, sendToSheet, showToast, onViewDetails }) {
  const [form, setForm] = useState({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', address: '', photo_base64: '', ktp_base64: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ position: '', baseSalary: '0', status: 'AKTIF' });

  // Helper konversi file gambar lokal di browser menjadi teks string Base64 kilat
  const konversiFileKeBase64 = (file, keyName) => {
    if(!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, [keyName]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-slate-800 h-max">
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.name) return; const penempatan = isHQ ? form.targetBranch : activeBranch;
          const success = await sendToSheet('insert', { id: generateId('EMP', new Date()), name: form.name.toUpperCase(), position: form.position, baseSalary: Number(form.baseSalary || 0), branch_id: penempatan, status: 'AKTIF', phone: form.phone, address: form.address, photo_base64: form.photo_base64, ktp_base64: form.formKtpBase64 || form.ktp_base64 }, 'karyawan');
          if (success) setForm({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', address: '', photo_base64: '', ktp_base64: '' });
        }} className="space-y-3">
          <h3 className="font-black text-sm uppercase text-slate-800">Registrasi Identitas Staf</h3>
          {isHQ && (
            <div>
              <label className="text-[10px] font-bold text-red-600 uppercase">Penempatan Kerja</label>
              <select value={form.targetBranch} onChange={e=>setForm({...form, targetBranch: e.target.value})} className="w-full p-2 border rounded-lg text-xs uppercase font-black">{branchListId.map(br => <option key={br} value={br}>{branchMapName[br]}</option>)}</select>
            </div>
          )}
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label><input type="text" required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm uppercase" /></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">No. WhatsApp</label><input type="text" required placeholder="0812xxx" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded-lg text-xs" /></div>
          
          {/* 📸 INPUT FILE BARU: Upload Foto Profil Langsung */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Upload Pas Foto Staf</label>
            <input type="file" accept="image/*" onChange={e => konversiFileKeBase64(e.target.files[0], 'photo_base64')} className="w-full text-xs font-bold text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
          </div>

          {/* 💳 INPUT FILE BARU: Upload Foto KTP Langsung */}
          <div>
            <label className="text-[10px] font-black text-orange-600 uppercase block mb-1">Upload Berkas KTP</label>
            <input type="file" accept="image/*" onChange={e => konversiFileKeBase64(e.target.files[0], 'ktp_base64')} className="w-full text-xs font-bold text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer" />
          </div>

          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label><input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Alamat Rumah KTP</label><textarea required rows="2" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold uppercase outline-none" placeholder="Isi nama jalan, RT/RW, dan kota tinggal..."></textarea></div>
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
            <tr><th>Profil (Klik untuk Lihat KTP)</th><th>Jabatan & Gaji</th><th className="text-center">Status</th><th className="text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {employees.map(k => {
              const isEditing = editingId === k.id;
              return (
                <tr key={k.id} className="hover:bg-slate-50/50 transition">
                  {/* REQ POINT: Klik nama staf untuk memicu jendela detail KTP diperbesar */}
                  <td onClick={() => onViewDetails(k)} className="px-4 py-3 flex items-center gap-3 cursor-pointer group">
                    <img src={k.photo_url} alt="Ava" className="w-10 h-10 rounded-full object-cover border shrink-0 group-hover:scale-110 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                    <div>
                      <div className="font-black text-slate-800 uppercase group-hover:text-blue-600 transition-colors flex items-center gap-1">{k.name} <Eye size={12} className="text-slate-400 inline"/></div>
                      <div className="text-[9px] font-mono text-slate-400">WA: {k.phone}</div>
                    </div>
                  </td>
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
                          <button type="button" onClick={() => { sendToSheet('update', { id: k.id, position: editForm.position, baseSalary: Number(editForm.baseSalary), status: editForm.status }, 'karyawan').then(()=>setEditingId(null)) }} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14}/></button>
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
