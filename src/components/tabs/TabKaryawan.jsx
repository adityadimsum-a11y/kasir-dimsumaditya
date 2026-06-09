import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle, Banknote, Landmark, UserPlus, Layers } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, masterBranches, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  // State navigasi utama
  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  
  // FIX CRITICAL: State filter cabang aktif khusus untuk pandangan Tangerang Pusat
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('PUSAT');

  // Menentukan cabang mana yang sedang diproses datanya
  const activeProcessingBranch = isHQ ? selectedBranchFilter : currentBranch;

  // State Form Dinamis dengan Masking Rupiah
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

  // 1. DAFTAR WILAYAH UNTUK TOMBOL SWITCHER PUSAT
  const daftarCabang = useMemo(() => {
    const list = (masterBranches || []).filter(b => !b.isDeleted).map(b => b.branch_id);
    if (!list.includes('PUSAT')) list.unshift('PUSAT');
    return list;
  }, [masterBranches]);

  // 2. ENGINE EVALUASI HUTANG & KASBON KARYAWAN TERISOLASI PER CABANG
  const employeeData = useMemo(() => {
      const balances = {};
      
      // Filter Karyawan ketat berdasarkan Cabang yang sedang dipilih di atas layar
      (karyawan || []).forEach(k => {
          if (k.isDeleted) return;
          if (String(k.branch_id).toUpperCase() === activeProcessingBranch.toUpperCase()) {
              balances[k.id] = { 
                id: k.id, 
                name: k.name, 
                position: k.position, 
                baseSalary: Number(k.baseSalary || 0),
                branch_id: k.branch_id, 
                totalKasbon: 0, 
                totalDibayar: 0, 
                sisaHutang: 0 
              };
          }
      });

      // Olah data arus pengeluaran kasbon & payroll
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
  }, [karyawan, expenses, activeProcessingBranch]);

  const activeEmployees = Object.values(employeeData);

  // 3. LOG SEJARAH GAJI YANG SUDAH DIBAYARKAN DI CABANG TERPILIH
  const payrollHistory = useMemo(() => {
    return (expenses || [])
      .filter(e => !e.isDeleted && e.category === 'PAYROLL' && String(e.branch_id).toUpperCase() === activeProcessingBranch.toUpperCase())
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, activeProcessingBranch]);

  // Handler Auto-Fill ketika admin memilih nama karyawan di form payroll
  const handlePayrollEmployeeChange = (empId) => {
    const emp = employeeData[empId];
    if (emp) {
      setFormPayroll(prev => ({
        ...prev,
        employeeId: empId,
        baseSalary: String(emp.baseSalary || 0)
      }));
    } else {
      setFormPayroll(prev => ({ ...prev, employeeId: '', baseSalary: '0' }));
    }
  };

  // Hitung Potongan Kasbon Otomatis & Netto Cair
  const selectedEmpKasbon = formPayroll.employeeId ? (employeeData[formPayroll.employeeId]?.sisaHutang || 0) : 0;
  
  const hitungNettoCair = useMemo(() => {
    const gapok = Number(formPayroll.baseSalary || 0);
    const tunjangan = Number(formPayroll.allowance || 0);
    const potLain = Number(formPayroll.otherDeduction || 0);
    
    // Potong kasbon otomatis: jika hutang lebih besar dari gaji, potong maksimal senilai total gaji berjalan
    const potKasbon = Math.min(selectedEmpKasbon, gapok + tunjangan);
    const netto = (gapok + tunjangan) - (potKasbon + potLain);
    
    return { potKasbon, netto };
  }, [formPayroll.baseSalary, formPayroll.allowance, formPayroll.otherDeduction, selectedEmpKasbon]);

  // ACTIONS TO CLOUD SHEET
  const handleSimpanPayroll = async (e) => {
    e.preventDefault();
    if (!formPayroll.employeeId) { showToast('Pilih karyawan terlebih dahulu!', 'error'); return; }
    
    const emp = employeeData[formPayroll.employeeId];
    const payload = {
      id: generateId('PRL', formPayroll.date),
      date: formPayroll.date,
      branch_id: activeProcessingBranch,
      category: 'PAYROLL',
      employee_id: formPayroll.employeeId,
      base_salary: Number(formPayroll.baseSalary),
      allowance: Number(formPayroll.allowance),
      kasbon_deduction: hitungNettoCair.potKasbon,
      other_deduction: Number(formPayroll.otherDeduction),
      amount: hitungNettoCair.netto, // Netto Cair yang memotong kas global
      payment_method: formPayroll.paymentMethod,
      description: `Gaji Bulanan [${activeProcessingBranch}] - ${emp.name} (${emp.position}). Bersih: ${formatRp(hitungNettoCair.netto)}`
    };

    const success = await sendToSheet('insert', payload, 'expenses');
    if (success) {
      setFormPayroll({ date: todayStr, employeeId: '', baseSalary: '0', allowance: '0', otherDeduction: '0', paymentMethod: 'CASH' });
      if (showToast) showToast('Payroll berhasil diproses & tercatat di pembukuan!', 'success');
    }
  };

  const handleSimpanKasbon = async (e) => {
      e.preventDefault();
      if (!formKasbon.employeeId) { showToast('Pilih nama karyawan!', 'error'); return; }
      const targetEmp = employeeData[formKasbon.employeeId];

      const payload = {
          id: generateId('KSB', formKasbon.date), 
          date: formKasbon.date, 
          branch_id: activeProcessingBranch, 
          employee_id: formKasbon.employeeId, 
          category: 'KASBON', 
          amount: Number(formKasbon.amount), 
          description: `Kasbon Tunai [${activeProcessingBranch}] - Staf: ${targetEmp.name}. Ket: ${formKasbon.notes}`, 
          payment_method: 'CASH'
      };

      const success = await sendToSheet('insert', payload, 'expenses');
      if(success) {
          setFormKasbon({ date: todayStr, employeeId: '', amount: '', notes: '' });
          if(showToast) showToast('Kasbon berhasil dicatat!', 'success');
      }
  };

  const handleSimpanMaster = async (e) => {
      e.preventDefault();
      if (!formMaster.name) return;
      const targetBranch = isHQ ? formMaster.targetBranch : currentBranch;
      
      const payload = { 
        id: generateId('EMP', new Date()), 
        name: formMaster.name.toUpperCase(), 
        position: formMaster.position, 
        baseSalary: Number(formMaster.baseSalary || 0), 
        branch_id: targetBranch, 
        status: 'AKTIF' 
      };
      
      const success = await sendToSheet('insert', payload, 'karyawan');
      if(success) {
        setFormMaster({ name: '', position: 'KASIR', baseSalary: '0', targetBranch: 'PUSAT' });
        if(showToast) showToast('Staf baru berhasil didaftarkan!', 'success');
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FIX REQ POINT 1: SWITCHER WILAYAH CABANG KHUSUS UNTUK TANGERANG PUSAT */}
      {isHQ && (
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 mb-3 md:mb-0">
            <Layers size={16} className="text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Cabang untuk Manajemen Keuangan Staf:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {daftarCabang.map(brId => (
              <button 
                key={brId} 
                type="button"
                onClick={() => setSelectedBranchFilter(brId)} 
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${activeProcessingBranch.toUpperCase() === brId.toUpperCase() ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
              >
                {brId === 'PUSAT' ? '🍊 Tangerang Pusat' : `🏪 Node ${brId}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI SUB-TAB OPERASIONAL */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {isHQ && (
          <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Landmark size={14} className="inline mr-2"/> Gaji & Payroll</button>
        )}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Banknote size={14} className="inline mr-2"/> Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><UserPlus size={14} className="inline mr-2"/> {isHQ ? 'Master SDM Wilayah' : 'Registrasi Staf Lokal'}</button>
      </div>

      {/* FIX REQ POINT 2: SUB-TAB PAYROLL AKTIF (ANTI-BLANK ENGINE) */}
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
                    type="text" required
                    value={"Rp. " + Number(formPayroll.baseSalary || 0).toLocaleString('id-ID')}
                    onChange={(e) => setFormPayroll({ ...formPayroll, baseSalary: e.target.value.replace(/\D/g, '') })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan/Lembur</label>
                  <input 
                    type="text" required
                    value={"Rp. " + Number(formPayroll.allowance || 0).toLocaleString('id-ID')}
                    onChange={(e) => setFormPayroll({ ...formPayroll, allowance: e.target.value.replace(/\D/g, '') })}
                    className="w-full p-2.5 bg-white border border-emerald-200 text-emerald-900 rounded-xl font-black text-sm outline-none"
                  />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-orange-700 uppercase">Sistem Potong Kasbon Otomatis</div>
                <div className="text-sm font-black text-orange-900 mt-1">{"Rp. " + Number(hitungNettoCair.potKasbon).toLocaleString('id-ID')}</div>
                <p className="text-[8px] text-orange-600 font-bold uppercase mt-0.5">*Sisa Hutang Karyawan: {formatRp(selectedEmpKasbon)}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Lain (Absen/Alfa)</label>
                <input 
                  type="text" required
                  value={"Rp. " + Number(formPayroll.otherDeduction || 0).toLocaleString('id-ID')}
                  onChange={(e) => setFormPayroll({ ...formPayroll, otherDeduction: e.target.value.replace(/\D/g, '') })}
                  className="w-full p-2.5 bg-white border border-rose-200 text-rose-900 rounded-xl font-black text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Metode Pembayaran</label>
                <select value={formPayroll.paymentMethod} onChange={e=>setFormPayroll({...formPayroll, paymentMethod: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-xs outline-none">
                  <option value="CASH">CASH (Brankas/Laci Tunai)</option>
                  <option value="TF">TF (Rekening Pusat Mandiri/BCA)</option>
                </select>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl text-center text-white">
                <div className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">NETTO CAIR DIBAYARKAN</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{"Rp. " + Number(hitungNettoCair.netto).toLocaleString('id-ID')}</div>
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all shadow-md">Record & Transfer Gaji</button>
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
                          <td className="px-4 py-3 uppercase text-slate-800">{empName} <div className="text-[8px] text-slate-400 font-mono">{p.payment_method}</div></td>
                          <td className="px-4 py-3 text-right text-slate-600">{"Rp. " + Number((p.base_salary || 0) + (p.allowance || 0)).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right text-orange-600 bg-orange-50/20">{"Rp. " + Number(p.kasbon_deduction || 0).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 bg-emerald-50/10">{"Rp. " + Number(p.amount || 0).toLocaleString('id-ID')}</td>
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

      {/* TAB KASBON KARYAWAN (TERISOLASI DENGAN AMAN PER CABANG) */}
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
                            type="text" required 
                            value={"Rp. " + Number(formKasbon.amount || 0).toLocaleString('id-ID')} 
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
                                  <td className="px-4 py-3 text-right font-medium text-slate-600">{"Rp. " + Number(k.totalKasbon || 0).toLocaleString('id-ID')}</td>
                                  <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/50">{"Rp. " + Number(k.sisaHutang || 0).toLocaleString('id-ID')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
            </div>
         </div>
      )}

      {/* REGISTRASI MASTER DATA SDM */}
      {activeSubTab === 'master' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800 h-max">
                  <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-slate-100 text-slate-700 p-2 rounded-lg"><Users size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase">Registrasi Staf Baru</h3></div></div>
                  <form onSubmit={handleSimpanMaster} className="space-y-4">
                      {isHQ && (
                        <div>
                          <label className="text-[10px] font-bold text-red-600 uppercase">Ditempatkan di Cabang mana?</label>
                          <select value={formMaster.targetBranch} onChange={e=>setFormMaster({...formMaster, targetBranch: e.target.value})} className="w-full p-2.5 bg-red-50 border border-red-200 rounded-xl font-black text-sm uppercase outline-none">
                            {daftarCabang.map(br => <option key={br} value={br}>{br === 'PUSAT' ? 'Tangerang Pusat' : `Cabang ${br}`}</option>)}
                          </select>
                        </div>
                      )}
                      <div><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap Karyawan</label><input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok Standar</label>
                        <input 
                          type="text" required 
                          value={"Rp. " + Number(formMaster.baseSalary || 0).toLocaleString('id-ID')} 
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
                                  <td className="px-4 py-3 text-right text-slate-600">{"Rp. " + Number(k.baseSalary || 0).toLocaleString('id-ID')}</td>
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
