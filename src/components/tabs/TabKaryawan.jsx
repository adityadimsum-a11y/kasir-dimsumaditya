import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle, Banknote, Landmark, UserPlus, Layers, TrendingDown, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

// UPGRADE: Menambahkan cashflow_transactions ke dalam parameter komponen
export default function TabKaryawan({ karyawan, expenses, master_branches, cashflow_transactions, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  // State Form Input
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const [formMaster, setFormMaster] = useState({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT' });
  const [formPayroll, setFormPayroll] = useState({ 
    date: todayStr, 
    employeeId: '', 
    baseSalary: '0', 
    allowance: '0', 
    otherDeduction: '0', 
    paymentMethod: 'CASH' 
  });

  const formatRupiahLokal = (angka) => {
    return "Rp. " + Number(angka || 0).toLocaleString('id-ID');
  };

  // 1. MAP DYNAMIC BRANCH NAME
  const petaNamaCabang = useMemo(() => {
    const mapping = { PUSAT: '🍊 TANGERANG PUSAT' };
    (master_branches || []).forEach(b => {
      if (!b.isDeleted && b.branch_id) {
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${String(b.branch_name).toUpperCase()}`;
      }
    });
    return mapping;
  }, [master_branches]);

  const daftarCabangId = useMemo(() => {
    return Object.keys(petaNamaCabang);
  }, [petaNamaCabang]);

  // 2. ENGINE EVALUASI HUTANG & KASBON KARYAWAN GLOBAL
  const masterEmployeeDataGlobal = useMemo(() => {
      const balances = {};
      
      (karyawan || []).forEach(k => {
          if (k.isDeleted) return;
          balances[k.id] = { 
            id: k.id, 
            name: k.name || 'TANPA NAMA', 
            position: k.position || 'STAF', 
            baseSalary: Number(k.baseSalary || 0),
            branch_id: String(k.branch_id).trim().toUpperCase(), 
            totalKasbon: 0, 
            totalDibayar: 0, 
            sisaHutang: 0 
          };
      });

      (expenses || []).forEach(e => {
          if (e.isDeleted || !e.employee_id || !balances[e.employee_id]) return;
          if (e.category === 'KASBON') {
              balances[e.employee_id].totalKasbon += Number(e.amount || 0);
          }
          if (e.category === 'PAYROLL') {
              balances[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0);
          }
      });

      Object.values(balances).forEach(b => {
          b.sisaHutang = Math.max(0, b.totalKasbon - b.totalDibayar);
      });

      return balances;
  }, [karyawan, expenses]);

  const activeEmployees = useMemo(() => {
    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    return Object.values(masterEmployeeDataGlobal).filter(k => k.branch_id === targetBId);
  }, [masterEmployeeDataGlobal, activeProcessingBranch]);

  // 3. HITUNG REALISASI BEBAN GAJI LOKAL VS GLOBAL
  const ringkasanFinansialSDM = useMemo(() => {
    let kasbonCabangIni = 0;
    let gajiCabangIniBulanIni = 0;
    let kasbonGlobalSeluruhPerusahaan = 0;
    let gajiGlobalSeluruhPerusahaan = 0;

    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    const curMonth = todayStr.substring(0, 7);

    Object.values(masterEmployeeDataGlobal).forEach(emp => {
      kasbonGlobalSeluruhPerusahaan += emp.sisaHutang;
      if (emp.branch_id === targetBId) {
        kasbonCabangIni += emp.sisaHutang;
      }
    });

    (expenses || []).forEach(e => {
      if (e.isDeleted) return;
      const bId = String(e.branch_id || '').trim().toUpperCase();
      
      if (e.category === 'PAYROLL' && e.date.startsWith(curMonth)) {
        const totalNettoDiberikan = Number(e.amount || 0);
        gajiGlobalSeluruhPerusahaan += totalNettoDiberikan;
        if (bId === targetBId) {
          gajiCabangIniBulanIni += totalNettoDiberikan;
        }
      }
    });

    return { kasbonCabangIni, gajiCabangIniBulanIni, kasbonGlobalSeluruhPerusahaan, gajiGlobalSeluruhPerusahaan };
  }, [masterEmployeeDataGlobal, expenses, activeProcessingBranch, todayStr]);

  // ========================================================
  // 🔥 BARU: ALGORITMA SMART PAYROLL SUFFICIENCY ENGINE (AI RUNWAY CALCULATOR)
  // ========================================================
  const analisisKecukupanGajiPusat = useMemo(() => {
    // A. Hitung total kebutuhan rupiah untuk melunasi seluruh staf nasional (Aktif)
    const totalKebutuhanKotorNasional = Object.values(masterEmployeeDataGlobal)
      .reduce((sum, emp) => sum + emp.baseSalary, 0);

    // B. Sisa kewajiban bulan ini (Total kebutuhan dikurangi yang sudah dibayar)
    const sisaKewajibanPayrollBulanIni = Math.max(0, totalKebutuhanKotorNasional - ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan);

    // C. Hitung sisa kas likuid bersih milik Tangerang Pusat saat ini (Inflow - Outflow)
    let totalKasPusatAktif = 0;
    (cashflow_transactions || []).forEach(c => {
      if (c.isDeleted) return;
      const bId = String(c.branch_id || '').trim().toUpperCase();
      if (bId === 'HQ_FACTORY' || bId === 'PUSAT') {
        const amt = Number(c.amount || 0);
        if (String(c.transaction_type).toUpperCase() === 'INFLOW') totalKasPusatAktif += amt;
        else if (String(c.transaction_type).toUpperCase() === 'OUTFLOW') totalKasPusatAktif -= amt;
      }
    });

    // D. Evaluasi kecukupan dana menggunakan AI Logic Rules
    let statusFinansial = 'AMAN';
    let warnaBadge = 'bg-emerald-500 text-white';
    let warnaBorder = 'border-emerald-200 bg-emerald-50/50';
    let warnaTeks = 'text-emerald-700';
    let pesanRekomendasi = '🔥 AMAN, BOS! Saldo penjualan bersih Tangerang sangat melimpah. Likuiditas kas siap melunasi seluruh sisa gaji nasional bulan ini.';

    if (sisaKewajibanPayrollBulanIni > 0) {
      if (totalKasPusatAktif < sisaKewajibanPayrollBulanIni) {
        statusFinansial = 'KRITIS / BAHAYA';
        warnaBadge = 'bg-rose-600 text-white animate-pulse';
        warnaBorder = 'border-rose-200 bg-rose-50/60';
        warnaTeks = 'text-rose-700';
        pesanRekomendasi = '🚨 KAS TIDAK CUKUP! Saldo liquid kas Pusat lebih kecil dari sisa kewajiban gaji. Genjot penjualan, tarik setoran dari Pemalang & Cibinong, dan kunci pengeluaran non-prioritas!';
      } else if (totalKasPusatAktif <= sisaKewajibanPayrollBulanIni * 1.3) {
        statusFinansial = 'SIAGA MEPEET';
        warnaBadge = 'bg-amber-500 text-slate-900';
        warnaBorder = 'border-amber-200 bg-amber-50/60';
        warnaTeks = 'text-amber-800';
        pesanRekomendasi = '⚠️ SIAGA! Kas mencukupi untuk bayar gaji, tapi posisinya sangat mepet dengan batas aman operasional. Amankan dana laci sekarang.';
      }
    } else {
      pesanRekomendasi = '✅ MERDEKA! Seluruh kewajiban payroll nasional bulan ini sudah lunas dibayarkan secara merata.';
    }

    return {
      totalKebutuhanKotorNasional,
      sisaKewajibanPayrollBulanIni,
      totalKasPusatAktif,
      statusFinansial,
      warnaBadge,
      warnaBorder,
      warnaTeks,
      pesanRekomendasi
    };
  }, [masterEmployeeDataGlobal, ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan, cashflow_transactions]);

  // HISTORI JURNAL
  const payrollHistory = useMemo(() => {
    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    return (expenses || [])
      .filter(e => !e.isDeleted && e.category === 'PAYROLL' && String(e.branch_id || '').trim().toUpperCase() === targetBId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeProcessingBranch]);

  const handlePayrollEmployeeChange = (empId) => {
    const emp = masterEmployeeDataGlobal[empId];
    if (emp) {
      setFormPayroll(prev => ({ ...prev, employeeId: empId, baseSalary: String(emp.baseSalary || 0) }));
    } else {
      setFormPayroll(prev => ({ ...prev, employeeId: '', baseSalary: '0' }));
    }
  };

  const selectedEmpKasbon = formPayroll.employeeId ? (masterEmployeeDataGlobal[formPayroll.employeeId]?.sisaHutang || 0) : 0;
  
  const hitungNettoCair = useMemo(() => {
    const gapok = Number(formPayroll.baseSalary || 0);
    const tunjangan = Number(formPayroll.allowance || 0);
    const potLain = Number(formPayroll.otherDeduction || 0);
    
    const potKasbon = Math.min(selectedEmpKasbon, gapok + tunjangan);
    const netto = (gapok + tunjangan) - (potKasbon + potLain);
    
    return { potKasbon, netto };
  }, [formPayroll.baseSalary, formPayroll.allowance, formPayroll.otherDeduction, selectedEmpKasbon]);

  const handleSimpanPayroll = async (e) => {
    e.preventDefault();
    if (!formPayroll.employeeId) { showToast('Pilih karyawan terlebih dahulu!', 'error'); return; }
    
    const emp = masterEmployeeDataGlobal[formPayroll.employeeId];
    const expenseId = generateId('PRL', formPayroll.date);

    const payloadExpense = {
      id: expenseId, date: formPayroll.date, branch_id: activeProcessingBranch, category: 'PAYROLL', employee_id: formPayroll.employeeId,
      base_salary: Number(formPayroll.baseSalary), allowance: Number(formPayroll.allowance), kasbon_deduction: hitungNettoCair.potKasbon,
      other_deduction: Number(formPayroll.otherDeduction), amount: hitungNettoCair.netto, payment_method: formPayroll.paymentMethod,
      description: `Gaji Bulanan [${activeProcessingBranch}] - ${emp.name} (${emp.position}).`
    };

    const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
    
    if (successExpense) {
      const dynamicCashflowBranch = formPayroll.paymentMethod === 'TF' ? 'HQ_FACTORY' : activeProcessingBranch;
      const descCashflow = formPayroll.paymentMethod === 'TF' 
        ? `[PAYROLL CENTRAL] Potong penjualan bersih Tangerang Pusat untuk Gaji Cabang ${activeProcessingBranch} - Staf: ${emp.name}`
        : `[PAYROLL LOKAL] Gaji dibayar via laci tunai cabang ${activeProcessingBranch} - Staf: ${emp.name}`;

      const payloadCashflow = {
        id: 'CFO-' + new Date().getTime(), date: formPayroll.date, branch_id: dynamicCashflowBranch, transaction_type: 'OUTFLOW',
        category: 'OPERATIONAL_EXPENSE', amount: hitungNettoCair.netto, payment_method: formPayroll.paymentMethod, reference_id: expenseId, description: descCashflow
      };

      await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
      setFormPayroll({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
      if (showToast) showToast(`Payroll ${emp.name} Berhasil Disinkronkan dengan Kas Tangerang!`, 'success');
    }
  };

  const handleSimpanKasbon = async (e) => {
      e.preventDefault();
      if (!formKasbon.employeeId) { showToast('Pilih nama karyawan!', 'error'); return; }
      const targetEmp = masterEmployeeDataGlobal[formKasbon.employeeId];
      const expenseId = generateId('KSB', formKasbon.date);

      const payloadExpense = {
          id: expenseId, date: formKasbon.date, branch_id: activeProcessingBranch, employee_id: formKasbon.employeeId, 
          category: 'KASBON', amount: Number(formKasbon.amount), description: `Kasbon Tunai Cabang [${activeProcessingBranch}] - Staf: ${targetEmp.name}.`, payment_method: 'CASH'
      };

      const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
      if(successExpense) {
          const payloadCashflow = {
            id: 'CFO-' + new Date().getTime(), date: formKasbon.date, branch_id: activeProcessingBranch, transaction_type: 'OUTFLOW',
            category: 'KARYAWAN_KASBON', amount: Number(formKasbon.amount), payment_method: 'CASH', reference_id: expenseId,
            description: `[KASBON LOKAL] Pengambilan laci kas oleh staf ${targetEmp.name} di Node ${activeProcessingBranch}`
          };
          await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
          setFormKasbon({ date: todayStr, employeeId: '', amount: '', notes: '' });
          if(showToast) showToast('Buku kasbon berhasil di-update!', 'success');
      }
  };

  const handleSimpanMaster = async (e) => {
      e.preventDefault();
      if (!formMaster.name) return;
      const targetBranch = isHQ ? formMaster.targetBranch : currentBranch;
      
      const payload = { 
        id: generateId('EMP', new Date()), name: formMaster.name.toUpperCase(), position: formMaster.position, 
        baseSalary: Number(formMaster.baseSalary || 0), branch_id: targetBranch, status: 'AKTIF' 
      };
      
      const success = await sendToSheet('insert', payload, 'karyawan');
      if(success) {
        setFormMaster({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT' });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 📊 INDIKATOR FINANSIAL HR GLOBAL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Kasbon Aktif Cabang ({activeProcessingBranch})</div>
          <div className="text-xl font-black text-orange-600 mt-1">{formatRupiahLokal(ringkasanFinansialSDM.kasbonCabangIni)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Sisa piutang internal staf node</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Gaji Terbayar ({activeProcessingBranch}) Bulan Ini</div>
          <div className="text-xl font-black text-red-600 mt-1">{formatRupiahLokal(ringkasanFinansialSDM.gajiCabangIniBulanIni)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Realisasi dana lunas berjalan</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 md:col-span-2 grid grid-cols-2 gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-5"><TrendingDown size={80} className="text-white"/></div>
          <div>
            <div className="text-[9px] font-black text-red-400 uppercase tracking-widest">Total Pengeluaran Gaji Global</div>
            <div className="text-base font-black text-white mt-0.5">{formatRupiahLokal(ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan)}</div>
          </div>
          <div>
            <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Total Kasbon Company</div>
            <div className="text-base font-black text-white mt-0.5">{formatRupiahLokal(ringkasanFinansialSDM.kasbonGlobalSeluruhPerusahaan)}</div>
          </div>
          <div className="col-span-2 border-t border-slate-800 pt-1.5 text-[8px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert size={10} className="text-yellow-400"/> Konsolidasi Finansial Direktur Utama Dimsum Aditya
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🚀 WIDGET BARU: ENGINE RADAR KESANGGUPAN BAYAR GAJI NASIONAL */}
      {/* ======================================================== */}
      {isHQ && (
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${analisisKecukupanGajiPusat.warnaBorder}`}>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-slate-700 animate-pulse" />
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Radar Kesanggupan Gaji Nasional (Buku Penjualan Bersih)</h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ${analisisKecukupanGajiPusat.warnaBadge}`}>
                STATUS: {analisisKecukupanGajiPusat.statusFinansial}
              </span>
            </div>
            <p className={`text-xs font-bold leading-relaxed ${analisisKecukupanGajiPusat.warnaTeks}`}>{analisisKecukupanGajiPusat.pesanRekomendasi}</p>
          </div>
          <div className="flex gap-4 bg-white/80 backdrop-blur border p-4 rounded-2xl shadow-inner shrink-0 w-full md:w-auto justify-between md:justify-start">
            <div className="text-center px-2">
              <div className="text-[8px] font-black text-slate-400 uppercase">Kas Liquid Tangerang</div>
              <div className="text-sm font-black text-slate-800 mt-0.5">{formatRupiahLokal(analisisKecukupanGajiPusat.totalKasCentric || analisisKecukupanGajiPusat.totalKasPusatAktif)}</div>
            </div>
            <div className="border-l my-1"></div>
            <div className="text-center px-2">
              <div className="text-[8px] font-black text-red-500 uppercase">Sisa Wajib Payroll</div>
              <div className="text-sm font-black text-red-600 mt-0.5">{formatRupiahLokal(analisisKecukupanGajiPusat.sisaKewajibanPayrollBulanIni)}</div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER BUTTON PER-WILAYAH CABANG */}
      {isHQ && (
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 mb-3 md:mb-0">
            <Layers size={16} className="text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Cabang untuk Manajemen Keuangan Staf:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {daftarCabangId.map(brId => (
              <button 
                key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} 
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${activeProcessingBranch.toUpperCase() === brId.toUpperCase() ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
              >
                {petaNamaCabang[brId]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB NAVIGASI */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {isHQ && (
          <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Landmark size={14} className="inline mr-2"/> Gaji & Payroll</button>
        )}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Banknote size={14} className="inline mr-2"/> Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><UserPlus size={14} className="inline mr-2"/> {isHQ ? 'Master SDM Wilayah' : 'Registrasi Staf Lokal'}</button>
      </div>

      {/* SUB-TAB PAYROLL */}
      {activeSubTab === 'payroll' && isHQ && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-red-600 h-max">
            <div className="flex items-center gap-3 mb-5 border-b pb-3">
              <div className="bg-red-100 text-red-700 p-2 rounded-lg"><Landmark size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-sm uppercase">Hitung Gaji Bulanan</h3><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Node Wilayah: {activeProcessingBranch}</p></div>
            </div>
            
            <form onSubmit={handleSimpanPayroll} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pembayaran</label>
                <input type="date" required value={formPayroll.date} onChange={e=>setFormPayroll({...formPayroll, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Pilih Karyawan ({activeProcessingBranch})</label>
                <select required value={formPayroll.employeeId} onChange={e => handlePayrollEmployeeChange(e.target.value)} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none">
                  <option value="">-- Pilih Anggota --</option>
                  {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok</label>
                  <input 
                    type="text" required value={formatRupiahLokal(formPayroll.baseSalary)}
                    onChange={(e) => setFormPayroll({ ...formPayroll, baseSalary: e.target.value.replace(/\D/g, '') })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan/Lembur</label>
                  <input 
                    type="text" required value={formatRupiahLokal(formPayroll.allowance)}
                    onChange={(e) => setFormPayroll({ ...formPayroll, allowance: e.target.value.replace(/\D/g, '') })}
                    className="w-full p-2.5 bg-white border border-emerald-200 text-emerald-900 rounded-xl font-black text-sm outline-none"
                  />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-orange-700 uppercase">Sistem Potong Kasbon Otomatis</div>
                <div className="text-sm font-black text-orange-900 mt-1">{formatRupiahLokal(hitungNettoCair.potKasbon)}</div>
                <p className="text-[8px] text-orange-600 font-bold uppercase mt-0.5">*Sisa Hutang Karyawan: {formatRupiahLokal(selectedEmpKasbon)}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Lain (Absen/Alfa)</label>
                <input 
                  type="text" required value={formatRupiahLokal(formPayroll.otherDeduction)}
                  onChange={(e) => setFormPayroll({ ...formPayroll, otherDeduction: e.target.value.replace(/\D/g, '') })}
                  className="w-full p-2.5 bg-white border border-rose-200 text-rose-900 rounded-xl font-black text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">🏦 Sumber Dana Potong Kas Bersih</label>
                <select value={formPayroll.paymentMethod} onChange={e=>setFormPayroll({...formPayroll, paymentMethod: e.target.value})} className="w-full p-2.5 bg-red-50 border border-red-200 text-red-900 font-black text-xs outline-none rounded-xl">
                  <option value="TF">TF (POTONG LIQUID KAS TANGERANG PUSAT)</option>
                  <option value="CASH">CASH (Potong Kas Laci Cabang Lokal)</option>
                </select>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl text-center text-white">
                <div className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">NETTO CAIR DIBAYARKAN</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{formatRupiahLokal(hitungNettoCair.netto)}</div>
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all shadow-md">Record & Potong Kas Besar</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Histori Jurnal Gaji Karyawan Node {activeProcessingBranch}</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Nama Karyawan</th>
                    <th className="px-4 py-3 text-right">Gaji Pokok + Tunj</th>
                    <th className="px-4 py-3 text-right text-orange-600">Pot. Kasbon</th>
                    <th className="px-4 py-3 text-right text-emerald-600">Netto Cair</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {payrollHistory.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-8 text-slate-400">Belum ada catatan penggajian di wilayah ini.</td></tr>
                  ) : (
                    payrollHistory.map(p => {
                      const empName = karyawan?.find(k => k.id === p.employee_id)?.name || 'KARYAWAN';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                          <td className="px-4 py-3 uppercase text-slate-800">{empName} <div className="text-[8px] text-slate-400 font-mono">{p.payment_method === 'TF' ? 'Pusat Bank' : 'Laci Tunai'}</div></td>
                          <td className="px-4 py-3 text-right text-slate-600">{formatRupiahLokal((p.base_salary || 0) + (p.allowance || 0))}</td>
                          <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{formatRupiahLokal(p.kasbon_deduction)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 bg-emerald-50/10">{formatRupiahLokal(p.amount)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB KASBON KARYAWAN */}
      {activeSubTab === 'kasbon' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-500 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Banknote size={20}/></div>
                    <div><h3 className="font-black text-slate-800 text-sm uppercase">Pencairan Kasbon</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wilayah Kerja: {activeProcessingBranch}</p></div>
                </div>
                <form onSubmit={handleSimpanKasbon} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pencairan</label>
                        <input type="date" required value={formKasbon.date} onChange={e=>setFormKasbon({...formKasbon, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Staf Terdata di Node {activeProcessingBranch}</label>
                        <select required value={formKasbon.employeeId} onChange={e=>setFormKasbon({...formKasbon, employeeId: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none">
                            <option value="">-- Pilih Anggota --</option>
                            {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-orange-600 uppercase">Nominal Uang Kasbon</label>
                        <input 
                            type="text" required value={formatRupiahLokal(formKasbon.amount)} 
                            onChange={(e) => setFormKasbon({ ...formKasbon, amount: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl font-black text-sm" 
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Alasan Keperluan Pinjaman</label>
                        <input type="text" value={formKasbon.notes} onChange={e=>setFormKasbon({...formKasbon, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" placeholder="Cth: Kebutuhan darurat keluarga" />
                    </div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Buku Kasbon</button>
                </form>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Daftar Hutang Aktif Karyawan</h4>
                      <span className="text-[10px] bg-slate-900 text-white font-black px-2.5 py-0.5 rounded uppercase">FILTER NODE: {activeProcessingBranch}</span>
                  </div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Lengkap</th><th className="px-4 py-3">Posisi</th><th className="px-4 py-3 text-right text-rose-500">Total Pinjam</th><th className="px-4 py-3 text-right">Sisa Hutang</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {activeEmployees.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Tidak ada data staf kasbon aktif di cabang ini.</td></tr> : 
                          activeEmployees.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name} <div className="text-[8px] font-mono text-slate-400">{k.id}</div></td>
                                  <td className="px-4 py-3 uppercase text-slate-500">{k.position}</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-600">{formatRupiahLokal(k.totalKasbon)}</td>
                                  <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/50">{formatRupiahLokal(k.sisaHutang)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
            </div>
         </div>
      )}

      {/* SUB-TAB MASTER DATA SDM */}
      {activeSubTab === 'master' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800 h-max">
                  <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-slate-100 text-slate-700 p-2 rounded-lg"><Users size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase">Registrasi Staf Baru</h3></div></div>
                  <form onSubmit={handleSimpanMaster} className="space-y-4">
                      {isHQ && (
                        <div>
                          <label className="text-[10px] font-bold text-red-600 uppercase">Ditempatkan di Cabang mana?</label>
                          <select value={formMaster.targetBranch} onChange={e=>setFormMaster({...formMaster, targetBranch: e.target.value})} className="w-full p-2.5 bg-red-50 border border-red-200 rounded-xl font-black text-sm uppercase outline-none">
                            {daftarCabangId.map(br => <option key={br} value={br}>{br === 'PUSAT' ? 'Tangerang Pusat' : (petaNamaCabang[br] || br)}</option>)}
                          </select>
                        </div>
                      )}
                      <div><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap Karyawan</label><input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok Standar</label>
                        <input 
                          type="text" required value={formatRupiahLokal(formMaster.baseSalary)} 
                          onChange={(e) => setFormMaster({ ...formMaster, baseSalary: e.target.value.replace(/\D/g, '') })}
                          className="w-full p-2.5 bg-white border rounded-xl font-black text-sm" 
                        />
                      </div>
                      <div><label className="text-[10px] font-bold text-slate-600 uppercase">Posisi Kerja</label><select required value={formMaster.position} onChange={e=>setFormMaster({...formMaster, position: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase"><option value="KASIR">KASIR / RESTO FRONT</option><option value="DAPUR_RESTO">COOK / DAPUR RESTO</option><option value="WAITRESS">PRAMUSAJI / WAITRESS</option><option value="PRODUKSI_PABREK">STAFF PRODUKSI ADUKAN</option><option value="DRIVER">DRIVING LOGISTIK</option></select></div>
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Data Staf</button>
                  </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center"><h4 className="font-bold text-slate-800 text-sm uppercase">Database Karyawan Aktif Wilayah {activeProcessingBranch}</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">ID & Nama Lengkap</th><th className="px-4 py-3">Posisi Kerja</th><th className="px-4 py-3 text-right">Gaji Pokok</th><th className="px-4 py-3">Cabang</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {activeEmployees.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada karyawan yang didaftarkan di wilayah ini.</td></tr>
                          ) : (
                            activeEmployees.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name} <div className="font-mono text-[9px] font-bold text-slate-400">{k.id}</div></td>
                                  <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{k.position}</span></td>
                                  <td className="px-4 py-3 text-right text-slate-600">{formatRupiahLokal(k.baseSalary)}</td>
                                  <td className="px-4 py-3 font-black text-indigo-600 uppercase">{k.branch_id}</td>
                              </tr>
                            ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}
