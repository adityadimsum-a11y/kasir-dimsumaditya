import React, { useState } from 'react';
import { Users, FileText, CheckCircle, Plus, Printer, Wallet, AlertCircle } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, sendToSheet, setPrintData }) {
  const todayStr = getTodayStr();
  const [activeSubTab, setActiveSubTab] = useState('payroll'); // 'master', 'kasbon', 'payroll'

  // =====================================
  // STATE FORMS
  // =====================================
  const [formMaster, setFormMaster] = useState({ name: '', position: 'PRODUKSI', baseSalary: '' });
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  
  const [formPayroll, setFormPayroll] = useState({ 
      date: todayStr, employeeId: '', 
      baseSalary: 0, allowance: '', kasbonDeduction: '', otherDeduction: '', paymentMethod: 'CASH' 
  });

  // =====================================
  // HANDLERS
  // =====================================
  const handleSimpanMaster = (e) => {
      e.preventDefault();
      const payload = {
          id: generateId('EMP', todayStr),
          name: formMaster.name.toUpperCase(),
          position: formMaster.position,
          base_salary: Number(formMaster.baseSalary),
          status: 'AKTIF'
      };
      sendToSheet('insert', payload, 'karyawan');
      setFormMaster({ name: '', position: 'PRODUKSI', baseSalary: '' });
  };

  const handleSimpanKasbon = (e) => {
      e.preventDefault();
      const emp = karyawan.find(k => k.id === formKasbon.employeeId);
      if(!emp) return;

      const payload = {
          id: generateId('KSB', formKasbon.date),
          date: formKasbon.date,
          category: 'KASBON_KARYAWAN',
          description: `Kasbon: ${emp.name} - ${formKasbon.notes}`,
          amount: Number(formKasbon.amount),
          payment_method: 'CASH',
          employee_id: emp.id,
          employee_name: emp.name
      };
      // Kasbon memotong kas operasional
      sendToSheet('insert', payload, 'expenses');
      setFormKasbon({ ...formKasbon, amount: '', notes: '' });
  };

  const handleSelectEmployeeForPayroll = (empId) => {
      const emp = karyawan.find(k => k.id === empId);
      if(emp) {
          setFormPayroll({ ...formPayroll, employeeId: empId, baseSalary: emp.base_salary, allowance: '0', kasbonDeduction: '0', otherDeduction: '0' });
      }
  };

  const totalPenerimaan = Number(formPayroll.baseSalary) + Number(formPayroll.allowance);
  const totalPotongan = Number(formPayroll.kasbonDeduction) + Number(formPayroll.otherDeduction);
  const netSalary = totalPenerimaan - totalPotongan;

  const handleSimpanPayroll = (e) => {
      e.preventDefault();
      const emp = karyawan.find(k => k.id === formPayroll.employeeId);
      if(!emp) return;

      const payrollId = generateId('PAY', formPayroll.date);
      const payload = {
          id: payrollId,
          date: formPayroll.date,
          category: 'GAJI_KARYAWAN',
          description: `Gaji & Upah: ${emp.name}`,
          amount: netSalary, // Yang memotong kas perusahaan adalah Gaji Bersih
          payment_method: formPayroll.paymentMethod,
          
          // Meta data untuk dicetak di slip gaji
          employee_name: emp.name,
          position: emp.position,
          base_salary: formPayroll.baseSalary,
          allowance: formPayroll.allowance,
          kasbon_deduction: formPayroll.kasbonDeduction,
          other_deduction: formPayroll.otherDeduction,
          net_salary: netSalary
      };

      sendToSheet('insert', payload, 'expenses');
      
      // Langsung munculkan jendela cetak Slip Gaji
      setPrintData({ type: 'SLIP_GAJI', data: payload });
      setFormPayroll({ ...formPayroll, employeeId: '', baseSalary: 0, allowance: '', kasbonDeduction: '', otherDeduction: '' });
  };

  // =====================================
  // RENDERERS
  // =====================================
  const listKasbon = (expenses || []).filter(e => e.category === 'KASBON_KARYAWAN').sort((a,b) => new Date(b.date) - new Date(a.date));
  const listPayroll = (expenses || []).filter(e => e.category === 'GAJI_KARYAWAN').sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      {/* TOP NAVIGATION TABS */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl w-max shadow-inner">
          <button onClick={() => setActiveSubTab('payroll')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'payroll' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><Wallet size={16}/> Payroll & Slip Gaji</button>
          <button onClick={() => setActiveSubTab('kasbon')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'kasbon' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><AlertCircle size={16}/> Kasbon (Pinjaman)</button>
          <button onClick={() => setActiveSubTab('master')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'master' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><Users size={16}/> Master Karyawan</button>
      </div>

      {/* ========================================================= */}
      {/* 1. TAB: PAYROLL & SLIP GAJI */}
      {/* ========================================================= */}
      {activeSubTab === 'payroll' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* KIRI: FORM PAYROLL */}
              <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-500 h-max">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide mb-1 flex items-center gap-2"><FileText size={20} className="text-blue-500"/> Kalkulator Gaji</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Hitung dan terbitkan slip gaji</p>
                  
                  <form onSubmit={handleSimpanPayroll} className="space-y-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pembayaran</label><input type="date" required value={formPayroll.date} onChange={e=>setFormPayroll({...formPayroll, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Pilih Karyawan</label>
                          <select required value={formPayroll.employeeId} onChange={e=>handleSelectEmployeeForPayroll(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                              <option value="">-- Pilih --</option>
                              {(karyawan||[]).filter(k=>k.status==='AKTIF').map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                          </select>
                      </div>

                      {formPayroll.employeeId && (
                          <div className="space-y-3 pt-4 border-t border-dashed">
                              <div><label className="text-[10px] font-black text-slate-500 uppercase">Gaji Pokok / Harian (Standar)</label><input type="number" readOnly value={formPayroll.baseSalary} className="w-full p-2 bg-slate-100 border rounded-lg font-black text-slate-600 cursor-not-allowed outline-none" /></div>
                              <div><label className="text-[10px] font-black text-emerald-600 uppercase">Uang Tunjangan / Lembur (+)</label><input type="number" required placeholder="0" value={formPayroll.allowance} onChange={e=>setFormPayroll({...formPayroll, allowance: e.target.value})} className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-700" /></div>
                              <div><label className="text-[10px] font-black text-red-600 uppercase">Potongan Kasbon (-)</label><input type="number" required placeholder="0" value={formPayroll.kasbonDeduction} onChange={e=>setFormPayroll({...formPayroll, kasbonDeduction: e.target.value})} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg font-black text-red-700" /></div>
                              <div><label className="text-[10px] font-black text-red-600 uppercase">Potongan Absen / Lainnya (-)</label><input type="number" required placeholder="0" value={formPayroll.otherDeduction} onChange={e=>setFormPayroll({...formPayroll, otherDeduction: e.target.value})} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg font-black text-red-700" /></div>
                              
                              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Bayar Dari Rekening Kas</label>
                                  <select value={formPayroll.paymentMethod} onChange={e=>setFormPayroll({...formPayroll, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                                      <option value="CASH">Cash Tunai</option>
                                      <option value="TRANSFER">Transfer Bank</option>
                                  </select>
                              </div>

                              <div className="bg-slate-900 p-4 rounded-xl text-white mt-4 shadow-inner">
                                  <div className="text-[10px] font-black uppercase text-slate-400">Take Home Pay (Net)</div>
                                  <div className="text-2xl font-black">{formatRp(netSalary)}</div>
                              </div>

                              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"><CheckCircle size={18}/> Bayar & Cetak Slip Gaji</button>
                          </div>
                      )}
                  </form>
              </div>

              {/* KANAN: HISTORI PAYROLL */}
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Histori Pembayaran Gaji</h4></div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                              <tr><th className="px-4 py-3">Tgl Bayar</th><th className="px-4 py-3">Nama Karyawan</th><th className="px-4 py-3 text-right">Net Gaji (Rp)</th><th className="px-4 py-3 text-center">Aksi</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {listPayroll.map(p => (
                                  <tr key={p.id} className="hover:bg-slate-50 transition">
                                      <td className="px-4 py-3"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-500">{p.id}</div></td>
                                      <td className="px-4 py-3 font-black text-slate-800 uppercase">{p.employee_name} <span className="text-[10px] font-bold text-slate-400 block">{p.position}</span></td>
                                      <td className="px-4 py-3 text-right font-black text-blue-600 bg-blue-50/50">{formatRp(p.amount)}</td>
                                      <td className="px-4 py-3 text-center">
                                          <button onClick={() => setPrintData({ type: 'SLIP_GAJI', data: p })} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition" title="Print Ulang Slip Gaji"><Printer size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* ========================================================= */}
      {/* 2. TAB: KASBON KARYAWAN */}
      {/* ========================================================= */}
      {activeSubTab === 'kasbon' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-500">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide mb-4">Input Kasbon</h3>
                  <form onSubmit={handleSimpanKasbon} className="space-y-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal</label><input type="date" required value={formKasbon.date} onChange={e=>setFormKasbon({...formKasbon, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Karyawan</label>
                          <select required value={formKasbon.employeeId} onChange={e=>setFormKasbon({...formKasbon, employeeId: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                              <option value="">-- Pilih --</option>
                              {(karyawan||[]).filter(k=>k.status==='AKTIF').map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nominal (Rp)</label><input type="number" required placeholder="0" value={formKasbon.amount} onChange={e=>setFormKasbon({...formKasbon, amount: e.target.value})} className="w-full p-2.5 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Keterangan / Alasan</label><input type="text" required value={formKasbon.notes} onChange={e=>setFormKasbon({...formKasbon, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium text-sm" /></div>
                      <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"><Plus size={18}/> Catat Hutang Karyawan</button>
                  </form>
              </div>

              <div className="md:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log Pinjaman Berjalan</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Tgl & ID</th><th className="px-4 py-3">Nama Karyawan</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-right">Nominal</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {listKasbon.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3"><div className="font-bold text-slate-700">{formatDate(k.date)}</div></td>
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.employee_name}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{k.description}</td>
                                  <td className="px-4 py-3 text-right font-black text-orange-600">{formatRp(k.amount)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ========================================================= */}
      {/* 3. TAB: MASTER DATA KARYAWAN */}
      {/* ========================================================= */}
      {activeSubTab === 'master' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide mb-4">Tambah Karyawan Baru</h3>
                  <form onSubmit={handleSimpanMaster} className="space-y-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap</label><input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Posisi / Jabatan</label>
                          <select required value={formMaster.position} onChange={e=>setFormMaster({...formMaster, position: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                              <option value="PRODUKSI">Tim Produksi (Dapur)</option>
                              <option value="KASIR">Kasir / Frontliner</option>
                              <option value="DRIVER">Driver / Ekspedisi</option>
                              <option value="ADMIN">Admin / Backoffice</option>
                          </select>
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok Standar (Rp)</label><input type="number" required placeholder="0" value={formMaster.baseSalary} onChange={e=>setFormMaster({...formMaster, baseSalary: e.target.value})} className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700" /></div>
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"><Plus size={18}/> Simpan Master Data</button>
                  </form>
              </div>

              <div className="md:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database SDM Aktif</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">ID Karyawan</th><th className="px-4 py-3">Nama Lengkap</th><th className="px-4 py-3">Posisi</th><th className="px-4 py-3 text-right">Base Salary</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {(karyawan || []).filter(k => k.status === 'AKTIF').map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-mono text-[10px] font-bold text-slate-500">{k.id}</td>
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name}</td>
                                  <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-bold uppercase">{k.position}</span></td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(k.base_salary)}</td>
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
