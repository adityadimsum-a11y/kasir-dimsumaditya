import React, { useState, useMemo, useEffect } from 'react';
import { Users, FileText, CheckCircle, Plus, Printer, Wallet, AlertCircle, Banknote, ShieldCheck, Scissors } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, sendToSheet, setPrintData, showToast, user }) {
  const todayStr = getTodayStr();
  const [activeSubTab, setActiveSubTab] = useState('payroll'); // 'master', 'kasbon', 'payroll'

  // =====================================
  // STATE FORMS
  // =====================================
  const [formMaster, setFormMaster] = useState({ name: '', position: 'PRODUKSI', baseSalary: '' });
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  
  const [formPayroll, setFormPayroll] = useState({ 
      date: todayStr, employeeId: '', 
      baseSalary: '', allowance: '', kasbonDeduction: '', otherDeduction: '', paymentMethod: 'CASH' 
  });

  // =====================================
  // SMART KASBON CALCULATION ENGINE
  // =====================================
  const employeeData = useMemo(() => {
      const balances = {};
      
      // 1. Petakan semua Karyawan Aktif
      (karyawan || []).forEach(k => {
          if(!k.isDeleted && k.status === 'AKTIF') {
              balances[k.id] = { id: k.id, name: k.name, position: k.position, baseSalary: Number(k.baseSalary)||0, totalKasbon: 0, totalDibayar: 0, sisaHutang: 0 };
          }
      });

      // 2. Kalkulasi Histori Kasbon vs Potongan Payroll di Tabel Expenses
      (expenses || []).forEach(e => {
          if (e.isDeleted || !e.employee_id || !balances[e.employee_id]) return;
          
          if (e.category === 'KASBON') {
              balances[e.employee_id].totalKasbon += Number(e.amount);
          }
          if (e.category === 'PAYROLL') {
              balances[e.employee_id].totalDibayar += Number(e.kasbon_deduction || 0);
          }
      });

      // 3. Finalisasi Sisa Hutang
      Object.values(balances).forEach(b => {
          b.sisaHutang = b.totalKasbon - b.totalDibayar;
      });

      return balances;
  }, [karyawan, expenses]);

  const activeEmployees = Object.values(employeeData);

  // =====================================
  // AUTO-FILL PAYROLL & POTONG KASBON
  // =====================================
  useEffect(() => {
      if (formPayroll.employeeId && employeeData[formPayroll.employeeId]) {
          const emp = employeeData[formPayroll.employeeId];
          const hutang = emp.sisaHutang > 0 ? emp.sisaHutang : 0;
          
          setFormPayroll(prev => ({
              ...prev,
              baseSalary: String(emp.baseSalary),
              kasbonDeduction: String(hutang) // Otomatis mengunci sisa hutang ke kolom potongan
          }));
      }
  }, [formPayroll.employeeId]);

  // =====================================
  // HELPER: INPUT RUPIAH OTOMATIS (LOCKED)
  // =====================================
  const handleCurrencyChange = (setter, field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setter(prev => ({ ...prev, [field]: rawValue }));
  };

  // =====================================
  // KALKULASI TOTAL PAYROLL NETTO
  // =====================================
  const payrollTotal = useMemo(() => {
      const base = Number(formPayroll.baseSalary) || 0;
      const allow = Number(formPayroll.allowance) || 0;
      const dedKasbon = Number(formPayroll.kasbonDeduction) || 0;
      const dedOther = Number(formPayroll.otherDeduction) || 0;
      return (base + allow) - (dedKasbon + dedOther);
  }, [formPayroll]);


  // =====================================
  // HANDLERS SUBMIT
  // =====================================
  const handleSimpanMaster = async (e) => {
      e.preventDefault();
      const payload = { id: generateId('EMP', new Date()), name: formMaster.name.toUpperCase(), position: formMaster.position, baseSalary: Number(formMaster.baseSalary), status: 'AKTIF' };
      const success = await sendToSheet('insert', payload, 'karyawan');
      if(success) setFormMaster({ name: '', position: 'PRODUKSI', baseSalary: '' });
  };

  const handleSimpanKasbon = async (e) => {
      e.preventDefault();
      const payload = {
          id: generateId('KSB', formKasbon.date), date: formKasbon.date, employee_id: formKasbon.employeeId, 
          category: 'KASBON', amount: Number(formKasbon.amount), description: `Kasbon Karyawan: ${formKasbon.notes}`, payment_method: 'CASH'
      };
      const success = await sendToSheet('insert', payload, 'expenses');
      if(success) setFormKasbon({ date: todayStr, employeeId: '', amount: '', notes: '' });
  };

  const handleSimpanPayroll = async (e) => {
      e.preventDefault();
      if(payrollTotal < 0) { showToast('⛔ Total Gaji Bersih tidak boleh minus!', 'error'); return; }

      const empName = employeeData[formPayroll.employeeId]?.name || 'UNKNOWN';
      const payload = {
          id: generateId('PAY', formPayroll.date), date: formPayroll.date, employee_id: formPayroll.employeeId,
          category: 'PAYROLL', amount: payrollTotal, base_salary: Number(formPayroll.baseSalary), 
          allowance: Number(formPayroll.allowance), kasbon_deduction: Number(formPayroll.kasbonDeduction),
          other_deduction: Number(formPayroll.otherDeduction), payment_method: formPayroll.paymentMethod,
          description: `Gaji: ${empName}`
      };
      const success = await sendToSheet('insert', payload, 'expenses');
      if(success) setFormPayroll({ date: todayStr, employeeId: '', baseSalary: '', allowance: '', kasbonDeduction: '', otherDeduction: '', paymentMethod: 'CASH' });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER NAVIGASI */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'payroll' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Wallet size={16} className="inline mr-2"/> Gaji & Payroll</button>
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Banknote size={16} className="inline mr-2"/> Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Users size={16} className="inline mr-2"/> Master SDM</button>
      </div>

      {/* ======================================= */}
      {/* TAB 1: PAYROLL (AUTO DEDUCTION ENGINE)  */}
      {/* ======================================= */}
      {activeSubTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-600 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Scissors size={20}/></div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Proses Payroll Baru</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auto-Potong Kasbon Aktif</p>
                    </div>
                </div>

                <form onSubmit={handleSimpanPayroll} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pembayaran</label>
                        <input type="date" required value={formPayroll.date} onChange={e=>setFormPayroll({...formPayroll, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Pilih Karyawan</label>
                        <select required value={formPayroll.employeeId} onChange={e=>setFormPayroll({...formPayroll, employeeId: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-black text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Pilih --</option>
                            {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Gaji Pokok</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                                <input type="text" required value={formPayroll.baseSalary ? Number(formPayroll.baseSalary).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'baseSalary', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan / Lembur</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-black text-emerald-400">Rp</span>
                                <input type="text" value={formPayroll.allowance ? Number(formPayroll.allowance).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'allowance', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none" placeholder="0" />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-3 mt-2">
                        <div className="flex items-center gap-2 text-orange-800 mb-1">
                            <ShieldCheck size={16}/> <span className="text-[10px] font-black uppercase tracking-widest">Sistem Potongan Auto</span>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-orange-700 uppercase">Potong Kasbon</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-black text-orange-400">Rp</span>
                                <input type="text" value={formPayroll.kasbonDeduction ? Number(formPayroll.kasbonDeduction).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'kasbonDeduction', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-white border border-orange-200 rounded-xl font-black text-orange-700 outline-none focus:ring-2 focus:ring-orange-500" placeholder="0" />
                            </div>
                            {formPayroll.employeeId && employeeData[formPayroll.employeeId]?.sisaHutang > 0 && (
                                <p className="text-[9px] font-bold text-rose-600 mt-1">Sistem mendeteksi hutang kasbon aktif: {formatRp(employeeData[formPayroll.employeeId].sisaHutang)}</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-rose-700 uppercase">Potongan Lain (Alfa, dll)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-black text-rose-400">Rp</span>
                                <input type="text" value={formPayroll.otherDeduction ? Number(formPayroll.otherDeduction).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'otherDeduction', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-white border border-rose-200 rounded-xl font-black text-rose-700 outline-none focus:ring-2 focus:ring-rose-500" placeholder="0" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center text-white mt-4 shadow-xl">
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Netto / Gaji Bersih</div>
                            <div className="text-2xl font-black">{formatRp(payrollTotal)}</div>
                        </div>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-all"><CheckCircle size={16}/> Bayar</button>
                    </div>
                </form>
            </div>
            
            <div className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {activeEmployees.slice(0,3).map(emp => (
                        <div key={emp.id} className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase">{emp.position}</div>
                                <div className="font-black text-slate-800 uppercase line-clamp-1">{emp.name}</div>
                            </div>
                            <div className="mt-3 flex justify-between items-end">
                                <div>
                                    <div className="text-[9px] font-bold text-slate-500">Status Kasbon</div>
                                    <div className={`font-black text-xs ${emp.sisaHutang > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{emp.sisaHutang > 0 ? formatRp(emp.sisaHutang) : 'LUNAS'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log History Penggajian</h4>
                  </div>
                  <div className="overflow-x-auto flex-1">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                              <tr><th className="px-4 py-3">Tgl</th><th className="px-4 py-3">Karyawan</th><th className="px-4 py-3 text-right">Gaji + Tunjangan</th><th className="px-4 py-3 text-right text-rose-500">Potongan</th><th className="px-4 py-3 text-right text-emerald-600">Netto Cair</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {(expenses || []).filter(e => !e.isDeleted && e.category === 'PAYROLL').sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10).map(p => (
                                  <tr key={p.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 font-bold text-slate-700">{formatDate(p.date)}</td>
                                      <td className="px-4 py-3 font-black text-slate-800 text-xs uppercase">{employeeData[p.employee_id]?.name || 'UNKNOWN'}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">{formatRp(Number(p.base_salary||0) + Number(p.allowance||0))}</td>
                                      <td className="px-4 py-3 text-right text-rose-600 font-medium">-{formatRp(Number(p.kasbon_deduction||0) + Number(p.other_deduction||0))}</td>
                                      <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(p.amount)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                </div>
            </div>
        </div>
      )}

      {/* ======================================= */}
      {/* TAB 2: KASBON KARYAWAN                  */}
      {/* ======================================= */}
      {activeSubTab === 'kasbon' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-500 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Banknote size={20}/></div>
                    <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Pencairan Kasbon</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hutang Karyawan Baru</p></div>
                </div>
                <form onSubmit={handleSimpanKasbon} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Kasbon</label>
                        <input type="date" required value={formKasbon.date} onChange={e=>setFormKasbon({...formKasbon, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Karyawan</label>
                        <select required value={formKasbon.employeeId} onChange={e=>setFormKasbon({...formKasbon, employeeId: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none focus:ring-2 focus:ring-orange-500">
                            <option value="">-- Pilih --</option>
                            {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-orange-600 uppercase">Nominal Uang Dipinjam</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 font-black text-orange-400">Rp</span>
                            <input type="text" required value={formKasbon.amount ? Number(formKasbon.amount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormKasbon, 'amount', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 outline-none" placeholder="0" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Catatan / Alasan</label>
                        <input type="text" value={formKasbon.notes} onChange={e=>setFormKasbon({...formKasbon, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" placeholder="Cth: Pinjaman untuk sekolah anak" />
                    </div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Kasbon & Potong Kas</button>
                </form>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Daftar Hutang Aktif Karyawan</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Lengkap</th><th className="px-4 py-3 text-right text-rose-500">Total Pinjam</th><th className="px-4 py-3 text-right text-emerald-600">Terbayar (Via Gaji)</th><th className="px-4 py-3 text-right">Sisa Hutang</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {activeEmployees.filter(k => k.sisaHutang > 0).length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-emerald-600 font-bold">Semua karyawan bebas dari hutang kasbon.</td></tr> : 
                          activeEmployees.filter(k => k.sisaHutang > 0).map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name}</td>
                                  <td className="px-4 py-3 text-right font-medium text-rose-600">{formatRp(k.totalKasbon)}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatRp(k.totalDibayar)}</td>
                                  <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/50">{formatRp(k.sisaHutang)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
            </div>
         </div>
      )}

      {/* ======================================= */}
      {/* TAB 3: MASTER SDM                       */}
      {/* ======================================= */}
      {activeSubTab === 'master' && (
          /* [Kode UI Tab Master SDM tetap mirip, dengan perlindungan Rp Prefix pada Base Salary] */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800 h-max">
                  <div className="flex items-center gap-3 mb-6 border-b pb-4">
                      <div className="bg-slate-100 text-slate-700 p-2 rounded-lg"><Users size={20}/></div>
                      <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data SDM Baru</h3></div>
                  </div>
                  <form onSubmit={handleSimpanMaster} className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap</label>
                          <input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Divisi / Posisi</label>
                          <select required value={formMaster.position} onChange={e=>setFormMaster({...formMaster, position: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none">
                              <option value="PRODUKSI">Dapur / Produksi</option><option value="KASIR">Kasir / Outlet</option><option value="DRIVER">Driver / Kurir</option><option value="ADMIN">Admin / Finance</option>
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-emerald-600 uppercase">Gaji Pokok Default</label>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 font-black text-emerald-400">Rp</span>
                              <input type="text" required value={formMaster.baseSalary ? Number(formMaster.baseSalary).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormMaster, 'baseSalary', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none" />
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Karyawan</button>
                  </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database SDM Aktif</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">ID & Nama Lengkap</th><th className="px-4 py-3">Posisi</th><th className="px-4 py-3 text-right">Base Salary</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {activeEmployees.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3"><div className="font-black text-slate-800 uppercase">{k.name}</div><div className="font-mono text-[9px] font-bold text-slate-400">{k.id}</div></td>
                                  <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider">{k.position}</span></td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(k.baseSalary)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}
