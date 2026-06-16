import React, { useState, useMemo } from 'react';
import { 
  Users, Wallet, Layers, ArrowRightLeft, Banknote, DollarSign, Clock, 
  X, Phone, Image, Eye, ShoppingCart, CheckCircle2, History, CalendarDays 
} from 'lucide-react';

// 🔥 SAMBUNG KABEL IMPOR: SEJAJAR DI DALAM FOLDER TABS (VERSI AMAN ANTI-ERROR VERCEL)
import PayrollModule from './PayrollModule.jsx';
import LemburModule from './LemburModule.jsx';
import KasbonModule from './KasbonModule.jsx';
import MasterSDMModule from './MasterSDMModule.jsx';

// --- HELPER CENTRAL LOKAL (ANTI CRASH) ---
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
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
    const mapping = { TANGERANG_PUSAT: '🍊 TANGERANG PUSAT' };
    (realMasterBranches || []).forEach(b => {
      if (b && !b.isDeleted && b.branch_id && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT') { 
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${b.branch_name ? b.branch_name.toUpperCase() : b.branch_id.toUpperCase()}`; 
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
      
      let bId = String(k.branch_id || 'TANGERANG_PUSAT').trim().toUpperCase();
      if (bId === 'PUSAT') bId = 'TANGERANG_PUSAT';

      dataStaf[k.id] = {
        id: k.id, name: k.name || 'TANPA NAMA', position: k.position || 'KASIR', baseSalary: Number(k.baseSalary || 0), branch_id: bId, status: k.status || 'AKTIF',
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
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-700 uppercase tracking-wider">
      
      {/* CARD METRIK - FLAT ENTERPRISE STYLE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isHQ ? (
          <div className="card-holo p-6 md:col-span-2 grid grid-cols-2 gap-4 relative overflow-hidden">
            <Wallet className="absolute -right-4 -bottom-4 text-slate-100 pointer-events-none" size={120} />
            <div className="relative z-10">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Wallet size={14} className="text-emerald-500"/> ANGGARAN AMPLOP GAJI (20%)</div>
              <div className="text-2xl font-extrabold tracking-tight mt-1 text-slate-800">{formatRupiah(metrikSDM.budgetGaji)}</div>
              <div className="text-[10px] mt-2 font-medium text-slate-400 uppercase tracking-wider">GAJI TERBAYAR: <span className="text-red-500 font-bold">{formatRupiah(metrikSDM.gajiGlobal)}</span></div>
            </div>
            <div className="relative z-10 border-l border-slate-100 pl-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><ArrowRightLeft size={14} className="text-blue-500"/> SISA ANGGARAN HQ</div>
              <div className={`text-2xl font-extrabold tracking-tight mt-1 ${metrikSDM.sisaNafasAnggaran >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRupiah(metrikSDM.sisaNafasAnggaran)}</div>
              <span className={`text-[9px] mt-2 inline-block px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border shadow-xs ${metrikSDM.sisaNafasAnggaran >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200 animate-pulse'}`}>{metrikSDM.statusAnggaran}</span>
            </div>
          </div>
        ) : (
          <div className="card-holo p-6 md:col-span-2 flex flex-col justify-center border-l-4 border-l-blue-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TOTAL GAJI TERBAYAR (BULAN INI)</div>
            <div className="text-3xl font-extrabold text-blue-600 tracking-tight">{formatRupiah(metrikSDM.gajiCabangBulanIni)}</div>
          </div>
        )}
        <div className="card-holo p-6 flex flex-col justify-center border-l-4 border-l-orange-500">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PIUTANG KASBON (NASIONAL)</div>
          <div className="text-2xl font-extrabold text-orange-600 tracking-tight">{formatRupiah(metrikSDM.kasbonGlobal)}</div>
        </div>
        <div className="card-holo p-6 flex flex-col justify-center border-l-4 border-l-emerald-500">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">KASBON AREA AKTIF</div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatRupiah(metrikSDM.kasbonCabang)}</div>
        </div>
      </div>

      {/* FILTER RADAR CABANG */}
      {isHQ && (
        <div className="card-holo p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Layers size={16} className="text-blue-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">PILIH RADAR CABANG SDM:</span></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedBranchFilter('SEMUA_CABANG')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeProcessingBranch === 'SEMUA_CABANG' ? 'bg-white border border-slate-200 shadow-xs text-red-600' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}>🌍 NASIONAL (GABUNGAN)</button>
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeProcessingBranch === brId ? 'bg-white border border-slate-200 shadow-xs text-red-600' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI SUB TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeSubTab === 'payroll' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent'}`}><DollarSign size={14}/> GAJI &amp; PAYROLL</button>}
        <button onClick={() => setActiveSubTab('lembur')} className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeSubTab === 'lembur' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent'}`}><Clock size={14}/> LEMBUR &amp; BONUS</button>
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeSubTab === 'kasbon' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent'}`}><Banknote size={14}/> KASBON &amp; KREDIT</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${activeSubTab === 'master' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent'}`}><Users size={14}/> MASTER SDM</button>
      </div>

      {/* 🔥 SALURKAN DATA CLOUD KE MASING-MASING KANTONG ANAK BERSIH */}
      {activeSubTab === 'payroll' && isHQ && <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      {activeSubTab === 'lembur' && <LemburModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} totalPorsiHariIni={totalPorsiHariIni} totalPcsHariIni={totalPcsHariIni} />}
      {activeSubTab === 'kasbon' && <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      {activeSubTab === 'master' && <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} setOptimisticDeletedIds={setOptimisticDeletedIds} />}

      {/* ========================================================================= */}
      {/* 🔥 POP-UP SULTAN: ARSIP PROFIL KARYAWAN (FLAT DESIGN) */}
      {/* ========================================================================= */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex justify-center items-start pt-12 md:pt-16 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col mb-10">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2"><Users size={16} className="text-red-600"/><h3 className="font-bold text-sm uppercase tracking-wider text-slate-800">ARSIP PROFIL &amp; REKAM JEJAK KARYAWAN</h3></div>
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-colors"><X size={18}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[78vh] custom-scrollbar bg-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* PROFIL CARD */}
                <div className="space-y-6">
                  <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 flex items-center justify-center">
                    <img src={selectedEmployeeDetails.photo_url} alt="Profil Full" className="w-full h-full object-cover" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-wider mb-2">{selectedEmployeeDetails.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold uppercase tracking-wider">{selectedEmployeeDetails.position.replace('_', ' ')}</span>
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase tracking-wider">CABANG {selectedEmployeeDetails.branch_id.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-600 space-y-2.5 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {selectedEmployeeDetails.phone}</div>
                      <div className="flex items-center gap-2"><CalendarDays size={14} className="text-slate-400"/> GAJI STANDAR: <span className="text-slate-800 font-extrabold">{formatRupiah(selectedEmployeeDetails.baseSalary)}</span></div>
                      <div className="flex items-center gap-2 text-red-600"><Wallet size={14}/> TOTAL SISA PIUTANG: <span className="font-extrabold">{formatRupiah(selectedEmployeeDetails.sisaHutang)}</span></div>
                    </div>
                  </div>
                  {selectedEmployeeDetails.ktp_url && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Image size={12}/> ARSIP KTP</div>
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex items-center justify-center h-32 cursor-pointer hover:opacity-80 transition" onClick={() => window.open(selectedEmployeeDetails.ktp_url, '_blank')}><img src={selectedEmployeeDetails.ktp_url} alt="KTP" className="w-full h-full object-cover" /></div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 space-y-6">
                  
                  {/* BUKU KREDIT BARANG */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600"/> BUKU MUTASI KREDIT BARANG</h4>
                    {selectedEmployeeDetails.history_kredit.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedEmployeeDetails.history_kredit.map((kr, i) => (
                          <div key={i} className={`border p-4 rounded-xl relative overflow-hidden transition-all shadow-xs ${kr.status === 'LUNAS' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            {kr.status === 'LUNAS' && <CheckCircle2 className="absolute top-2 right-2 text-emerald-400 opacity-20" size={60} />}
                            <div className="flex gap-3">
                              <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden cursor-pointer shadow-inner" onClick={() => kr.foto_url && window.open(parseDriveLink(kr.foto_url), '_blank')}>
                                {kr.foto_url ? <img src={parseDriveLink(kr.foto_url)} alt="Barang" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center w-full h-full text-[8px] text-slate-400 text-center font-bold">NO FOTO</div>}
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider line-clamp-2 leading-snug">{kr.description}</div>
                                <div className="text-[9px] text-slate-400 mb-2 font-medium uppercase tracking-wider">{formatDate(kr.date)} | ID: {kr.id}</div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-semibold"><span className="text-slate-500">HARGA TOTAL:</span><span className="text-slate-800 font-bold">{formatRupiah(kr.amount)}</span></div>
                                  <div className="flex justify-between text-[10px] font-semibold"><span className="text-slate-500">TERBAYAR:</span><span className="text-emerald-600 font-bold">{formatRupiah(kr.terbayar)}</span></div>
                                  <div className="flex justify-between text-[10px] font-bold border-t border-slate-100 pt-1 mt-1"><span className="text-slate-500">SISA PIUTANG:</span><span className="text-red-600 font-extrabold">{formatRupiah(kr.sisa)}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">STATUS ANGSURAN</div>
                              <div className={`text-[10px] font-extrabold uppercase tracking-wider ${kr.status === 'LUNAS' ? 'text-emerald-600' : 'text-blue-600'}`}>{kr.status === 'LUNAS' ? '✅ LUNAS TERARSIP' : `⏳ CICILAN KE-${kr.cicilanKe} DARI ${kr.tenor} BLN`}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (<div className="text-center py-6 text-[10px] font-bold text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 uppercase tracking-wider">BELUM ADA RIWAYAT KREDIT BARANG / CICILAN.</div>)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* RIWAYAT KASBON TUNAI */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-xs">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2"><History size={16} className="text-orange-500"/> RIWAYAT KASBON TUNAI</h4>
                      {selectedEmployeeDetails.history_kasbon.length > 0 ? (
                        <div className="space-y-3">
                          {selectedEmployeeDetails.history_kasbon.map((ks, i) => (
                            <div key={i} className={`flex flex-col border border-slate-200 p-3.5 rounded-xl gap-2 shadow-xs ${ks.status === 'LUNAS' ? 'bg-slate-100/50' : 'bg-white border-l-4 border-l-orange-500'}`}>
                              <div className="flex justify-between items-start">
                                <div><div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">{ks.description}</div><div className="text-[9px] text-slate-400 mt-0.5 font-medium">{formatDate(ks.date)}</div></div>
                                <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-md border ${ks.status === 'LUNAS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{ks.status}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-semibold border-t border-slate-100 pt-2 mt-1 uppercase tracking-wider">
                                <span className="text-slate-500">NOMINAL: <span className="font-bold">{formatRupiah(ks.amount)}</span></span>
                                <span className={ks.status === 'LUNAS' ? 'text-emerald-600 font-extrabold' : 'text-red-600 font-extrabold'}>SISA: {formatRupiah(ks.sisa)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (<div className="text-center py-6 text-[10px] font-bold text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 uppercase tracking-wider">TIDAK ADA HUTANG KASBON AKTIF.</div>)}
                    </div>

                    {/* ARSIP BUKTI PENGGAJIAN */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-xs">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-emerald-600"/> ARSIP BUKTI PENGGAJIAN</h4>
                      {selectedEmployeeDetails.payroll_list.length > 0 ? (
                        <div className="space-y-3">
                          {selectedEmployeeDetails.payroll_list.map((pr, i) => {
                            const isDescriptionHasPeriod = pr.description && pr.description.toUpperCase().includes('PERIODE:');
                            const extractedPeriod = isDescriptionHasPeriod ? pr.description.toUpperCase().split('PERIODE:')[1].trim().split('(')[0] : formatDate(pr.date);
                            return (
                              <div key={i} className="flex flex-col justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-emerald-300 transition-colors">
                                <div><div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">PERIODE: {extractedPeriod}</div><div className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">TGL CAIR: {formatDate(pr.date)}</div></div>
                                <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-1 uppercase tracking-wider">
                                  <div className="flex justify-between text-[10px] font-medium"><span className="text-slate-500">GAJI KOTOR:</span><span className="text-slate-700 font-bold">{formatRupiah((pr.base_salary||0)+(pr.allowance||0))}</span></div>
                                  <div className="flex justify-between text-[10px] font-medium"><span className="text-slate-500">POTONGAN HUTANG:</span><span className="text-red-600 font-bold">-{formatRupiah(pr.kasbon_deduction)}</span></div>
                                  <div className="flex justify-between text-[10px] font-bold mt-2 pt-2 border-t border-slate-100"><span className="text-slate-800 uppercase tracking-wider">NETTO CAIR:</span><span className="text-emerald-600 font-extrabold">{formatRupiah(pr.amount)}</span></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (<div className="text-center py-6 text-[10px] font-bold text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 uppercase tracking-wider">BELUM ADA RIWAYAT PENGGAJIAN.</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 text-right shrink-0">
              <button type="button" onClick={() => setSelectedEmployeeDetails(null)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-xs">TUTUP ARSIP PROFIL KARYAWAN</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
