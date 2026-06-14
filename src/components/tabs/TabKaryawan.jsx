import React, { useState, useMemo } from 'react';
import { 
  Users, Wallet, Layers, ArrowRightLeft, Banknote, DollarSign, Clock, 
  X, Phone, Image, Eye, ShoppingCart, CheckCircle2, History, CalendarDays // 🔥 IKON MODAL DIKEMBALIKAN
} from 'lucide-react';

// 🔥 SAMBUNG KABEL LOGIKA KANTONG ANAK (DENGAN EKSTENSI .jsx AGAR VERCEL TIDAK BINGUNG)
import PayrollModule from './KaryawanModules/PayrollModule.jsx';
import LemburModule from './KaryawanModules/LemburModule.jsx';
import KasbonModule from './KaryawanModules/KasbonModule.jsx';
import MasterSDMModule from './KaryawanModules/MasterSDMModule.jsx';

// --- HELPER CENTRAL LOKAL (ANTI CRASH) ---
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const getTodayStr = () => {
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  return new Date(today - tzOffset).toISOString().split('T')[0];
};
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const parseDriveLink = (url) => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/(.*?)\//);
    if (match && match[1]) { return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`; }
  }
  return url;
};

export default function TabKaryawan({ 
  karyawan = [], expenses = [], masterBranches = [], master_branches, cashflowTransactions = [], cashflow_transactions, 
  productionBatches = [], production_batches, orders = [], orders_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());

  const realMasterBranches = master_branches || masterBranches || [];
  const realProductionBatches = production_batches || productionBatches || [];
  const realOrders = orders_data || orders || [];

  // --- PEMETAAN CABANG DINAMIS ---
  const petaNamaCabang = useMemo(() => {
    // 🔥 SOLUSI MUTLAK DOUBLE TAB: 'PUSAT' di-kick dari awal agar tombol Tangerang Pusat tidak ganda!
    const mapping = { TANGERANG_PUSAT: '🍊 TANGERANG PUSAT' };
    (realMasterBranches || []).forEach(b => {
      if (b && !b.isDeleted && b.branch_id && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT') { 
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${String(b.branch_name || b.branch_id).toUpperCase()}`; 
      }
    });
    return mapping;
  }, [realMasterBranches]);
  const daftarCabangId = useMemo(() => Object.keys(petaNamaCabang), [petaNamaCabang]);

  // --- TARGET PRODUKSI HARIAN (PORSI vs PCS) ---
  const totalPcsHariIni = useMemo(() => {
    return realProductionBatches.filter(p => {
      const isToday = p.date && p.date.substring(0, 10) === todayStr;
      const isBranch = activeProcessingBranch === 'SEMUA_CABANG' || String(p.branch_id).toUpperCase() === activeProcessingBranch;
      return isToday && isBranch && !p.isDeleted && !optimisticDeletedIds.has(p.id);
    }).reduce((sum, p) => sum + Number(p.actual_yield || p.yield_pcs || p.qty || 0), 0);
  }, [realProductionBatches, activeProcessingBranch, todayStr, optimisticDeletedIds]);

  const totalPorsiHariIni = Math.floor(totalPcsHariIni / 4);

  // --- KOMPILASI DATA KARYAWAN INTEGRASI REKAP UTANG ---
  const globalEmployeeCompiled = useMemo(() => {
    const dataStaf = {};
    (karyawan || []).forEach(k => {
      if (!k || k.isDeleted) return;
      
      // 🔥 LEBUR DATA: Siapapun yang terdata di cabang 'PUSAT' otomatis dilebur ke 'TANGERANG_PUSAT'
      let bId = String(k.branch_id || 'TANGERANG_PUSAT').trim().toUpperCase();
      if (bId === 'PUSAT') bId = 'TANGERANG_PUSAT';

      dataStaf[k.id] = {
        id: k.id, name: k.name || 'TANPA NAMA', position: k.position || 'STAF', baseSalary: Number(k.baseSalary || 0), branch_id: bId, status: k.status || 'AKTIF',
        phone: k.phone || '-', address: k.address || 'ALAMAT BELUM DIISI',
        photo_url: parseDriveLink(k.photo_url) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', ktp_url: parseDriveLink(k.ktp_url) || '', raw_photo_link: k.photo_url || '', raw_ktp_link: k.ktp_url || '',
        totalKasbon: 0, totalDibayar: 0, sisaHutang: 0, 
        raw_debts: [], payroll_list: [], history_kredit: [], history_kasbon: []
      };
    });

    (expenses || []).forEach(e => {
      if (!e || e.isDeleted || optimisticDeletedIds.has(e.id) || !e.employee_id || !dataStaf[e.employee_id]) return;
      if (e.category === 'KASBON' || e.category === 'KREDIT_BARANG') {
        dataStaf[e.employee_id].totalKasbon += Number(e.amount || 0); dataStaf[e.employee_id].raw_debts.push(e); 
      }
      if (e.category === 'PAYROLL') {
        dataStaf[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0); dataStaf[e.employee_id].payroll_list.push(e); 
      }
    });

    Object.values(dataStaf).forEach(emp => { 
      emp.sisaHutang = Math.max(0, emp.totalKasbon - emp.totalDibayar); 
      emp.payroll_list.sort((a, b) => new Date(b.date) - new Date(a.date));
      let poolDibayar = emp.totalDibayar;
      emp.raw_debts.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      emp.raw_debts.forEach(debt => {
        let nominalHutang = Number(debt.amount || 0); let terbayarUntukIni = 0;
        if (poolDibayar >= nominalHutang) { terbayarUntukIni = nominalHutang; poolDibayar -= nominalHutang; } 
        else if (poolDibayar > 0) { terbayarUntukIni = poolDibayar; poolDibayar = 0; }

        let sisa = nominalHutang - terbayarUntukIni;
        let status = sisa === 0 ? 'LUNAS' : (terbayarUntukIni > 0 ? 'BERJALAN' : 'BELUM BAYAR');
        let processedDebt = { ...debt, terbayar: terbayarUntukIni, sisa: sisa, status: status };

        if (debt.category === 'KREDIT_BARANG') {
          let tenor = Number(debt.tenor || 1); let cicilanPerBulan = nominalHutang / tenor;
          processedDebt.cicilanKe = sisa === 0 ? tenor : Math.floor(terbayarUntukIni / cicilanPerBulan);
          processedDebt.cicilanSaranPerBulan = cicilanPerBulan;
          emp.history_kredit.push(processedDebt);
        } else { emp.history_kasbon.push(processedDebt); }
      });
      emp.history_kredit.reverse(); emp.history_kasbon.reverse();
    });
    return dataStaf;
  }, [karyawan, expenses, optimisticDeletedIds]);

  const employeesDiCabangAktif = useMemo(() => {
    return Object.values(globalEmployeeCompiled).filter(k => {
      if (optimisticDeletedIds.has(k.id)) return false;
      if (activeProcessingBranch === 'SEMUA_CABANG') return true;
      return k.branch_id === activeProcessingBranch;
    });
  }, [globalEmployeeCompiled, activeProcessingBranch, optimisticDeletedIds]);

  // --- BUDGETING GAJI (20% AMPlOP PENJUALAN) ---
  const metrikSDM = useMemo(() => {
    let kasbonCabang = 0; let gajiCabangBulanIni = 0; let kasbonGlobal = 0; let gajiGlobal = 0;
    const curMonth = todayStr.substring(0, 7);

    Object.values(globalEmployeeCompiled).forEach(emp => {
      if (emp.status === 'AKTIF' && !optimisticDeletedIds.has(emp.id)) {
        kasbonGlobal += emp.sisaHutang;
        if (activeProcessingBranch === 'SEMUA_CABANG' || emp.branch_id === activeProcessingBranch) { kasbonCabang += emp.sisaHutang; }
      }
    });

    (expenses || []).forEach(e => {
      if (!e || e.isDeleted || optimisticDeletedIds.has(e.id)) return;
      const logDate = e.date ? e.date.substring(0, 10) : '';
      if (e.category === 'PAYROLL' && logDate.startsWith(curMonth)) {
        gajiGlobal += Number(e.amount || 0);
        let targetBId = String(e.branch_id || '').trim().toUpperCase();
        if (targetBId === 'PUSAT') targetBId = 'TANGERANG_PUSAT';
        if (activeProcessingBranch === 'SEMUA_CABANG' || targetBId === activeProcessingBranch) { 
          gajiCabangBulanIni += Number(e.amount || 0); 
        }
      }
    });

    let omzet2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => {
      if (isHQ || o.branch_id === currentBranch) { omzet2Minggu += Number(o.total_amount || o.amount_paid || 0); }
    });

    const budgetGaji = omzet2Minggu * 0.20;
    const sisaNafasAnggaran = budgetGaji - gajiGlobal;
    return { kasbonCabang, gajiCabangBulanIni, kasbonGlobal, gajiGlobal, budgetGaji, sisaNafasAnggaran, statusAnggaran: sisaNafasAnggaran >= 0 ? 'AMAN' : 'DEFISIT' };
  }, [globalEmployeeCompiled, expenses, activeProcessingBranch, todayStr, optimisticDeletedIds, realOrders, isHQ, currentBranch]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800">
      
      {/* CARD METRIK */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isHQ ? (
          <div className="bg-slate-900 p-5 rounded-3xl shadow-xl border border-slate-800 md:col-span-2 grid grid-cols-2 gap-4 text-white relative overflow-hidden">
            <Wallet className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" size={100} />
            <div>
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={12}/> Anggaran Amplop Gaji (20%)</div>
              <div className="text-xl font-black tracking-tight mt-1">{formatRupiah(metrikSDM.budgetGaji)}</div>
              <div className="text-[9px] mt-2 font-bold text-slate-400 uppercase">Gaji Terbayar: <span className="text-rose-400">{formatRupiah(metrikSDM.gajiGlobal)}</span></div>
            </div>
            <div>
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft size={12}/> Sisa Anggaran HQ</div>
              <div className={`text-xl font-black tracking-tight mt-1 ${metrikSDM.sisaNafasAnggaran >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatRupiah(metrikSDM.sisaNafasAnggaran)}</div>
              <span className={`text-[8px] mt-2 inline-block px-2.5 py-0.5 rounded font-black uppercase tracking-widest ${metrikSDM.sisaNafasAnggaran >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300 animate-pulse'}`}>{metrikSDM.statusAnggaran}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border shadow-sm border-l-4 border-l-blue-500 md:col-span-2 flex flex-col justify-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gaji Terbayar (Bulan Ini)</div>
            <div className="text-3xl font-black text-blue-600 mt-2">{formatRupiah(metrikSDM.gajiCabangBulanIni)}</div>
          </div>
        )}
        <div className="bg-white p-6 rounded-3xl border shadow-sm border-l-4 border-l-orange-500 flex flex-col justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Piutang Kasbon (Nasional)</div>
          <div className="text-2xl font-black text-orange-600 mt-2 tracking-tight">{formatRupiah(metrikSDM.kasbonGlobal)}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kasbon Area</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">{formatRupiah(metrikSDM.kasbonCabang)}</div>
        </div>
      </div>

      {/* FILTER RADAR CABANG */}
      {isHQ && (
        <div className="bg-white p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between border shadow-sm gap-4">
          <div className="flex items-center gap-2"><Layers size={16} className="text-blue-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilih Radar Cabang SDM:</span></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedBranchFilter('SEMUA_CABANG')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeProcessingBranch === 'SEMUA_CABANG' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🌍 NASIONAL (GABUNGAN)</button>
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeProcessingBranch === brId ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI SUB TABS */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'payroll' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><DollarSign size={14} className="inline mr-1"/> Gaji &amp; Payroll</button>}
        <button onClick={() => setActiveSubTab('lembur')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'lembur' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Clock size={14} className="inline mr-1"/> Lembur &amp; Bonus</button>
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Banknote size={14} className="inline mr-1"/> Kasbon &amp; Kredit</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'master' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Users size={14} className="inline mr-1"/> Master SDM</button>
      </div>

      {/* 🔥 SALURKAN DATA CLOUD KE MASING-MASING KANTONG ANAK BERSIH */}
      {activeSubTab === 'payroll' && isHQ && <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      {activeSubTab === 'lembur' && <LemburModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} totalPorsiHariIni={totalPorsiHariIni} totalPcsHariIni={totalPcsHariIni} />}
      {activeSubTab === 'kasbon' && <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      {activeSubTab === 'master' && <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} setOptimisticDeletedIds={setOptimisticDeletedIds} />}

      {/* ========================================================================= */}
      {/* 🔥 POP-UP SULTAN: ARSIP PROFIL KARYAWAN (DIKEMBALIKAN KE TEMPATNYA!) */}
      {/* ========================================================================= */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex justify-center items-start pt-12 md:pt-16 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border max-w-5xl w-full overflow-hidden flex flex-col mb-10">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2"><Users size={18} className="text-amber-400"/><h3 className="font-black text-sm uppercase tracking-wider">Arsip Profil &amp; Rekam Jejak Karyawan</h3></div>
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[78vh] custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border shadow-inner bg-slate-50 flex items-center justify-center">
                    <img src={selectedEmployeeDetails.photo_url} alt="Profil Full" className="w-full h-full object-contain" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-2">{selectedEmployeeDetails.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">{selectedEmployeeDetails.position.replace('_', ' ')}</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider">CABANG {selectedEmployeeDetails.branch_id.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 space-y-2">
                      <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400 font-mono"/> {selectedEmployeeDetails.phone}</div>
                      <div className="flex items-center gap-2"><Banknote size={14} className="text-slate-400"/> Gaji Standar Master: <span className="text-slate-900 font-black">{formatRupiah(selectedEmployeeDetails.baseSalary)}</span></div>
                      <div className="flex items-center gap-2 text-rose-600"><Wallet size={14}/> Total Sisa Piutang: <span className="font-black">{formatRupiah(selectedEmployeeDetails.sisaHutang)}</span></div>
                    </div>
                  </div>
                  {selectedEmployeeDetails.ktp_url && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1"><Image size={12}/> Arsip KTP</div>
                      <div className="w-full bg-slate-100 border rounded-xl overflow-hidden shadow-inner flex items-center justify-center h-32 cursor-pointer hover:opacity-80 transition" onClick={() => window.open(selectedEmployeeDetails.ktp_url, '_blank')}><img src={selectedEmployeeDetails.ktp_url} alt="KTP" className="w-full h-full object-cover" /></div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="bg-slate-50 border rounded-3xl p-6 shadow-sm">
                    <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-3 mb-4 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600"/> Buku Mutasi Kredit Barang</h4>
                    {selectedEmployeeDetails.history_kredit.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedEmployeeDetails.history_kredit.map((kr, i) => (
                          <div key={i} className={`border p-4 rounded-2xl relative overflow-hidden transition-all ${kr.status === 'LUNAS' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-blue-200 shadow-sm'}`}>
                            {kr.status === 'LUNAS' && <CheckCircle2 className="absolute top-2 right-2 text-emerald-400 opacity-20" size={60} />}
                            <div className="flex gap-3">
                              <div className="w-16 h-16 rounded-xl bg-slate-100 border shrink-0 overflow-hidden cursor-pointer shadow-inner" onClick={() => kr.foto_url && window.open(parseDriveLink(kr.foto_url), '_blank')}>
                                {kr.foto_url ? <img src={parseDriveLink(kr.foto_url)} alt="Barang" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center w-full h-full text-[8px] text-slate-400 text-center font-black">NO FOTO</div>}
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-black text-slate-800 uppercase line-clamp-2">{kr.description}</div>
                                <div className="text-[9px] font-mono text-slate-400 mb-2">{formatDate(kr.date)} | ID: {kr.id}</div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-500">Harga Total:</span><span className="text-slate-900">{formatRupiah(kr.amount)}</span></div>
                                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-500">Terbayar:</span><span className="text-emerald-600">{formatRupiah(kr.terbayar)}</span></div>
                                  <div className="flex justify-between text-[10px] font-black border-t pt-1 mt-1"><span className="text-slate-500">Sisa Piutang:</span><span className="text-rose-600">{formatRupiah(kr.sisa)}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 bg-slate-100/80 p-2.5 rounded-xl border border-slate-200 text-center">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Angsuran</div>
                              <div className={`text-xs font-black mt-0.5 uppercase ${kr.status === 'LUNAS' ? 'text-emerald-600' : 'text-blue-600'}`}>{kr.status === 'LUNAS' ? '✅ LUNAS TERARSIP' : `⏳ CICILAN KE-${kr.cicilanKe} DARI ${kr.tenor} BLN`}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (<div className="text-center py-8 text-xs font-bold text-slate-400 italic bg-white rounded-2xl border border-dashed">Belum ada riwayat kredit barang / cicilan.</div>)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-slate-50 border rounded-3xl p-5 shadow-sm">
                      <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-3 mb-4 flex items-center gap-2"><History size={16} className="text-orange-600"/> Riwayat Kasbon Tunai</h4>
                      {selectedEmployeeDetails.history_kasbon.length > 0 ? (
                        <div className="space-y-3">
                          {selectedEmployeeDetails.history_kasbon.map((ks, i) => (
                            <div key={i} className={`flex flex-col border p-3.5 rounded-2xl gap-2 ${ks.status === 'LUNAS' ? 'bg-slate-100/50' : 'bg-white border-l-4 border-l-orange-500 shadow-sm'}`}>
                              <div className="flex justify-between items-start">
                                <div><div className="text-xs font-black text-slate-800 uppercase">{ks.description}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{formatDate(ks.date)}</div></div>
                                <span className={`px-2 py-1 text-[8px] font-black uppercase rounded-md tracking-wider shadow-sm border ${ks.status === 'LUNAS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{ks.status}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold border-t pt-2 mt-1">
                                <span className="text-slate-500">Nominal: {formatRupiah(ks.amount)}</span>
                                <span className={ks.status === 'LUNAS' ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>Sisa: {formatRupiah(ks.sisa)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (<div className="text-center py-8 text-xs font-bold text-slate-400 italic bg-white rounded-2xl border border-dashed">Tidak ada hutang kasbon aktif.</div>)}
                    </div>

                    <div className="bg-slate-50 border rounded-3xl p-5 shadow-sm">
                      <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-3 mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-emerald-600"/> Arsip Bukti Penggajian</h4>
                      {selectedEmployeeDetails.payroll_list.length > 0 ? (
                        <div className="space-y-3">
                          {selectedEmployeeDetails.payroll_list.map((pr, i) => {
                            const isDescriptionHasPeriod = pr.description && pr.description.includes('Periode:');
                            const extractedPeriod = isDescriptionHasPeriod ? pr.description.split('Periode:')[1].trim().split('(')[0] : formatDate(pr.date);
                            return (
                              <div key={i} className="flex flex-col justify-between bg-white border p-4 rounded-2xl shadow-sm">
                                <div><div className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Periode: {extractedPeriod}</div><div className="text-[9px] font-mono text-slate-400">Tgl Cair: {formatDate(pr.date)}</div></div>
                                <div className="mt-3 pt-3 border-t border-dashed">
                                  <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-500">Gaji Kotor:</span><span className="text-slate-700">{formatRupiah((pr.base_salary||0)+(pr.allowance||0))}</span></div>
                                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-500">Potongan Hutang:</span><span className="text-rose-600">-{formatRupiah(pr.kasbon_deduction)}</span></div>
                                  <div className="flex justify-between text-[11px] font-black mt-2 pt-2 border-t"><span className="text-slate-800 uppercase">Netto Cair:</span><span className="text-emerald-600">{formatRupiah(pr.amount)}</span></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (<div className="text-center py-8 text-xs font-bold text-slate-400 italic bg-white rounded-2xl border border-dashed">Belum ada riwayat penggajian.</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t text-right shrink-0">
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase rounded-xl hover:bg-slate-800 transition-transform active:scale-95 shadow-md tracking-widest">Tutup Arsip Profil Karyawan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
