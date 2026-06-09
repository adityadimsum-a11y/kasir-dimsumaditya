import React, { useState, useMemo } from 'react';
import { Users, Landmark, Banknote, UserPlus, Layers, TrendingDown, ShieldAlert, Trash2, Edit2, Check, X, Phone, Image, Eye, MapPin, Undo, Link, Printer, CalendarDays, History } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

const parseDriveLink = (url) => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/(.*?)\//);
    if (match && match[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
  }
  return url;
};

export default function TabKaryawan({ 
  karyawan = [], expenses = [], masterBranches = [], master_branches, cashflowTransactions = [], cashflow_transactions, sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());

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
        photo_url: parseDriveLink(k.photo_url) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        ktp_url: parseDriveLink(k.ktp_url) || '',
        raw_photo_link: k.photo_url || '',
        raw_ktp_link: k.ktp_url || '',
        totalKasbon: 0, totalDibayar: 0, sisaHutang: 0,
        kasbon_list: [], payroll_list: [] // 🔥 REKAM JEJAK HISTORI
      };
    });

    (expenses || []).forEach(e => {
      if (!e || e.isDeleted || !e.employee_id || !dataStaf[e.employee_id]) return;
      if (e.category === 'KASBON') {
        dataStaf[e.employee_id].totalKasbon += Number(e.amount || 0);
        dataStaf[e.employee_id].kasbon_list.push(e); // Simpan riwayat
      }
      if (e.category === 'PAYROLL') {
        dataStaf[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0);
        dataStaf[e.employee_id].payroll_list.push(e); // Simpan riwayat
      }
    });

    // Urutkan histori agar yang terbaru di atas
    Object.values(dataStaf).forEach(b => { 
      b.sisaHutang = Math.max(0, b.totalKasbon - b.totalDibayar); 
      b.kasbon_list.sort((x, y) => new Date(y.date) - new Date(x.date));
      b.payroll_list.sort((x, y) => new Date(y.date) - new Date(x.date));
    });
    return dataStaf;
  }, [karyawan, expenses]);

  const employeesDiCabangAktif = useMemo(() => {
    const targetBId = String(activeProcessingBranch || 'PUSAT').trim().toUpperCase();
    return Object.values(globalEmployeeCompiled).filter(k => k.branch_id === targetBId && !optimisticDeletedIds.has(k.id));
  }, [globalEmployeeCompiled, activeProcessingBranch, optimisticDeletedIds]);

  const metrikSDM = useMemo(() => {
    let kasbonCabang = 0; let gajiCabangBulanIni = 0; let kasbonGlobal = 0; let gajiGlobal = 0;
    const targetBId = String(activeProcessingBranch || 'PUSAT').trim().toUpperCase();
    const curMonth = todayStr.substring(0, 7);

    Object.values(globalEmployeeCompiled).forEach(emp => {
      if (emp.status === 'AKTIF' && !optimisticDeletedIds.has(emp.id)) {
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
  }, [globalEmployeeCompiled, expenses, activeProcessingBranch, todayStr, optimisticDeletedIds]);

  const kecukupanDanaPusat = useMemo(() => {
    const totalWajibGajiNasional = Object.values(globalEmployeeCompiled).filter(e => e.status === 'AKTIF' && !optimisticDeletedIds.has(e.id)).reduce((sum, emp) => sum + emp.baseSalary, 0);
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
  }, [globalEmployeeCompiled, metrikSDM.gajiGlobal, realCashflowTransactions, optimisticDeletedIds]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* BOARDS METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Kasbon & Kredit Wilayah</div>
          <div className="text-xl font-black text-orange-600 mt-1">{formatRupiah(metrikSDM.kasbonCabang)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Gaji Terbayar ({activeProcessingBranch})</div>
          <div className="text-xl font-black text-red-600 mt-1">{formatRupiah(metrikSDM.gajiCabangBulanIni)}</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 md:col-span-2 grid grid-cols-2 gap-2 text-white">
          <div><div className="text-[9px] font-black text-red-400 uppercase">Total Gaji Global</div><div className="text-base font-black">{formatRupiah(metrikSDM.gajiGlobal)}</div></div>
          <div><div className="text-[9px] font-black text-orange-400 uppercase">Total Kasbon Company</div><div className="text-base font-black">{formatRupiah(metrikSDM.kasbonGlobal)}</div></div>
        </div>
      </div>

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

      {/* SUB NAV TABS */}
      <div className="flex gap-2 border-b pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Gaji & Payroll</button>}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Kasbon & Kredit</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500'}`}>Master SDM Wilayah</button>
      </div>

      {/* SWITCH MODUL COMPONENT */}
      {activeSubTab === 'payroll' && isHQ && (
        <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} />
      )}
      {activeSubTab === 'kasbon' && (
        <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} />
      )}
      {activeSubTab === 'master' && (
        <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} setOptimisticDeletedIds={setOptimisticDeletedIds} />
      )}

      {/* 📜 POP-UP MODAL PROFIL & TRACK RECORD HISTORI (SULTAN VIEW) */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex justify-center items-start pt-12 md:pt-20 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border max-w-4xl w-full overflow-hidden flex flex-col mb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2"><Users size={18} className="text-amber-400"/><h3 className="font-black text-sm uppercase tracking-wider">Berkas Profil & Rekam Jejak Operasional</h3></div>
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* KOLOM KIRI: DATA PROFIL */}
                <div className="space-y-6">
                  <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border shadow-inner bg-slate-50 flex items-center justify-center">
                    <img src={selectedEmployeeDetails.photo_url} alt="Profil Asli Full" className="w-full h-full object-contain" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-2">{selectedEmployeeDetails.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase">{selectedEmployeeDetails.position}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">NODE {selectedEmployeeDetails.branch_id}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 space-y-2">
                      <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400 font-mono"/> {selectedEmployeeDetails.phone}</div>
                      <div className="flex items-center gap-2"><Landmark size={14} className="text-slate-400"/> Gaji Standar: <span className="text-slate-900 font-black">{formatRupiah(selectedEmployeeDetails.baseSalary)}</span></div>
                      <div className="flex items-center gap-2 text-orange-600"><Banknote size={14}/> Hutang / Kredit: <span className="font-black">{formatRupiah(selectedEmployeeDetails.sisaHutang)}</span></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1"><MapPin size={12}/> Alamat Rumah</div>
                    <p className="bg-slate-50 border p-3 rounded-xl text-xs font-bold text-slate-700 leading-relaxed uppercase">{selectedEmployeeDetails.address}</p>
                  </div>
                  {selectedEmployeeDetails.ktp_url && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1"><Image size={12}/> Berkas KTP</div>
                      <div className="w-full bg-slate-100 border rounded-xl overflow-hidden shadow-inner flex items-center justify-center h-32 cursor-pointer hover:opacity-80 transition" onClick={() => window.open(selectedEmployeeDetails.ktp_url, '_blank')}>
                        <img src={selectedEmployeeDetails.ktp_url} alt="KTP" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>

                {/* KOLOM KANAN: TRACK RECORD PERIODE (HISTORI) */}
                <div className="md:col-span-2 space-y-6">
                  {/* TABEL HISTORI PENGGAJIAN */}
                  <div className="bg-slate-50 border rounded-2xl p-5">
                    <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-2 mb-3 flex items-center gap-2"><CalendarDays size={14} className="text-emerald-600"/> Riwayat Penggajian (Track Record)</h4>
                    {selectedEmployeeDetails.payroll_list.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEmployeeDetails.payroll_list.map((pr, i) => {
                          const isDescriptionHasPeriod = pr.description && pr.description.includes('Periode:');
                          const extractedPeriod = isDescriptionHasPeriod ? pr.description.split('Periode:')[1].trim() : formatDate(pr.date);
                          return (
                            <div key={i} className="flex flex-col sm:flex-row justify-between bg-white border p-3 rounded-xl gap-2 sm:gap-0">
                              <div>
                                <div className="text-xs font-black text-slate-800 uppercase">Gaji Periode {extractedPeriod}</div>
                                <div className="text-[9px] font-mono text-slate-400 mt-0.5">{formatDate(pr.date)} | ID: {pr.id}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-black text-emerald-600">{formatRupiah(pr.amount)}</div>
                                <div className="text-[9px] font-bold text-orange-600 uppercase mt-0.5">Potong Cicilan: {formatRupiah(pr.kasbon_deduction)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (<div className="text-center py-6 text-xs font-bold text-slate-400 italic">Belum ada riwayat penggajian tercatat.</div>)}
                  </div>

                  {/* TABEL HISTORI KASBON / KREDIT */}
                  <div className="bg-slate-50 border rounded-2xl p-5">
                    <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-2 mb-3 flex items-center gap-2"><History size={14} className="text-orange-600"/> Riwayat Kasbon & Kredit Barang</h4>
                    {selectedEmployeeDetails.kasbon_list.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEmployeeDetails.kasbon_list.map((ks, i) => (
                          <div key={i} className="flex flex-col sm:flex-row justify-between bg-white border p-3 rounded-xl gap-2 sm:gap-0 border-l-4 border-l-orange-500">
                            <div>
                              <div className="text-xs font-black text-slate-800 uppercase">{ks.description}</div>
                              <div className="text-[9px] font-mono text-slate-400 mt-0.5">{formatDate(ks.date)} | ID: {ks.id}</div>
                            </div>
                            <div className="text-right flex items-center justify-end">
                              <div className="text-sm font-black text-orange-600">{formatRupiah(ks.amount)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (<div className="text-center py-6 text-xs font-bold text-slate-400 italic">Tidak ada catatan hutang/kasbon.</div>)}
                  </div>
                </div>

              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t text-right shrink-0"><button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="px-6 py-2.5 bg-slate-900 text-white font-black text-xs uppercase rounded-xl hover:bg-slate-800 transition shadow-md">Tutup Berkas Profil</button></div>
          </div>
        </div>
      )}

    </div>
  );
}

// =========================================================================
// 📇 SUB-COMPONENT 1: MODUL GAJI & PAYROLL (DENGAN PERIODE & SMART INSTALLMENT)
// =========================================================================
function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user }) {
  // Ditambahkan state periode_bulan (YYYY-MM)
  const currentMonthValue = todayStr.substring(0, 7);
  const [form, setForm] = useState({ date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'CASH' });
  
  const selectedStafData = form.employeeId ? globalCompiled[form.employeeId] : null;
  const sisaHutangReal = selectedStafData ? selectedStafData.sisaHutang : 0;
  const batasAmanKredit = selectedStafData ? (selectedStafData.baseSalary * 0.3) : 0; // 30% dari Gaji Pokok

  // Handle Perubahan Karyawan untuk Auto-Saran Cicilan
  const handlePilihKaryawan = (e) => {
    const empId = e.target.value;
    const emp = globalCompiled[empId];
    if (emp) {
      const gapok = Number(emp.baseSalary || 0);
      const hutang = emp.sisaHutang || 0;
      // Rekomendasi potong: Ambil yang terkecil antara (Hutang Keseluruhan) atau (30% Gaji Pokok)
      const rekomendasiPotong = Math.min(hutang, (gapok * 0.3));
      
      setForm(p => ({
        ...p,
        employeeId: empId,
        baseSalary: String(gapok),
        potKasbonInput: String(rekomendasiPotong)
      }));
    } else {
      setForm(p => ({ ...p, employeeId: '', baseSalary: '0', potKasbonInput: '' }));
    }
  };

  const hitungNetto = useMemo(() => { 
    const gapok = Number(form.baseSalary || 0); 
    const tunj = Number(form.allowance || 0); 
    const potLain = Number(form.otherDeduction || 0); 
    // Mencegah potong kasbon melebihi total gaji+tunjangan ATAU melebihi sisa hutang asli
    const potKasbonFinal = Math.min(Number(form.potKasbonInput || 0), sisaHutangReal, gapok + tunj); 
    return { potKasbonFinal, totalCair: (gapok + tunj) - (potKasbonFinal + potLain) }; 
  }, [form.baseSalary, form.allowance, form.otherDeduction, form.potKasbonInput, sisaHutangReal]);

  const historyGaji = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'PAYROLL' && String(e.branch_id || '').trim().toUpperCase() === targetBId).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border p-6 border-t-4 border-t-red-600 h-max">
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; const expenseId = generateId('PRL', form.date);
          // Label deskripsi memuat periode agar rapi di database
          const deskripsiFinal = `Gaji Bulanan [${activeBranch}] | Periode: ${form.periode_bulan}`;

          const success = await sendToSheet('insert', { id: expenseId, date: form.date, branch_id: activeBranch, category: 'PAYROLL', employee_id: form.employeeId, base_salary: Number(form.baseSalary), allowance: Number(form.allowance), kasbon_deduction: hitungNetto.potKasbonFinal, other_deduction: Number(form.otherDeduction), amount: hitungNetto.totalCair, payment_method: form.paymentMethod, description: deskripsiFinal }, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'HQ_FACTORY' : activeBranch, transaction_type: 'OUTFLOW', category: 'OPERATIONAL_EXPENSE', amount: hitungNetto.totalCair, payment_method: form.paymentMethod, reference_id: expenseId, description: `Jurnal Payroll: ${selectedStafData?.name} (${form.periode_bulan})` }, 'cashflow_transactions');
            setForm({ date: todayStr, periode_bulan: currentMonthValue, employeeId: '', baseSalary: '0', allowance: '0', potKasbonInput: '', otherDeduction: '0', paymentMethod: 'CASH' });
          }
        }} className="space-y-4">
          <h3 className="font-black text-sm uppercase text-slate-800">Sistem Penggajian & Potong Kredit</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Eksekusi</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold outline-none" /></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Periode Gaji Bulan</label><input type="month" required value={form.periode_bulan} onChange={e=>setForm({...form, periode_bulan: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold text-blue-700 bg-blue-50 outline-none" /></div>
          </div>

          <div>
            <select required value={form.employeeId} onChange={handlePilihKaryawan} className="w-full p-2.5 border border-slate-300 shadow-sm rounded-xl font-black text-sm uppercase outline-none bg-slate-50 focus:bg-white"><option value="">-- Pilih Staf Penerima Gaji --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}</select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label><input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" /></div>
            <div><label className="text-[10px] font-bold text-emerald-600 uppercase">Bonus/Tunjangan</label><input type="text" required value={formatRupiah(form.allowance)} onChange={e=>setForm({...form, allowance: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          </div>
          
          {/* 🔥 FITUR SMART INSTALLMENT / POTONGAN KASBON BISA DIEDIT MANUAL */}
          <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
            <div className="flex justify-between items-end mb-1">
              <label className="text-[10px] font-black text-orange-800 uppercase">Potong Cicilan Kasbon/Kredit</label>
              <span className="text-[9px] font-bold text-orange-600">Hutang Tersisa: {formatRupiah(sisaHutangReal)}</span>
            </div>
            <input type="text" value={formatRupiah(form.potKasbonInput)} onChange={e=>setForm({...form, potKasbonInput: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border border-orange-300 bg-white rounded-lg font-black text-sm text-orange-700" placeholder="Rp 0" />
            <div className="text-[8px] font-bold text-orange-500 mt-1 uppercase">💡 Limit Angsuran Aman (30% Gaji): {formatRupiah(batasAmanKredit)}</div>
          </div>

          <div><label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Lain (Lain-Lain)</label><input type="text" required value={formatRupiah(form.otherDeduction)} onChange={e=>setForm({...form, otherDeduction: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Sumber Kas Pembayaran</label><select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-xs bg-slate-50"><option value="CASH">CASH TUNAI (POTONG KAS LACI CABANG)</option><option value="TF">TRANSFER BANK (POTONG REKENING PUSAT)</option></select></div>
          <div className="bg-slate-950 p-4 rounded-xl text-center text-emerald-400 font-black"><div className="text-[8px] text-slate-400 uppercase tracking-widest">Total Netto Gaji Diterima Karyawan</div><div className="text-2xl mt-1">{formatRupiah(hitungNetto.totalCair)}</div></div>
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 transition text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg">Cetak & Potong Gaji</button>
        </form>
      </div>
      
      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Histori Gaji Jurnal Wilayah {activeBranch}</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th>Periode / ID</th><th>Karyawan</th><th className="text-right">Gaji+Tunj</th><th className="text-right text-orange-600">Cicilan Kredit</th><th className="text-right text-emerald-600">Netto Cair</th><th className="text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyGaji.map(p => {
              const emp = globalCompiled[p.employee_id];
              const isDescPeriod = p.description && p.description.includes('Periode:');
              const extractedPeriod = isDescPeriod ? p.description.split('Periode:')[1].trim() : formatDate(p.date);

              return (
                <tr key={p.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{extractedPeriod}</div>
                    <div className="text-[9px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                  </td>
                  <td onClick={() => emp && onViewDetails(emp)} className="px-4 py-3 flex items-center gap-2.5 cursor-pointer group">
                    <img src={emp?.photo_url} alt="Profile" className="w-7 h-7 rounded-full object-cover border" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                    <span className="uppercase group-hover:text-blue-600 transition-colors">{emp?.name || 'STAF'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatRupiah((p.base_salary||0)+(p.allowance||0))}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatRupiah(p.kasbon_deduction)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatRupiah(p.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" onClick={() => emp && onViewDetails(emp)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg" title="Lihat Rekam Jejak"><Eye size={12}/></button>
                      
                      {/* 🔥 TOMBOL CETAK SLIP GAJI */}
                      <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                        title: 'BUKTI PENGGAJIAN / SLIP GAJI',
                        id: p.id,
                        date: formatDate(p.date),
                        periode: extractedPeriod,
                        branch_name: activeBranch,
                        admin_name: user?.name || 'ADMIN',
                        customer_name: emp?.name || 'STAF',
                        position: emp?.position || 'STAF',
                        
                        items: [
                          { name: 'Gaji Pokok & Bonus Tunjangan', qty: 1, subtotal: (p.base_salary || 0) + (p.allowance || 0) },
                          { name: 'Potongan Cicilan Kasbon/Kredit', qty: 1, subtotal: -(p.kasbon_deduction || 0) },
                          { name: 'Potongan Lain-Lain', qty: 1, subtotal: -(p.other_deduction || 0) }
                        ],
                        amount: p.amount,
                        paymentMethod: p.payment_method || 'CASH',
                        
                        // Buku Mutasi
                        history: {
                          kasbonList: emp?.kasbon_list?.slice(0, 3) || [], // Tampilkan max 3 kasbon terbaru
                          labelLama: 'Akumulasi Hutang Kasbon/Kredit Awal',
                          nominalLama: (emp?.sisaHutang || 0) + (p.kasbon_deduction || 0),
                          labelAksi: 'Dipotong Untuk Angsuran Bulan Ini',
                          nominalAksi: p.kasbon_deduction || 0,
                          labelBaru: 'SISA HUTANG / KREDIT SEKARANG',
                          nominalBaru: emp?.sisaHutang || 0
                        }
                      })} className="p-1.5 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg" title="Cetak Slip Gaji Dot Matrix">
                        <Printer size={12}/>
                      </button>
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

// =========================================================================
// 📇 SUB-COMPONENT 2: MODUL KASBON & KREDIT BARANG
// =========================================================================
function KasbonModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user }) {
  const [form, setForm] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const selectedStaf = form.employeeId ? globalCompiled[form.employeeId] : null;
  // Hilangkan validasi overlimit untuk mendukung Kredit Barang Besar. (Asalkan di-Approve Kepala)
  // const isOverlimit = useMemo(() => { if (!selectedStaf) return false; return (Number(form.amount || 0) + selectedStaf.sisaHutang) > selectedStaf.baseSalary; }, [form.amount, selectedStaf]);
  
  const historyKasbonLog = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && e.category === 'KASBON' && String(e.branch_id || '').trim().toUpperCase() === targetBId).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-orange-500 h-max shadow-sm">
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.employeeId) return; const expenseId = generateId('KSB', form.date);
          const success = await sendToSheet('insert', { id: expenseId, date: form.date, branch_id: activeBranch, employee_id: form.employeeId, category: 'KASBON', amount: Number(form.amount), description: form.notes.toUpperCase() }, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: 'CFO-' + new Date().getTime(), date: form.date, branch_id: activeBranch, transaction_type: 'OUTFLOW', category: 'KARYAWAN_KASBON', amount: Number(form.amount), payment_method: 'CASH', reference_id: expenseId, description: `Pencairan Dana Kasbon / Kredit` }, 'cashflow_transactions');
            setForm({ date: todayStr, employeeId: '', amount: '', notes: '' });
          }
        }} className="space-y-4">
          <div>
            <h3 className="font-black text-sm uppercase text-slate-800">Pengajuan Kasbon & Kredit</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1">Untuk kredit barang, masukkan total harga (Misal: 2 Juta). Pembayaran akan dicicil otomatis saat penggajian bulanan.</p>
          </div>
          <div>
            <select required value={form.employeeId} onChange={e=>setForm({...form, employeeId: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-sm uppercase outline-none"><option value="">-- Pilih Staf Peminjam --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}</select>
          </div>
          <div><input type="text" required value={formatRupiah(form.amount)} onChange={e=>setForm({...form, amount: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl font-black text-sm" placeholder="Nominal Rp" /></div>
          <div><input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs uppercase" placeholder="Keterangan (Misal: KREDIT HP BARU)" /></div>
          <button type="submit" disabled={!form.employeeId} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl text-xs uppercase disabled:opacity-40 shadow-lg">Cetak & Simpan Pinjaman</button>
        </form>
      </div>
      <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Daftar Jurnal Kasbon & Kredit Berjalan</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th>Tanggal & ID</th><th>Karyawan</th><th>Keterangan Aksi</th><th className="text-right">Nominal Pengajuan</th><th className="text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {historyKasbonLog.map(log => {
              const emp = globalCompiled[log.employee_id];
              return (
                <tr key={log.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 font-bold mt-0.5">{log.id}</div></td>
                  <td onClick={() => emp && onViewDetails(emp)} className="px-4 py-3 flex items-center gap-2.5 cursor-pointer group">
                    <img src={emp?.photo_url} alt="Profile" className="w-7 h-7 rounded-full object-cover border" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                    <span className="uppercase group-hover:text-blue-600 transition-colors">{emp?.name || 'STAF'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-normal">{log.description}</td>
                  <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{formatRupiah(log.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" onClick={() => emp && onViewDetails(emp)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"><Eye size={12}/></button>
                      
                      {/* 🔥 TOMBOL CETAK BUKTI KASBON/KREDIT */}
                      <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                        title: 'BUKTI PENCAIRAN KASBON / KREDIT',
                        id: log.id,
                        date: formatDate(log.date),
                        periode: formatDate(log.date).substring(3),
                        branch_name: activeBranch,
                        admin_name: user?.name || 'ADMIN',
                        customer_name: emp?.name || 'STAF',
                        position: emp?.position || 'STAF',
                        
                        items: [
                          { name: `${log.description}`, qty: 1, subtotal: log.amount }
                        ],
                        amount: log.amount,
                        paymentMethod: 'CASH',
                        
                        history: {
                          kasbonList: emp?.kasbon_list?.slice(0, 3) || [], 
                          labelLama: 'Sisa Hutang / Kredit Sebelumnya',
                          nominalLama: Math.max(0, (emp?.sisaHutang || 0) - log.amount),
                          labelAksi: 'Penambahan Kasbon / Kredit Baru',
                          nominalAksi: log.amount,
                          labelBaru: 'TOTAL HUTANG / KREDIT SAAT INI',
                          nominalBaru: emp?.sisaHutang || 0
                        }
                      })} className="p-1.5 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg" title="Cetak Bukti Kasbon">
                        <Printer size={12}/>
                      </button>
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

// =========================================================================
// 📇 SUB-COMPONENT 3: MASTER DATA SDM
// =========================================================================
function MasterSDMModule({ employees, branchListId, branchMapName, activeBranch, isHQ, sendToSheet, showToast, onViewDetails, setOptimisticDeletedIds }) {
  const [form, setForm] = useState({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' });
  const [isEditingMode, setIsEditingMode] = useState(false);

  const handleTriggerEditPencil = (k) => {
    setForm({ 
      id: k.id, 
      name: k.name, 
      position: k.position, 
      baseSalary: String(k.baseSalary || 0), 
      targetBranch: k.branch_id, 
      phone: k.phone === '-' ? '' : k.phone, 
      address: k.address === 'ALAMAT BELUM DIISI' ? '' : k.address, 
      photo_url: k.raw_photo_link || '', 
      ktp_url: k.raw_ktp_link || '' 
    });
    setIsEditingMode(true);
    if (showToast) showToast(`Data ${k.name} siap diedit di form kiri!`, 'success');
  };

  const handleDeleteEmployeeInstantly = async (k) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data staf ${k.name} dari sistem?`)) {
      setOptimisticDeletedIds(prev => new Set(prev).add(k.id));
      const success = await sendToSheet('delete', { id: k.id }, 'karyawan');
      if (success) {
        if (showToast) showToast(`Staf ${k.name} telah berhasil dihapus.`, 'success');
      } else {
        setOptimisticDeletedIds(prev => { const newSet = new Set(prev); newSet.delete(k.id); return newSet; });
        if (showToast) showToast('Gagal menghapus data. Periksa koneksi internet.', 'error');
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={`p-6 rounded-2xl border border-t-4 transition-colors duration-300 h-max ${isEditingMode ? 'bg-amber-50/50 border-t-amber-500 border-amber-200' : 'bg-white border-t-slate-800'}`}>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.name) return; const penempatan = isHQ ? form.targetBranch : activeBranch;
          const payload = { 
            name: form.name.toUpperCase(), position: form.position, baseSalary: Number(form.baseSalary || 0), branch_id: penempatan, status: 'AKTIF', 
            phone: form.phone || '-', address: form.address || 'ALAMAT BELUM DIISI',
            photo_url: form.photo_url || '', ktp_url: form.ktp_url || ''
          };
          let success = false;
          if (isEditingMode && form.id) { payload.id = form.id; success = await sendToSheet('update', payload, 'karyawan'); } 
          else { payload.id = generateId('EMP', new Date()); success = await sendToSheet('insert', payload, 'karyawan'); }
          if (success) { setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); setIsEditingMode(false); }
        }} className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-black text-sm uppercase text-slate-800">{isEditingMode ? `🔄 Update Staf: ${form.name}` : 'Registrasi Identitas Staf'}</h3>
            {isEditingMode && (
              <button type="button" onClick={() => { setIsEditingMode(false); setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); }} className="text-[10px] font-black uppercase text-slate-500 border px-2 py-0.5 rounded flex items-center gap-1 bg-white"><Undo size={10}/> Batal</button>
            )}
          </div>
          {isHQ && (
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Penempatan Kerja</label><select disabled={isEditingMode} value={form.targetBranch} onChange={e=>setForm({...form, targetBranch: e.target.value})} className="w-full p-2 border rounded-lg text-xs uppercase font-black bg-white">{branchListId.map(br => <option key={br} value={br}>{branchMapName[br]}</option>)}</select></div>
          )}
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label><input type="text" required readOnly={isEditingMode} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className={`w-full p-2 border rounded-lg text-sm uppercase outline-none ${isEditingMode ? 'bg-slate-100 font-black text-slate-500 cursor-not-allowed' : ''}`} /></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">No. WhatsApp</label><input type="text" required placeholder="Contoh: 081234567" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold" /></div>
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 mb-1"><Link size={10}/> Link Pas Foto Profil Baru</label>
            <input type="text" placeholder="Paste link foto dari Google Drive..." value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})} className="w-full p-2 border rounded-lg text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1 mb-1"><Link size={10}/> Link Berkas Foto KTP</label>
            <input type="text" placeholder="Paste link KTP dari Google Drive..." value={form.ktp_url} onChange={e => setForm({...form, ktp_url: e.target.value})} className="w-full p-2 border border-orange-200 bg-orange-50 rounded-lg text-xs" />
          </div>

          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label><input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" /></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Alamat Rumah KTP</label><textarea required rows="2" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold uppercase none outline-none" placeholder="Isi nama jalan..."></textarea></div>
          <div><label className="text-[10px] font-bold text-slate-500 uppercase">Posisi Kerja</label><select value={form.position} onChange={e=>setForm({...form, position: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold uppercase"><option value="KASIR">KASIR / RESTO FRONT</option><option value="DAPUR_RESTO">COOK / DAPUR RESTO</option><option value="WAITRESS">PRAMUSAJI / WAITRESS</option><option value="PRODUKSI_PABREK">STAFF PRODUKSI ADUKAN</option><option value="DRIVER">DRIVING LOGISTIK</option></select></div>
          <button type="submit" className={`w-full text-white font-black py-3 rounded-xl text-xs uppercase shadow transition-all ${isEditingMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-900'}`}>{isEditingMode ? '💾 Terapkan & Timpa Data' : 'Simpan Data Staf'}</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Database Staf Wilayah penempatan {activeBranch}</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th>Profil (Klik untuk Lihat KTP)</th><th>Jabatan & Gaji</th><th className="text-center">Status</th><th className="text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold">
            {employees.map(k => (
              <tr key={k.id} className="hover:bg-slate-50/50 transition">
                <td onClick={() => onViewDetails(k)} className="px-4 py-3 flex items-center gap-3 cursor-pointer group">
                  <img src={k.photo_url} alt="Ava" className="w-10 h-10 rounded-full object-cover border shrink-0 group-hover:scale-110 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                  <div>
                    <div className="font-black text-slate-800 uppercase group-hover:text-blue-600 transition-colors flex items-center gap-1">{k.name} <Eye size={12} className="text-slate-400 inline"/></div>
                    <div className="text-[9px] font-mono text-slate-400">WA: {k.phone}</div>
                  </div>
                </td>
                <td className="px-4 py-3"><div><div className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase w-max mb-1">{k.position}</div><div className="text-slate-800 font-black">{formatRupiah(k.baseSalary)}</div></div></td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${k.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{k.status}</span></td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button type="button" onClick={() => handleTriggerEditPencil(k)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Lengkapi / Edit Berkas Karyawan"><Edit2 size={13}/></button>
                    <button type="button" onClick={() => handleDeleteEmployeeInstantly(k)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="Hapus"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
