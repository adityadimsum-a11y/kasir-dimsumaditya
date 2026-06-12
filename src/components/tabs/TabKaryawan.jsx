import React, { useState, useMemo } from 'react';
import { Users, Landmark, Banknote, Layers, TrendingDown, ShieldAlert, Trash2, Edit2, Check, X, Phone, Image, Eye, MapPin, Undo, Link, Printer, CalendarDays, History, ShoppingCart, CheckCircle, FileText, Wallet, ArrowRightLeft, Clock, Trophy, Coffee, CheckCircle2, DollarSign, Calculator, ArrowDownToLine, Database } from 'lucide-react';
import { triggerPrint } from '../../utils/PrintUtility';

// --- HUB KUNCI ASESORI FORMATTING & AKUNTANSI ---
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const parseDriveLink = (url) => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/(.*?)\//);
    if (match && match[1]) { return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`; }
  }
  return url;
};

// 🔥 AMUNISI UTAMA: INJEKSI FUNGSI HELPER AMAN ANTI-CRASH LANGSUNG DI TEMPAT
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

const generateId = (prefix, dateStr) => {
  const dStr = dateStr ? dateStr.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dStr}-${randomPart}`;
};

export default function TabKaryawan({ 
  karyawan = [], expenses = [], masterBranches = [], master_branches, cashflowTransactions = [], cashflow_transactions, 
  productionBatches = [], production_batches, orders = [], orders_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- TAB NAVIGATION ---
  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());

  // --- SINKRONISASI DATABASE ---
  const realMasterBranches = master_branches || masterBranches || [];
  const realProductionBatches = production_batches || productionBatches || [];
  const realOrders = orders_data || orders || [];

  // --- PEMETAAN CABANG DINAMIS ---
  const petaNamaCabang = useMemo(() => {
    const mapping = { TANGERANG_PUSAT: '🍊 TANGERANG PUSAT', PUSAT: '🍊 TANGERANG PUSAT' };
    (realMasterBranches || []).forEach(b => {
      if (b && !b.isDeleted && b.branch_id && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT') { 
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${String(b.branch_name || b.branch_id).toUpperCase()}`; 
      }
    });
    return mapping;
  }, [realMasterBranches]);
  const daftarCabangId = useMemo(() => Object.keys(petaNamaCabang), [petaNamaCabang]);

  // --- TARGET PRODUKSI HARIAN (LEMBUR MODULE) - 🔥 FIX LOGIKA PORSI vs PCS ---
  const totalPcsHariIni = useMemo(() => {
    return realProductionBatches.filter(p => {
      const isToday = p.date && p.date.substring(0, 10) === todayStr;
      const isBranch = activeProcessingBranch === 'SEMUA_CABANG' || String(p.branch_id).toUpperCase() === activeProcessingBranch;
      return isToday && isBranch && !p.isDeleted && !optimisticDeletedIds.has(p.id);
    }).reduce((sum, p) => sum + Number(p.actual_yield || p.yield_pcs || p.qty || 0), 0);
  }, [realProductionBatches, activeProcessingBranch, todayStr, optimisticDeletedIds]);

  // Mengubah Pcs menjadi Porsi (1 Porsi = 4 Pcs)
  const totalPorsiHariIni = Math.floor(totalPcsHariIni / 4);

  // --- KOMPILASI DATA KARYAWAN LENGKAP ---
  const globalEmployeeCompiled = useMemo(() => {
    const dataStaf = {};
    (karyawan || []).forEach(k => {
      if (!k || k.isDeleted) return;
      const bId = String(k.branch_id || 'TANGERANG_PUSAT').trim().toUpperCase();
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

  // --- METRIK SDM & ANGGARAN GAJI (INTEGRASI 20% OMZET) ---
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
        if (activeProcessingBranch === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === activeProcessingBranch) { 
          gajiCabangBulanIni += Number(e.amount || 0); 
        }
      }
    });

    // 14 Hari Siklus Omzet 
    let omzet2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => {
      if (isHQ || o.branch_id === currentBranch) {
        omzet2Minggu += Number(o.total_amount || o.amount_paid || 0); // Koreksi ke total_amount
      }
    });

    // Kunci Pagu Anggaran 20%
    const budgetGaji = omzet2Minggu * 0.20;
    const sisaNafasAnggaran = budgetGaji - gajiGlobal;
    const statusAnggaran = sisaNafasAnggaran >= 0 ? 'AMAN' : 'DEFISIT';

    return { kasbonCabang, gajiCabangBulanIni, kasbonGlobal, gajiGlobal, budgetGaji, sisaNafasAnggaran, statusAnggaran };
  }, [globalEmployeeCompiled, expenses, activeProcessingBranch, todayStr, optimisticDeletedIds, realOrders, isHQ, currentBranch]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800">
      
      {/* 🚀 DASHBOARD METRIK TERINTEGRASI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isHQ ? (
          <div className="bg-slate-900 p-5 rounded-3xl shadow-xl border border-slate-800 md:col-span-2 grid grid-cols-2 gap-4 text-white relative overflow-hidden">
            <Wallet className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" size={100} />
            <div className="z-10">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={12}/> Anggaran Amplop Gaji (20%)</div>
              <div className="text-xl font-black tracking-tight mt-1">{formatRupiah(metrikSDM.budgetGaji)}</div>
              <div className="text-[9px] mt-2 font-bold text-slate-400 uppercase tracking-widest">Gaji Terbayar Bulan Ini: <span className="text-rose-400">{formatRupiah(metrikSDM.gajiGlobal)}</span></div>
            </div>
            <div className="z-10">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft size={12}/> Sisa Nafas Anggaran HQ</div>
              <div className={`text-xl font-black tracking-tight mt-1 ${metrikSDM.sisaNafasAnggaran >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatRupiah(metrikSDM.sisaNafasAnggaran)}</div>
              <span className={`text-[8px] mt-2 inline-block px-2.5 py-1 rounded-md font-black uppercase tracking-widest ${metrikSDM.sisaNafasAnggaran >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-rose-500/20 text-rose-300 animate-pulse border border-rose-500/50'}`}>{metrikSDM.statusAnggaran}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 md:col-span-2 flex flex-col justify-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gaji Terbayar Cabang (Bulan Ini)</div>
            <div className="text-3xl font-black text-blue-600 mt-2">{formatRupiah(metrikSDM.gajiCabangBulanIni)}</div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500 flex flex-col justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Piutang Kasbon (Nasional)</div>
          <div className="text-2xl font-black text-orange-600 mt-2 tracking-tight">{formatRupiah(metrikSDM.kasbonGlobal)}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kasbon Area ({activeProcessingBranch.replace('_', ' ')})</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">{formatRupiah(metrikSDM.kasbonCabang)}</div>
        </div>
      </div>

      {isHQ && (
        <div className="bg-white p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between border border-slate-200 shadow-sm gap-4">
          <div className="flex items-center gap-2 mb-1 md:mb-0"><Layers size={16} className="text-blue-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilih Radar Cabang SDM:</span></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedBranchFilter('SEMUA_CABANG')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeProcessingBranch === 'SEMUA_CABANG' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🌍 NASIONAL (GABUNGAN)</button>
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeProcessingBranch === brId ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* 🚀 NAVIGASI SUB TABS MEWAH */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'payroll' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><DollarSign size={14} className="inline mr-1"/> Gaji &amp; Payroll</button>}
        <button onClick={() => setActiveSubTab('lembur')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'lembur' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Clock size={14} className="inline mr-1"/> Lembur &amp; Bonus</button>
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Banknote size={14} className="inline mr-1"/> Kasbon &amp; Kredit</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${activeSubTab === 'master' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Users size={14} className="inline mr-1"/> Master SDM</button>
      </div>

      {activeSubTab === 'payroll' && isHQ && <PayrollModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      
      {/* Parsing total Pcs dan Porsi untuk Modul Lembur */}
      {activeSubTab === 'lembur' && <LemburModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} totalPorsiHariIni={totalPorsiHariIni} totalPcsHariIni={totalPcsHariIni} />}
      
      {activeSubTab === 'kasbon' && <KasbonModule employees={employeesDiCabangAktif} expenses={expenses} globalCompiled={globalEmployeeCompiled} activeBranch={activeProcessingBranch} todayStr={todayStr} sendToSheet={sendToSheet} onViewDetails={setSelectedEmployeeDetails} user={user} setOptimisticDeletedIds={setOptimisticDeletedIds} isHQ={isHQ} showToast={showToast} optimisticDeletedIds={optimisticDeletedIds} />}
      {activeSubTab === 'master' && <MasterSDMModule employees={employeesDiCabangAktif} branchListId={daftarCabangId} branchMapName={petaNamaCabang} activeBranch={activeProcessingBranch} isHQ={isHQ} sendToSheet={sendToSheet} showToast={showToast} onViewDetails={setSelectedEmployeeDetails} setOptimisticDeletedIds={setOptimisticDeletedIds} />}

      {/* POP-UP SULTAN: ARSIP PROFIL KARYAWAN */}
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
                      <div className="flex items-center gap-2"><Landmark size={14} className="text-slate-400"/> Gaji Standar Master: <span className="text-slate-900 font-black">{formatRupiah(selectedEmployeeDetails.baseSalary)}</span></div>
                      <div className="flex items-center gap-2 text-rose-600"><Banknote size={14}/> Total Sisa Piutang: <span className="font-black">{formatRupiah(selectedEmployeeDetails.sisaHutang)}</span></div>
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

// =========================================================================
// 📇 SUB-COMPONENT 1: PAYROLL (DENGAN OTOMATISASI POTONG KAS DOMPET)
// =========================================================================
function PayrollModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds }) {
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

  React.useEffect(() => {
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
            // 🔥 FIX KABEL CRASH (fontMethod TYPO DIHAPUS)
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
            <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" disabled={isEditing || !form.employeeId} checked={form.isProrata} onChange={e => { setForm({...form, isProrata: e.target.checked, baseSalary: e.target.checked ? String(Math.floor((Number(form.hariHadir)/Number(form.hariNormal))*masterGapok)) : String(masterGapok)}); }} className="w-4 h-4 accent-slate-800 cursor-pointer" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5"><Calculator size={14}/> Potong Gaji Prorata (Cuti / Izin tak dibayar)</span></label>
            {form.isProrata && (
              <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in">
                <div><label className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">Standar Kerja Sebulan</label><input type="number" min="1" max="31" value={form.hariNormal} onChange={e=>setForm({...form, hariNormal: e.target.value})} className="w-full p-2.5 border border-slate-200 bg-white rounded-xl text-sm font-black text-center outline-none focus:border-slate-400" /></div>
                <div><label className="text-[9px] font-black tracking-widest text-blue-600 uppercase block mb-1">Faktual Hadir Bekerja</label><input type="number" min="0" max="31" value={form.hariHadir} onChange={e=>setForm({...form, hariHadir: e.target.value})} className="w-full p-2.5 border border-blue-300 bg-blue-50 rounded-xl text-sm font-black text-center text-blue-800 outline-none focus:bg-white focus:border-blue-500" /></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between items-center tracking-widest block mb-1">Gaji Pokok {form.isProrata && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-black">Auto</span>}</label>
              <input type="text" required value={formatRupiah(form.baseSalary)} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className={`w-full p-3 border rounded-xl font-black text-sm outline-none transition-colors ${form.isProrata ? 'bg-emerald-50 text-emerald-900 border-emerald-200 focus:bg-white' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-400'}`} />
              {form.isProrata && totalMinusProrata > 0 && (<div className="text-[8px] font-black text-rose-500 mt-1.5 uppercase tracking-widest">Kepotong: -{formatRupiah(totalMinusProrata)}</div>)}
            </div>
            <div><label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Bonus/Tunjangan</label><input type="text" required value={formatRupiah(form.allowance)} onChange={e=>setForm({...form, allowance: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border border-blue-200 rounded-xl font-black text-sm bg-blue-50/50 outline-none focus:bg-white focus:border-blue-500 transition-colors" /></div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 shadow-inner">
            <div className="flex justify-between items-end mb-2"><label className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center gap-1.5"><History size={14}/> Potong Cicilan Kredit / Kasbon</label><span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 uppercase tracking-wider">Hutang Aktif: {formatRupiah(sisaHutangReal)}</span></div>
            <input type="text" value={formatRupiah(form.potKasbonInput)} onChange={e=>setForm({...form, potKasbonInput: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border-2 border-orange-200 bg-white rounded-xl font-black text-sm text-orange-800 outline-none focus:border-orange-400 transition-colors" placeholder="Rp 0" />
            <div className="text-[9px] font-black text-orange-600 mt-2.5 uppercase tracking-widest leading-relaxed">💡 Limit Angsuran Aman (30% Gaji): {formatRupiah(batasAmanKredit)}<br/>Rekomendasi Auto-Potong Sistem: {formatRupiah(rekomendasiCicilanSistem)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Potongan Lainnya</label><input type="text" required value={formatRupiah(form.otherDeduction)} onChange={e=>setForm({...form, otherDeduction: e.target.value.replace(/\D/g, '')})} className="w-full p-3 border border-rose-200 rounded-xl font-black text-sm bg-rose-50 outline-none focus:bg-white focus:border-rose-400 transition-colors text-rose-800" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sumber Kas Uang Gaji</label><select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl font-black text-xs bg-slate-50 outline-none cursor-pointer focus:border-blue-400"><option value="TF">TRANSFER BANK (REK PUSAT)</option><option value="CASH">CASH TUNAI (LACI CABANG)</option></select></div>
          </div>

          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800 relative overflow-hidden mt-2">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10 pointer-events-none" size={120} />
            <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1.5 mb-1"><CheckCircle2 size={12}/> Total Gaji Bersih (Take Home Pay)</div>
            <div className="text-3xl font-black tracking-tight">{formatRupiah(hitungNetto.totalCair)}</div>
          </div>
          <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mt-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-900'}`}>{isEditing ? '💾 Update Lembar Gaji' : 'Cairkan & Potong Kas Dompet'}</button>
        </form>
      </div>
      
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-500"/> Histori Penggajian {activeBranch === 'SEMUA_CABANG' ? 'NASIONAL (GABUNGAN)' : `AREA ${activeBranch.replace('_', ' ')}`}</div>
        <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">Periode / ID</th><th className="px-5 py-3 font-black">Karyawan Penerima</th><th className="px-5 py-3 font-black text-right">Gaji Kotor + Tunjangan</th><th className="px-5 py-3 font-black text-right text-orange-600">Cicilan / Kasbon</th><th className="px-5 py-3 font-black text-right text-emerald-600">Netto Cair Riil</th><th className="px-5 py-3 font-black text-center">Aksi Operasional</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historyGaji.length === 0 ? (
                 <tr><td colSpan="6" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum ada riwayat penggajian tercatat pada buku ini.</td></tr>
              ) : (
                historyGaji.map(p => {
                  const emp = globalCompiled[p.employee_id];
                  const isDescPeriod = p.description && p.description.includes('Periode:');
                  const extractedPeriod = isDescPeriod ? p.description.split('Periode:')[1].trim().split('(')[0] : formatDate(p.date);
                  const isProrataLog = p.description && p.description.includes('Prorata');
                  const stringProrataCut = isProrataLog && p.description.match(/Potong: Rp (\d+)/);
                  const valProrata = stringProrataCut ? Number(stringProrataCut[1]) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-sm uppercase">{extractedPeriod}</div><div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div></td>
                      <td onClick={() => emp && onViewDetails(emp)} className="px-5 py-4 flex items-center gap-3 cursor-pointer">
                        <img src={emp?.photo_url} alt="Profile" className="w-10 h-10 rounded-xl object-cover border shadow-sm group-hover:scale-105 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                        <div><span className="uppercase font-black text-slate-800 group-hover:text-blue-600 transition-colors block tracking-wide">{emp?.name || 'STAF KARYAWAN'}</span>{activeBranch === 'SEMUA_CABANG' && <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mt-1 block">LOKASI NODE: {emp?.branch_id.replace('_', ' ')}</span>}</div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600">{formatRupiah((p.base_salary||0)+(p.allowance||0))}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-orange-600">{formatRupiah(p.kasbon_deduction)}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-emerald-600 font-black text-sm flex items-center justify-end gap-1.5"><ArrowDownToLine size={12}/> {formatRupiah(p.amount)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                            title: 'SLIP GAJI RESMI KARYAWAN', id: p.id, date: formatDate(p.date), periode: extractedPeriod,
                            branch_name: emp?.branch_id || activeBranch, admin_name: user?.name || 'ADMIN HRD', customer_name: emp?.name || 'STAF', position: emp?.position.replace('_', ' ') || 'STAF',
                            items: [
                              { name: 'Gaji Pokok Master Bulanan', qty: 1, subtotal: (p.base_salary || 0) + valProrata }, 
                              ...(isProrataLog ? [{ name: 'Potongan Absensi (Cuti/Izin Prorata)', qty: 1, subtotal: -valProrata }] : []),
                              { name: 'Bonus Kedisiplinan & Tunjangan', qty: 1, subtotal: (p.allowance || 0) },
                              { name: 'Potongan Angsuran Kasbon / Kredit', qty: 1, subtotal: -(p.kasbon_deduction || 0) },
                              { name: 'Denda / Potongan Lain-Lain', qty: 1, subtotal: -(p.other_deduction || 0) }
                            ], amount: p.amount, paymentMethod: p.payment_method || 'CASH TUNAI',
                            history: { kasbonList: [...(emp?.history_kredit || []), ...(emp?.history_kasbon || [])].slice(0, 3), labelLama: 'Akumulasi Total Sisa Hutang Awal', nominalLama: (emp?.sisaHutang || 0) + (p.kasbon_deduction || 0), labelAksi: 'Dipotong Untuk Angsuran Bulan Ini', nominalAksi: p.kasbon_deduction || 0, labelBaru: 'SISA HUTANG AKTIF SEKARANG', nominalBaru: emp?.sisaHutang || 0 }
                          })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Cetak Slip Gaji Printer Kasir"><Printer size={16}/></button>
                          
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

// =========================================================================
// 📇 SUB-COMPONENT 2: LEMBUR & BONUS HARIAN (UI MERGER)
// =========================================================================
function LemburModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds, totalPorsiHariIni, totalPcsHariIni }) {
  const [form, setForm] = useState({ date: todayStr, picId: '', participants: [], isLembur: false, isBonus: false, isJamuan: false });
  
  React.useEffect(() => {
    if (!form.picId && employees.length > 0) {
      const leader = employees.find(e => e.position === 'LEADER_TIM' || e.position === 'KEPALA_DAPUR');
      if (leader) setForm(p => ({ ...p, picId: leader.id }));
    }
  }, [employees, form.picId]);

  const toggleParticipant = (empId) => {
    setForm(prev => {
      const current = prev.participants;
      if (current.includes(empId)) return { ...prev, participants: current.filter(id => id !== empId) };
      return { ...prev, participants: [...current, empId] };
    });
  };

  const historyLembur = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && !optimisticDeletedIds.has(e.id) && e.category === 'LEMBUR_BONUS' && (targetBId === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === targetBId)).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch, optimisticDeletedIds]);

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin membatalkan/void data pencairan lembur & bonus tim ini?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id)); const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { if(showToast) showToast('Data lembur berhasil dibatalkan.', 'success'); } else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  // 🔥 TARGET BONUS PRODUKSI MENGUNCI KE 10.000 PCS = 2.500 PORSI (SINKRON DOKTRIN PABRIK)
  const isTargetTembus = totalPorsiHariIni >= 2500;
  const qtyPeserta = form.participants.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-3xl border border-t-4 border-t-blue-600 h-max shadow-sm">
        
        {isTargetTembus ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1">🎉</div><div><div className="font-black uppercase text-base tracking-widest text-emerald-700">Bonus Target Tembus!</div><div className="text-[10px] font-bold mt-1 text-emerald-700/80 uppercase leading-relaxed tracking-wide">Adukan dapur berhasil mencapai <b>{formatNumber(totalPorsiHariIni)} Porsi</b> (Atau {formatNumber(totalPcsHariIni)} Pcs). Silakan klaim bonus Omset Rp 20.000 per Kepala!</div></div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1 opacity-50">⏳</div><div><div className="font-black uppercase text-base tracking-widest text-slate-700">Target Belum Tercapai</div><div className="text-[10px] font-bold mt-1 text-slate-500 uppercase leading-relaxed tracking-wide">Adukan dapur hari ini baru tercetak <b>{formatNumber(totalPorsiHariIni)} Porsi</b> ({formatNumber(totalPcsHariIni)} Pcs). Butuh &gt;2500 Porsi untuk membuka kunci bonus omset.</div></div>
          </div>
        )}

        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.picId) return;
          if ((form.isLembur || form.isBonus) && qtyPeserta === 0) return alert("Wajib memilih minimal 1 orang peserta lembur/bonus dari daftar di bawah!");

          const expenseId = generateId('LMB', form.date);
          const empData = globalCompiled[form.picId];
          const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? empData?.branch_id : activeBranch;
          
          let subLembur = form.isLembur ? 30000 * qtyPeserta : 0;
          let subBonus = form.isBonus ? 20000 * qtyPeserta : 0;
          let subJamuan = form.isJamuan ? 100000 : 0;
          let totalCair = subLembur + subBonus + subJamuan;

          if (totalCair === 0) return alert("Pilih minimal satu kotak komponen klaim di bawah!");

          const participantNames = form.participants.map(id => globalCompiled[id]?.name).join(', ');
          let descText = [];
          if(form.isLembur) descText.push(`Uang Lembur ${qtyPeserta} Org`);
          if(form.isBonus) descText.push(`Bonus Target ${qtyPeserta} Org`);
          if(form.isJamuan) descText.push('Dana Jamuan Tim Shift');
          const deskripsiFinal = `${descText.join(' + ')}. Peserta Absen: ${participantNames || 'Tim Global'}`;

          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, employee_id: form.picId, category: 'LEMBUR_BONUS', amount: totalCair, description: deskripsiFinal };
          
          const success = await sendToSheet('insert', payload, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: penempatanTrx, type: 'OUT', category: 'UANG LEMBUR & BONUS', amount: totalCair, method: 'CASH', reference_id: expenseId, description: `Pencairan Lembur/Bonus Tim Dapur & Outlet (PIC Pencairan: ${empData?.name})` }, 'cashflow_transactions');
            setForm({ date: todayStr, picId: '', participants: [], isLembur: false, isBonus: false, isJamuan: false });
            if (showToast) showToast('Dana lembur/bonus sukses dicairkan! Uang fisik laci kasir otomatis terpotong.', 'success');
          }
        }} className="space-y-4">
          
          <div><label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block mb-1">Tgl Eksekusi Cair</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" /></div>
          
          <div>
            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1.5">1. Penanggung Jawab (PIC Penerima Uang Tunai)</label>
            <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-3 border border-blue-200 bg-blue-50/50 rounded-xl font-black text-xs uppercase outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors"><option value="">-- Pilih Leader Tim / Penanggung Jawab --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace('_', ' ')}) - CAB {k.branch_id}</option>)}</select>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
            <label className="text-[10px] font-black text-slate-700 uppercase mb-3 flex items-center gap-1.5 tracking-widest"><Users size={14} className="text-blue-500"/> 2. Daftar Peserta Anggota Tim ({qtyPeserta} Orang Hadir)</label>
            <div className="flex flex-wrap gap-2.5">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all ${form.participants.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}>
                  <input type="checkbox" className="hidden" checked={form.participants.includes(emp.id)} onChange={() => toggleParticipant(emp.id)} />
                  {emp.name}
                </label>
              ))}
            </div>
            {qtyPeserta === 0 && <div className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-4 italic">*Wajib tap / klik nama anggota tim di atas untuk mendaftarkan absen peserta lembur.</div>}
          </div>

          <div className="space-y-3 mt-4">
            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isLembur ? 'border-blue-400 bg-blue-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.isLembur} onChange={e=>setForm({...form, isLembur: e.target.checked})} className="w-4 h-4 accent-blue-600 cursor-pointer"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Clock size={14} className="text-blue-600"/> Jam Lembur Lewat 17:00 WIB</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Uang lembur tambahan per kepala</div></div>
              </div>
              <div className="font-black text-blue-600 text-sm bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">Rp 30.000</div>
            </label>

            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isBonus ? 'border-emerald-400 bg-emerald-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" disabled={!isTargetTembus} checked={form.isBonus} onChange={e=>setForm({...form, isBonus: e.target.checked})} className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:opacity-50"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Trophy size={14} className={isTargetTembus ? "text-emerald-600" : "text-slate-400"}/> Bonus Omset Target Harian</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Bonus apresiasi tembus target per kepala</div></div>
              </div>
              <div className={`font-black text-sm bg-white px-3 py-1.5 rounded-lg border shadow-sm ${isTargetTembus ? 'text-emerald-600 border-emerald-100' : 'text-slate-400 border-slate-100'}`}>Rp 20.000</div>
            </label>

            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isJamuan ? 'border-orange-400 bg-orange-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.isJamuan} onChange={e=>setForm({...form, isJamuan: e.target.checked})} className="w-4 h-4 accent-orange-500 cursor-pointer"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Coffee size={14} className="text-orange-600"/> Uang Dana Jamuan / Konsumsi Tim</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Pengeluaran beli makanan global (bukan perorangan)</div></div>
              </div>
              <div className="font-black text-orange-600 text-sm bg-white px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">Rp 100.000</div>
            </label>
          </div>

          <button type="submit" disabled={!form.picId} className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl text-xs uppercase disabled:opacity-40 shadow-xl hover:bg-slate-800 transition-transform active:scale-95 mt-4 tracking-widest flex items-center justify-center gap-2">
            <DollarSign size={16}/> Cairkan Uang &amp; Cetak Bukti Nota Kasir
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><Clock size={16} className="text-blue-500"/> Arsip Bukti Pencairan Lembur &amp; Bonus Tim Operasional</div>
        <div className="overflow-x-auto p-2 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">Waktu Cair &amp; ID</th><th className="px-5 py-3 font-black">Penerima Dana Tunai (PIC)</th><th className="px-5 py-3 font-black">Rincian Komponen Diklaim</th><th className="px-5 py-3 font-black text-right">Total Uang Cair</th><th className="px-5 py-3 font-black text-center">Aksi Operasional</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historyLembur.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum ada aktivitas klaim lembur atau bonus di area cabang ini.</td></tr>
              ) : (
                historyLembur.map(log => {
                  const emp = globalCompiled[log.employee_id];
                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-sm">{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div></td>
                      <td className="px-5 py-4 whitespace-nowrap"><div className="uppercase text-blue-700 font-black text-xs tracking-wide">{emp?.name || 'TIM OPERASIONAL / KEPALA'}</div><div className="text-[8px] font-black tracking-widest text-slate-400 mt-1.5 uppercase">LOKASI CABANG: {emp?.branch_id.replace('_', ' ') || activeBranch.replace('_', ' ')}</div></td>
                      <td className="px-5 py-4 text-[10px] text-slate-600 leading-relaxed uppercase max-w-sm">{log.description}</td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-black whitespace-nowrap text-sm flex items-center justify-end gap-1.5"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                            title: 'SLIP BUKTI PENCAIRAN LEMBUR & BONUS TIM', id: log.id, date: formatDate(log.date), periode: formatDate(log.date).substring(3),
                            branch_name: emp?.branch_id || activeBranch, admin_name: user?.name || 'ADMIN HRD', customer_name: emp?.name || 'P. JAWAB TIM', position: emp?.position.replace('_', ' ') || 'STAF',
                            items: [{ name: `Pencairan Tunai:\n${log.description}`, qty: 1, subtotal: log.amount }], amount: log.amount, paymentMethod: 'POTONG KAS LACI TUNAI FISIK'
                          })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Cetak Ulang Slip Nota"><Printer size={16}/></button>
                          
                          {isHQ && (<button type="button" onClick={() => handleDelete(log.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Void & Batalkan Data"><Trash2 size={16}/></button>)}
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

// =========================================================================
// 📇 SUB-COMPONENT 3: KREDIT BARANG & KASBON (UI MERGER)
// =========================================================================
function KasbonModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds }) {
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

// =========================================================================
// 📇 SUB-COMPONENT 4: MASTER DATA SDM (UI MERGER)
// =========================================================================
function MasterSDMModule({ employees, branchListId, branchMapName, activeBranch, isHQ, sendToSheet, showToast, onViewDetails, setOptimisticDeletedIds }) {
  const [form, setForm] = useState({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' });
  const [isEditingMode, setIsEditingMode] = useState(false);

  const handleTriggerEditPencil = (k) => {
    setForm({ id: k.id, name: k.name, position: k.position, baseSalary: String(k.baseSalary || 0), targetBranch: k.branch_id, phone: k.phone === '-' ? '' : k.phone, address: k.address === 'ALAMAT BELUM DIISI' ? '' : k.address, photo_url: k.raw_photo_link || '', ktp_url: k.raw_ktp_link || '' });
    setIsEditingMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (showToast) showToast(`Data SDM staf ${k.name} siap untuk dikoreksi/edit!`, 'success');
  };

  const handleDeleteEmployeeInstantly = async (k) => {
    if (window.confirm(`PERINGATAN KRUSIAL: Apakah Anda yakin 100% ingin menghapus secara permanen data profil staf "${k.name}" dari sistem cloud?`)) {
      setOptimisticDeletedIds(prev => new Set(prev).add(k.id));
      const success = await sendToSheet('delete', { id: k.id }, 'karyawan');
      if (success) { if (showToast) showToast(`Profil Staf SDM ${k.name} telah dihanguskan dari sistem.`, 'success'); } 
      else { setOptimisticDeletedIds(prev => { const newSet = new Set(prev); newSet.delete(k.id); return newSet; }); if (showToast) showToast('Gagal menghapus ke server.', 'error'); }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-sm h-max ${isEditingMode ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 border-t-4 border-t-emerald-500'}`}>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.name) return; const penempatan = isHQ ? form.targetBranch : activeBranch;
          const payload = { name: form.name.toUpperCase(), position: form.position, baseSalary: Number(form.baseSalary || 0), branch_id: penempatan, status: 'AKTIF', phone: form.phone || '-', address: form.address || 'ALAMAT BELUM DIISI', photo_url: form.photo_url || '', ktp_url: form.ktp_url || '' };
          let success = false;
          if (isEditingMode && form.id) { payload.id = form.id; success = await sendToSheet('update', payload, 'karyawan'); } else { payload.id = generateId('EMP', todayStr); success = await sendToSheet('insert', payload, 'karyawan'); }
          if (success) { 
            setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); setIsEditingMode(false); 
            if (showToast) showToast(isEditingMode ? 'Data karyawan sukses diupdate!' : 'Pendaftaran pegawai baru berhasil disahkan!', 'success');
          }
        }} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-xs uppercase tracking-widest text-slate-800 flex items-center gap-2"><Users size={16} className={isEditingMode ? "text-amber-500" : "text-emerald-500"}/> {isEditingMode ? `🔄 Update Form Profil: ${form.name}` : 'Registrasi Masuk Pegawai Baru SDM'}</h3>{isEditingMode && <button type="button" onClick={() => { setIsEditingMode(false); setForm({ id: '', name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'TANGERANG_PUSAT', phone: '', address: '', photo_url: '', ktp_url: '' }); }} className="text-[10px] font-black uppercase text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 bg-white shadow-sm hover:bg-slate-50 tracking-widest transition-colors">Batal Update</button>}</div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Lengkap Sesuai KTP</label><input type="text" required readOnly={isEditingMode} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className={`w-full p-3 border rounded-xl text-xs uppercase font-black outline-none transition-colors ${isEditingMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-slate-50 focus:bg-white focus:border-emerald-400'}`} placeholder="Ketik nama lengkap..." /></div>
            
            {isHQ && (
              <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Penempatan Node Kerja Cabang</label>
                <select disabled={isEditingMode} value={form.targetBranch} onChange={e=>setForm({...form, targetBranch: e.target.value})} className={`w-full p-3 border rounded-xl text-xs uppercase font-black outline-none cursor-pointer transition-colors ${isEditingMode ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 focus:bg-white focus:border-emerald-400'}`}>
                  {branchListId.map(br => <option key={br} value={br}>{branchMapName[br]}</option>)}
                </select>
              </div>
            )}
            
            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Posisi Jabatan Struktural Kerja</label><select value={form.position} onChange={e=>setForm({...form, position: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-black uppercase outline-none cursor-pointer focus:bg-white focus:border-emerald-400 transition-colors">
               <option value="LEADER_TIM">LEADER TIM / KEPALA KORDINATOR</option>
               <option value="KASIR">KASIR POS / FRONT STAFF</option>
               <option value="DAPUR_RESTO">COOK / DAPUR RESTO CABANG</option>
               <option value="WAITRESS">PRAMUSAJI / WAITRESS JAGA</option>
               <option value="PRODUKSI_PABRIK">STAFF ADONAN PRODUKSI PABRIK PUSAT</option>
               <option value="DRIVER">SUPIR EKSPEDISI LOGISTIK ARMADA</option>
            </select></div>

            <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Standar Gaji Pokok Master / Bulan</label>
              <div className="relative"><span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span><input type="text" required value={form.baseSalary ? Number(form.baseSalary).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full pl-10 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl font-black text-sm outline-none focus:border-emerald-400 focus:bg-white transition-colors" placeholder="0" /></div>
            </div>
          </div>

          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">No. Handphone / WhatsApp Aktif</label><input type="text" required placeholder="Contoh: 081234567" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:bg-white transition-colors" /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Alamat Tinggal / Domisili KTP Saat Ini</label><textarea required rows="2" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-400 focus:bg-white transition-colors" placeholder="Isi detail alamat jalan, RT/RW..."></textarea></div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-inner mt-2">
            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Link size={12}/> Link URL Foto Profil (G-Drive)</label><input type="text" placeholder="Paste link URL foto wajah untuk ID Card..." value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})} className="w-full p-3 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:border-emerald-400 transition-colors" /></div>
            <div><label className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Link size={12}/> Link URL Berkas Scan KTP</label><input type="text" placeholder="Paste link URL scan KTP asli..." value={form.ktp_url} onChange={e => setForm({...form, ktp_url: e.target.value})} className="w-full p-3 border border-orange-200 bg-orange-50 rounded-xl text-xs outline-none focus:border-orange-400 focus:bg-white transition-colors" /></div>
          </div>

          <button type="submit" className={`w-full text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 mt-4 ${isEditingMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{isEditingMode ? '💾 Terapkan & Update Perubahan Data Master' : 'Daftarkan Formulir Pegawai Baru'}</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><Database size={16} className="text-emerald-500"/> Buku Database Karyawan Aktif &amp; Arsip Lulus ({activeBranch === 'SEMUA_CABANG' ? 'SKALA NASIONAL' : `AREA ${activeBranch.replace('_', ' ')}`})</div>
        <div className="overflow-x-auto p-2 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">Profil Karyawan (Klik Untuk Arsip)</th><th className="px-5 py-3 font-black">Posisi Jabatan &amp; Standar Gaji Master</th><th className="px-5 py-3 font-black text-center">Status Kepegawaian</th><th className="px-5 py-3 font-black text-center">Aksi Operasional Master</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {employees.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum ada satupun data karyawan terdaftar di node ini.</td></tr>
              ) : (
                employees.map(k => (
                  <tr key={k.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td onClick={() => onViewDetails(k)} className="px-5 py-4 flex items-center gap-4 cursor-pointer">
                      <img src={k.photo_url} alt="Ava Profil" className="w-12 h-12 rounded-2xl object-cover border shadow-sm group-hover:scale-110 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                      <div>
                        <div className="font-black text-slate-800 uppercase group-hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-sm">{k.name} <Eye size={12} className="text-slate-300 inline"/></div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1 font-black">NO WA: {k.phone} {activeBranch === 'SEMUA_CABANG' && <span className="text-slate-500 font-black tracking-widest ml-1 uppercase">| CABANG: {k.branch_id.replace('_', ' ')}</span>}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase w-max mb-1.5 border tracking-wider shadow-sm ${k.position==='LEADER_TIM'?'bg-blue-50 text-blue-700 border-blue-200':'bg-slate-50 text-slate-700 border-slate-200'}`}>{k.position.replace('_', ' ')}</div>
                      <div className="text-slate-800 font-black text-sm">{formatRupiah(k.baseSalary)} / Bulan</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border tracking-wider shadow-sm ${k.status === 'AKTIF' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{k.status}</span>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => handleTriggerEditPencil(k)} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-colors shadow-sm" title="Edit Data Profil"><Edit2 size={16}/></button>
                        <button type="button" onClick={() => handleDeleteEmployeeInstantly(k)} className="p-2.5 text-slate-500 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-colors shadow-sm" title="Hapus Permanen Keberadaan Staf"><Trash2 size={16}/></button>
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
