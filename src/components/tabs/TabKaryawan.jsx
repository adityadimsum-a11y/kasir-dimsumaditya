import React, { useState, useMemo } from 'react';
import { Users, Landmark, Banknote, UserPlus, Layers, TrendingDown, ShieldAlert, Trash2, Edit2, Check, X, Phone, Image } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, masterBranches, cashflowTransactions, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  // State Manajemen Navigasi Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  // State Form Entry Identitas & Kasbon
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const [formMaster, setFormMaster] = useState({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', photo_url: '' });
  const [formPayroll, setFormPayroll] = useState({ 
    date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' 
  });

  // State Mode Edit Karyawan (Inline Editing)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editForm, setEditForm] = useState({ position: '', baseSalary: '0', status: 'AKTIF' });

  const formatRupiahLokal = (angka) => {
    return "Rp. " + Number(angka || 0).toLocaleString('id-ID');
  };

  // 1. PETAMAP NAMA CABANG DARI DB (FIXED VARIABEL: masterBranches)
  const petaNamaCabang = useMemo(() => {
    const mapping = { PUSAT: '🍊 TANGERANG PUSAT' };
    (masterBranches || []).forEach(b => {
      if (!b.isDeleted && b.branch_id) {
        mapping[String(b.branch_id).trim().toUpperCase()] = `🏪 ${String(b.branch_name).toUpperCase()}`;
      }
    });
    return mapping;
  }, [masterBranches]);

  const daftarCabangId = useMemo(() => Object.keys(petaNamaCabang), [petaNamaCabang]);

  // 2. ENGINE MASTER KARYAWAN & SALDO KASBON TERKONSOLIDASI
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
            status: k.status || 'AKTIF',
            phone: k.phone || '-',
            photo_url: k.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            totalKasbon: 0, totalDibayar: 0, sisaHutang: 0 
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

  // Filter karyawan berdasarkan cabang yang sedang aktif dipilih
  const activeEmployees = useMemo(() => {
    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    return Object.values(masterEmployeeDataGlobal).filter(k => k.branch_id === targetBId);
  }, [masterEmployeeDataGlobal, activeProcessingBranch]);

  // JURNAL TRANSAKSI KASBON LENGKAP DENGAN ID DAN TANGGAL NOTA
  const kasbonTransactionsLogs = useMemo(() => {
    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    return (expenses || [])
      .filter(e => !e.isDeleted && e.category === 'KASBON' && String(e.branch_id || '').trim().toUpperCase() === targetBId)
      .map(e => ({
        ...e,
        employeeName: masterEmployeeDataGlobal[e.employee_id]?.name || 'STAF KARYAWAN'
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeProcessingBranch, masterEmployeeDataGlobal]);

  // 3. ENGINE RADAR FINANCIAL TOTALIZER
  const ringkasanFinansialSDM = useMemo(() => {
    let kasbonCabangIni = 0; let gajiCabangIniBulanIni = 0;
    let kasbonGlobalSeluruhPerusahaan = 0; let gajiGlobalSeluruhPerusahaan = 0;
    const targetBId = String(activeProcessingBranch || '').trim().toUpperCase();
    const curMonth = todayStr.substring(0, 7);

    Object.values(masterEmployeeDataGlobal).forEach(emp => {
      if(emp.status === 'AKTIF') kasbonGlobalSeluruhPerusahaan += emp.sisaHutang;
      if (emp.branch_id === targetBId && emp.status === 'AKTIF') kasbonCabangIni += emp.sisaHutang;
    });

    (expenses || []).forEach(e => {
      if (e.isDeleted) return;
      const bId = String(e.branch_id || '').trim().toUpperCase();
      if (e.category === 'PAYROLL' && e.date.startsWith(curMonth)) {
        gajiGlobalSeluruhPerusahaan += Number(e.amount || 0);
        if (bId === targetBId) gajiCabangIniBulanIni += Number(e.amount || 0);
      }
    });

    return { kasbonCabangIni, gajiCabangIniBulanIni, kasbonGlobalSeluruhPerusahaan, gajiGlobalSeluruhPerusahaan };
  }, [masterEmployeeDataGlobal, expenses, activeProcessingBranch, todayStr]);

  // FIX CRITICAL: Membaca memori data cashflowTransactions (tanpa underscore) dengan aman agar tidak memicu error blank putih
  const analisisKecukupanGajiPusat = useMemo(() => {
    const totalKebutuhanKotorNasional = Object.values(masterEmployeeDataGlobal)
      .filter(e => e.status === 'AKTIF').reduce((sum, emp) => sum + emp.baseSalary, 0);
    const sisaKewajibanPayrollBulanIni = Math.max(0, totalKebutuhanKotorNasional - ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan);
    
    let totalKasPusatAktif = 0;
    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      if (['HQ_FACTORY', 'PUSAT'].includes(String(c.branch_id).toUpperCase())) {
        const amt = Number(c.amount || 0);
        if (String(c.transaction_type).toUpperCase() === 'INFLOW') totalKasPusatAktif += amt;
        else if (String(c.transaction_type).toUpperCase() === 'OUTFLOW') totalKasPusatAktif -= amt;
      }
    });

    let statusFinansial = 'AMAN'; let warnaBadge = 'bg-emerald-500 text-white';
    let pesanRekomendasi = '🔥 AMAN, REK! Saldo kas liquid pusat sangat mencukupi untuk meng-cover sisa kewajiban gaji seluruh cabang nasional.';

    if (sisaKewajibanPayrollBulanIni > totalKasPusatAktif) {
      statusFinansial = 'BAHAYA / KRITIS'; warnaBadge = 'bg-rose-600 text-white animate-pulse';
      pesanRekomendasi = '🚨 KAS TIDAK CUKUP! Segera tarik setoran omzet dari Pemalang & Cibinong untuk mengamankan runway payroll.';
    }

    return { sisaKewajibanPayrollBulanIni, totalKasPusatAktif, statusFinansial, warnaBadge, pesanRekomendasi };
  }, [masterEmployeeDataGlobal, ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan, cashflowTransactions]);

  const selectedEmpKasbon = useMemo(() => {
    if (!formPayroll.employeeId) return 0;
    return masterEmployeeDataGlobal[formPayroll.employeeId]?.sisaHutang || 0;
  }, [formPayroll.employeeId, masterEmployeeDataGlobal]);

  // ENGINE PENGECEKAN BATAS LIMIT KASBON (MAKSIMAL SENILAI GAJI POKOK)
  const selectedEmpObject = formKasbon.employeeId ? masterEmployeeDataGlobal[formKasbon.employeeId] : null;
  const isKasbonOverlimit = useMemo(() => {
    if (!selectedEmpObject) return false;
    const currentRequest = Number(formKasbon.amount || 0);
    return (currentRequest + selectedEmpObject.sisaHutang) > selectedEmpObject.baseSalary;
  }, [formKasbon.amount, selectedEmpObject]);

  // CORE ACTIONS LOGIC SYSTEM
  const startInlineEdit = (emp) => {
    setEditingEmployeeId(emp.id);
    setEditForm({ position: emp.position, baseSalary: String(emp.baseSalary), status: emp.status });
  };

  const handleSaveInlineEdit = async (empId) => {
    const success = await sendToSheet('update', {
      id: empId,
      position: editForm.position,
      baseSalary: Number(editForm.baseSalary),
      status: editForm.status
    }, 'karyawan');
    if(success) {
      setEditingEmployeeId(null);
      if(showToast) showToast('Data karyawan sukses di-update!', 'success');
    }
  };

  const handlePecatKaryawan = async (empId) => {
    if(window.confirm("Apakah Anda yakin ingin menghapus data karyawan ini dari sistem?")) {
      const success = await sendToSheet('update', { id: empId, isDeleted: true }, 'karyawan');
      if(success && showToast) showToast('Karyawan telah berhasil dihapus.', 'success');
    }
  };

  const handleSimpanPayroll = async (e) => {
    e.preventDefault();
    if (!formPayroll.employeeId) return;
    const emp = masterEmployeeDataGlobal[formPayroll.employeeId];
    const gapok = Number(formPayroll.baseSalary || 0);
    const tunjangan = Number(formPayroll.allowance || 0);
    const potLain = Number(formPayroll.otherDeduction || 0);
    const potKasbon = Math.min(selectedEmpKasbon, gapok + tunjangan);
    const netto = (gapok + tunjangan) - (potKasbon + potLain);

    const expenseId = generateId('PRL', formPayroll.date);
    const success = await sendToSheet('insert', {
      id: expenseId, date: formPayroll.date, branch_id: activeProcessingBranch, category: 'PAYROLL', employee_id: formPayroll.employeeId,
      base_salary: gapok, allowance: tunjangan, kasbon_deduction: potKasbon, other_deduction: potLain, amount: netto, payment_method: formPayroll.paymentMethod,
      description: `Gaji Bulanan [${activeProcessingBranch}] - ${emp.name}.`
    }, 'expenses');

    if(success) {
      await sendToSheet('insert', {
        id: 'CFO-' + new Date().getTime(), date: formPayroll.date, branch_id: formPayroll.paymentMethod === 'TF' ? 'HQ_FACTORY' : activeProcessingBranch,
        transaction_type: 'OUTFLOW', category: 'OPERATIONAL_EXPENSE', amount: netto, payment_method: formPayroll.paymentMethod, reference_id: expenseId,
        description: `Payroll Jurnal — Cabang: ${activeProcessingBranch}, Nama: ${emp.name}`
      }, 'cashflow_transactions');
      setFormPayroll({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
    }
  };

  const handleSimpanKasbon = async (e) => {
      e.preventDefault();
      if (!formKasbon.employeeId || isKasbonOverlimit) return;
      const expenseId = generateId('KSB', formKasbon.date);

      const success = await sendToSheet('insert', {
          id: expenseId, date: formKasbon.date, branch_id: activeProcessingBranch, employee_id: formKasbon.employeeId, 
          category: 'KASBON', amount: Number(formKasbon.amount), description: `Kasbon Nota ID Baru — Ket: ${formKasbon.notes}`, payment_method: 'CASH'
      }, 'expenses');

      if(success) {
          await sendToSheet('insert', {
            id: 'CFO-' + new Date().getTime(), date: formKasbon.date, branch_id: activeProcessingBranch, transaction_type: 'OUTFLOW',
            category: 'KARYAWAN_KASBON', amount: Number(formKasbon.amount), payment_method: 'CASH', reference_id: expenseId,
            description: `Pencairan kasbon nota baru cabang ${activeProcessingBranch}`
          }, 'cashflow_transactions');
          setFormKasbon({ date: todayStr, employeeId: '', amount: '', notes: '' });
      }
  };

  const handleSimpanMaster = async (e) => {
      e.preventDefault();
      const targetBranch = isHQ ? formMaster.targetBranch : currentBranch;
      const success = await sendToSheet('insert', { 
        id: generateId('EMP', new Date()), name: formMaster.name.toUpperCase(), position: formMaster.position, 
        baseSalary: Number(formMaster.baseSalary || 0), branch_id: targetBranch, status: 'AKTIF',
        phone: formMaster.phone, photo_url: formMaster.photo_url
      }, 'karyawan');
      if(success) setFormMaster({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT', phone: '', photo_url: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 📊 BOARDS METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kasbon Aktif Wilayah ({activeProcessingBranch})</div>
          <div className="text-xl font-black text-orange-600 mt-1">{formatRupiahLokal(ringkasanFinansialSDM.kasbonCabangIni)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Gaji Terbayar ({activeProcessingBranch}) Bulan Ini</div>
          <div className="text-xl font-black text-red-600 mt-1">{formatRupiahLokal(ringkasanFinansialSDM.gajiCabangIniBulanIni)}</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 md:col-span-2 grid grid-cols-2 gap-2 text-white">
          <div><div className="text-[9px] font-black text-red-400 uppercase">Total Gaji Global</div><div className="text-base font-black">{formatRupiahLokal(ringkasanFinansialSDM.gajiGlobalSeluruhPerusahaan)}</div></div>
          <div><div className="text-[9px] font-black text-orange-400 uppercase">Total Kasbon Company</div><div className="text-base font-black">{formatRupiahLokal(ringkasanFinansialSDM.kasbonGlobalSeluruhPerusahaan)}</div></div>
        </div>
      </div>

      {/* AI SUFFICIENCY RADAR WIDGET */}
      {isHQ && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 flex items-center justify-between text-xs font-bold text-blue-800">
          <div>💡 <strong>Radar Gaji Nasional:</strong> {analisisKecukupanGajiPusat.pesanRekomendasi}</div>
          <span className={`px-3 py-1 rounded-full uppercase font-black text-[9px] ${analisisKecukupanGajiPusat.warnaBadge}`}>Sisa Wajib Gaji: {formatRupiahLokal(analisisKecukupanGajiPusat.sisaKewajibanPayrollBulanIni)}</span>
        </div>
      )}

      {/* REGIONAL BRANCH SWITCHER */}
      {isHQ && (
        <div className="bg-slate-900 p-4 rounded-2xl flex flex-wrap gap-2 items-center justify-between shadow-md">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Divisi Cabang Keuangan Staf:</div>
          <div className="flex flex-wrap gap-2">
            {daftarCabangId.map(brId => (
              <button key={brId} type="button" onClick={() => setSelectedBranchFilter(brId)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeProcessingBranch.toUpperCase() === brId.toUpperCase() ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{petaNamaCabang[brId]}</button>
            ))}
          </div>
        </div>
      )}

      {/* TAB SUB-NAV BAR */}
      <div className="flex gap-2 border-b pb-4">
        {isHQ && <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Gaji & Payroll</button>}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500'}`}>Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500'}`}>Master SDM Wilayah</button>
      </div>

      {/* SUB-TAB PAYROLL */}
      {activeSubTab === 'payroll' && isHQ && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border p-6 border-t-4 border-t-red-600 h-max">
            <form onSubmit={handleSimpanPayroll} className="space-y-4">
              <h3 className="font-black text-sm uppercase text-slate-800">Hitung Gaji Bulanan</h3>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Karyawan ({activeProcessingBranch})</label>
                <select required value={formPayroll.employeeId} onChange={e => handlePayrollEmployeeChange(e.target.value)} className="w-full p-2.5 border rounded-xl font-black text-sm uppercase outline-none">
                  <option value="">-- Pilih Anggota --</option>
                  {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label>
                  <input type="text" required value={formatRupiahLokal(formPayroll.baseSalary)} onChange={e=>setFormPayroll({...formPayroll, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan</label>
                  <input type="text" required value={formatRupiahLokal(formPayroll.allowance)} onChange={e=>setFormPayroll({...formPayroll, allowance: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" />
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-xs font-bold text-orange-800">
                <div>Potong Kasbon Otomatis: {formatRupiahLokal(Math.min(selectedEmpKasbon, Number(formPayroll.baseSalary) + Number(formPayroll.allowance)))}</div>
                <div className="text-[10px] text-orange-600 mt-1">Sisa Hutang Berjalan: {formatRupiahLokal(selectedEmpKasbon)}</div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Lain</label>
                <input type="text" required value={formatRupiahLokal(formPayroll.otherDeduction)} onChange={e=>setFormPayroll({...formPayroll, otherDeduction: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Sumber Kas</label>
                <select value={formPayroll.paymentMethod} onChange={e=>setFormPayroll({...formPayroll, paymentMethod: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-xs">
                  <option value="TF">TF (KAS UTAMA TANGERANG PUSAT)</option>
                  <option value="CASH">CASH (KAS LACI LOKAL CABANG)</option>
                </select>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl text-center text-emerald-400 font-black">
                <div className="text-[8px] text-slate-400">NETTO CAIR DIBAYARKAN</div>
                <div className="text-xl mt-1">{"Rp. " + Number((Number(formPayroll.baseSalary) + Number(formPayroll.allowance)) - (Math.min(selectedEmpKasbon, Number(formPayroll.baseSalary) + Number(formPayroll.allowance)) + Number(formPayroll.otherDeduction))).toLocaleString('id-ID')}</div>
              </div>
              <button type="submit" className="w-full bg-red-600 text-white text-xs font-black py-3 rounded-xl uppercase tracking-wider">Record & Potong Kas Besar</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Histori Jurnal Gaji Karyawan Node {activeProcessingBranch}</div>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Karyawan</th><th className="text-right px-4">Gaji+Tunj</th><th className="text-right px-4 text-orange-600">Pot. Kasbon</th><th className="text-right px-4 text-emerald-600">Netto Cair</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {payrollHistory.length === 0 ? <tr><td colSpan="5" className="text-center py-6 text-slate-400">Belum ada pembayaran gaji.</td></tr> :
                  payrollHistory.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.date)}</td>
                      <td className="px-4 py-3 uppercase">{karyawan?.find(k => k.id === p.employee_id)?.name || 'KARYAWAN'}</td>
                      <td className="px-4 py-3 text-right">{formatRupiahLokal((p.base_salary||0)+(p.allowance||0))}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatRupiahLokal(p.kasbon_deduction)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatRupiahLokal(p.amount)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB KASBON KARYAWAN */}
      {activeSubTab === 'kasbon' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-orange-500 h-max">
            <form onSubmit={handleSimpanKasbon} className="space-y-4">
              <h3 className="font-black text-sm uppercase text-slate-800">Pencairan Kasbon Nota Baru</h3>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Staf Terdata ({activeProcessingBranch})</label>
                <select required value={formKasbon.employeeId} onChange={e=>setFormKasbon({...formKasbon, employeeId: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-sm uppercase outline-none">
                  <option value="">-- Pilih Anggota --</option>
                  {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nominal Pinjaman</label>
                <input type="text" required value={formatRupiahLokal(formKasbon.amount)} onChange={e=>setFormKasbon({...formKasbon, amount: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl font-black text-sm" />
                {isKasbonOverlimit && (
                  <div className="mt-1.5 p-2 bg-red-600 text-white rounded-lg font-black text-[9px] uppercase animate-pulse">🚨 Overlimit! Total pinjaman melebihi gaji pokok bulanan karyawan!</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Alasan Keperluan</label>
                <input type="text" value={formKasbon.notes} onChange={e=>setFormKasbon({...formKasbon, notes: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs" placeholder="Catatan pinjaman" />
              </div>
              <button type="submit" disabled={isKasbonOverlimit || !formKasbon.employeeId} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl text-xs uppercase disabled:opacity-40">Simpan Jurnal Kasbon</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Buku Jurnal Kasbon Riil per Nota (Filter: {activeProcessingBranch})</div>
            <div className="overflow-y-auto max-h-[450px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                  <tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3">Nama Karyawan</th><th className="px-4 py-3">Keterangan Jurnal</th><th className="text-right px-4 text-orange-600">Nominal Pinjam</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {kasbonTransactionsLogs.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada nota kasbon tercatat.</td></tr> :
                    kasbonTransactionsLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 font-bold mt-0.5">{log.id}</div></td>
                        <td className="px-4 py-3 uppercase text-slate-800">{log.employeeName}</td>
                        <td className="px-4 py-3 text-slate-500 font-normal">{log.description}</td>
                        <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{formatRupiahLokal(log.amount)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB MASTER DATA SDM */}
      {activeSubTab === 'master' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-t-4 border-t-slate-800 h-max">
            <form onSubmit={handleSimpanMaster} className="space-y-3">
              <h3 className="font-black text-sm uppercase text-slate-800">Registrasi Identitas Staf</h3>
              {isHQ && (
                <div>
                  <label className="text-[10px] font-bold text-red-600 uppercase">Cabang Penempatan</label>
                  <select value={formMaster.targetBranch} onChange={e=>setFormMaster({...formMaster, targetBranch: e.target.value})} className="w-full p-2 border rounded-lg text-xs uppercase font-black">
                    {daftarCabangId.map(br => <option key={br} value={br}>{petaNamaCabang[br]}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label>
                <input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm uppercase" />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Phone size={10}/> No. Whatsapp</label>
                  <input type="text" required placeholder="0812xxx" value={formMaster.phone} onChange={e=>setFormMaster({...formMaster, phone: e.target.value})} className="w-full p-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Image size={10}/> URL Link Foto</label>
                  <input type="text" placeholder="https://..." value={formMaster.photo_url} onChange={e=>setFormMaster({...formMaster, photo_url: e.target.value})} className="w-full p-2 border rounded-lg text-xs" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok Bulanan (Master)</label>
                <input type="text" required value={formatRupiahLokal(formMaster.baseSalary)} onChange={e=>setFormMaster({...formMaster, baseSalary: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border rounded-lg font-bold text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Posisi Kerja</label>
                <select value={formMaster.position} onChange={e=>setFormMaster({...formMaster, position: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold uppercase">
                  <option value="KASIR">KASIR / RESTO FRONT</option>
                  <option value="DAPUR_RESTO">COOK / DAPUR RESTO</option>
                  <option value="WAITRESS">PRAMUSAJI / WAITRESS</option>
                  <option value="PRODUKSI_PABREK">STAFF PRODUKSI ADUKAN</option>
                  <option value="DRIVER">DRIVING LOGISTIK</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-slate-800 text-white font-black py-3 rounded-xl text-xs uppercase">Simpan Data Staf</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-bold text-xs uppercase text-slate-700">Database Staf Wilayah penempatan {activeProcessingBranch}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                  <tr><th className="px-4 py-3">Profil</th><th className="px-4 py-3">Kontak/HP</th><th className="px-4 py-3">Jabatan & Gaji</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi Manajemen</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {activeEmployees.map(k => {
                    const isInlineEditing = editingEmployeeId === k.id;
                    return (
                      <tr key={k.id} className="hover:bg-slate-50 transition">
                        
                        <td className="px-4 py-3 flex items-center gap-3">
                          <img src={k.photo_url} alt="Karyawan" className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                          <div>
                            <div className="font-black text-slate-800 uppercase">{k.name}</div>
                            <div className="text-[9px] font-mono text-slate-400">{k.id}</div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600 font-mono">{k.phone}</td>

                        <td className="px-4 py-3">
                          {isInlineEditing ? (
                            <div className="space-y-1">
                              <select value={editForm.position} onChange={e=>setEditForm({...editForm, position: e.target.value})} className="p-1 border text-[10px] rounded uppercase font-black w-full">
                                <option value="KASIR">KASIR</option><option value="DAPUR_RESTO">COOK</option><option value="WAITRESS">WAITRESS</option><option value="PRODUKSI_PABREK">PRODUKSI</option><option value="DRIVER">DRIVER</option>
                              </select>
                              <input type="text" value={formatRupiahLokal(editForm.baseSalary)} onChange={e=>setEditForm({...editForm, baseSalary: e.target.value.replace(/\D/g, '')})} className="p-1 border text-[10px] font-black rounded w-full"/>
                            </div>
                          ) : (
                            <div>
                              <div className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase w-max mb-1">{k.position}</div>
                              <div className="text-slate-800 font-black">{formatRupiahLokal(k.baseSalary)}</div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isInlineEditing ? (
                            <select value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})} className="p-1 border text-[10px] rounded font-black">
                              <option value="AKTIF">AKTIF</option>
                              <option value="NON-AKTIF">NON-AKTIF</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${k.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{k.status}</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isInlineEditing ? (
                              <>
                                <button type="button" onClick={() => handleSaveInlineEdit(k.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700" title="Simpan"><Check size={14}/></button>
                                <button type="button" onClick={() => setEditingEmployeeId(null)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Batal"><X size={14}/></button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startInlineEdit(k)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Edit"><Edit2 size={13}/></button>
                                <button type="button" onClick={() => handlePecatKaryawan(k.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="Hapus"><Trash2 size={13}/></button>
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
        </div>
      )}
    </div>
  );
}
