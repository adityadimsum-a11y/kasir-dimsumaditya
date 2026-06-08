import React, { useState } from 'react';
import { Users, FileText, CheckCircle, Plus, Printer, Wallet, AlertCircle, Trash2, Edit2, Archive } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, sendToSheet, setPrintData, requestDelete }) {
  const todayStr = getTodayStr();
  const [activeSubTab, setActiveSubTab] = useState('payroll');

  const [formMaster, setFormMaster] = useState({ name: '', position: 'PRODUKSI', baseSalary: '', status: 'AKTIF' });
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const [formPayroll, setFormPayroll] = useState({ date: todayStr, employeeId: '', baseSalary: 0, allowance: '', kasbonDeduction: '', otherDeduction: '', paymentMethod: 'CASH' });

  const handleCurrencyChange = (setter, field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setter(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleSimpanMaster = (e) => {
      e.preventDefault();
      const payload = {
          id: generateId('EMP', todayStr),
          name: formMaster.name.toUpperCase(),
          position: formMaster.position,
          base_salary: Number(formMaster.baseSalary),
          status: formMaster.status
      };
      sendToSheet('insert', payload, 'karyawan');
      setFormMaster({ name: '', position: 'PRODUKSI', baseSalary: '', status: 'AKTIF' });
  };

  const handleSimpanKasbon = (e) => {
      e.preventDefault();
      const emp = karyawan.find(k => k.id === formKasbon.employeeId);
      const payload = {
          id: generateId('KSB', formKasbon.date), date: formKasbon.date, category: 'KASBON_KARYAWAN',
          description: `Kasbon: ${emp.name} - ${formKasbon.notes}`, amount: Number(formKasbon.amount), 
          payment_method: 'CASH', employee_id: emp.id, employee_name: emp.name
      };
      sendToSheet('insert', payload, 'expenses');
      setFormKasbon({ ...formKasbon, amount: '', notes: '' });
  };

  const handleSelectEmployeeForPayroll = (empId) => {
      const emp = karyawan.find(k => k.id === empId);
      if(emp) {
          // Logika Sisa Hutang: Total Kasbon - Total yang sudah dipotong di Payroll
          const totalKasbon = (expenses || []).filter(e => e.category === 'KASBON_KARYAWAN' && e.employee_id === empId).reduce((sum, e) => sum + Number(e.amount), 0);
          const totalDibayar = (expenses || []).filter(e => e.category === 'GAJI_KARYAWAN' && e.employee_name === emp.name).reduce((sum, e) => sum + Number(e.kasbon_deduction || 0), 0);
          const sisaKasbon = totalKasbon - totalDibayar;

          setFormPayroll({ ...formPayroll, employeeId: empId, baseSalary: emp.base_salary, allowance: '', kasbonDeduction: sisaKasbon > 0 ? String(sisaKasbon) : '', otherDeduction: '' });
      }
  };

  const netSalary = Number(formPayroll.baseSalary) + Number(formPayroll.allowance) - Number(formPayroll.kasbonDeduction) - Number(formPayroll.otherDeduction);

  const handleSimpanPayroll = (e) => {
      e.preventDefault();
      const emp = karyawan.find(k => k.id === formPayroll.employeeId);
      const payload = {
          id: generateId('PAY', formPayroll.date), date: formPayroll.date, category: 'GAJI_KARYAWAN',
          description: `Gaji: ${emp.name}`, amount: netSalary, payment_method: formPayroll.paymentMethod,
          employee_name: emp.name, position: emp.position, base_salary: formPayroll.baseSalary,
          allowance: formPayroll.allowance, kasbon_deduction: formPayroll.kasbonDeduction,
          other_deduction: formPayroll.otherDeduction, net_salary: netSalary
      };
      sendToSheet('insert', payload, 'expenses');
      setPrintData({ type: 'SLIP_GAJI', data: payload });
  };

  // Kalkulasi Summary Bulan Ini
  const curMonth = todayStr.substring(0, 7);
  const summary = {
      totalGaji: (expenses || []).filter(e => e.category === 'GAJI_KARYAWAN' && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.net_salary), 0),
      totalKasbon: (expenses || []).filter(e => e.category === 'KASBON_KARYAWAN' && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.amount), 0),
      sisaPiutang: (expenses || []).filter(e => e.category === 'KASBON_KARYAWAN').reduce((sum, e) => sum + Number(e.amount), 0) - (expenses || []).filter(e => e.category === 'GAJI_KARYAWAN').reduce((sum, e) => sum + Number(e.kasbon_deduction || 0), 0)
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="grid grid-cols-3 gap-4">
        {[ {l: 'Total Gaji Bulan Ini', v: summary.totalGaji, c: 'text-blue-600'}, {l: 'Total Kasbon Bulan Ini', v: summary.totalKasbon, c: 'text-orange-600'}, {l: 'Sisa Piutang Karyawan', v: summary.sisaPiutang, c: 'text-red-600'} ].map((s, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.l}</div>
                <div className={`text-xl font-black ${s.c}`}>{formatRp(s.v)}</div>
            </div>
        ))}
      </div>

      <div className="flex bg-slate-200 p-1.5 rounded-2xl w-max shadow-inner">
          <button onClick={() => setActiveSubTab('payroll')} className={`px-6 py-2 rounded-xl font-bold text-sm ${activeSubTab === 'payroll' ? 'bg-white text-blue-600' : 'text-slate-500'}`}>Payroll</button>
          <button onClick={() => setActiveSubTab('kasbon')} className={`px-6 py-2 rounded-xl font-bold text-sm ${activeSubTab === 'kasbon' ? 'bg-white text-orange-600' : 'text-slate-500'}`}>Kasbon</button>
          <button onClick={() => setActiveSubTab('master')} className={`px-6 py-2 rounded-xl font-bold text-sm ${activeSubTab === 'master' ? 'bg-white text-slate-800' : 'text-slate-500'}`}>Karyawan</button>
      </div>

      {activeSubTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border">
                <form onSubmit={handleSimpanPayroll} className="space-y-4">
                    <select required onChange={e=>handleSelectEmployeeForPayroll(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                        <option value="">Pilih Karyawan</option>
                        {(karyawan||[]).filter(k=>k.status==='AKTIF').map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                    <div><label className="text-[10px] font-bold text-slate-600 uppercase">Gaji Pokok</label><input type="text" readOnly value={formPayroll.baseSalary.toLocaleString('id-ID')} className="w-full p-2 bg-slate-100 border rounded-lg font-black" /></div>
                    <div><label className="text-[10px] font-bold text-emerald-600 uppercase">Tunjangan (+)</label><input type="text" value={formPayroll.allowance ? Number(formPayroll.allowance).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'allowance', e.target.value)} className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-700" /></div>
                    <div><label className="text-[10px] font-bold text-red-600 uppercase">Potong Kasbon (-)</label><input type="text" value={formPayroll.kasbonDeduction ? Number(formPayroll.kasbonDeduction).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormPayroll, 'kasbonDeduction', e.target.value)} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg font-black text-red-700" /></div>
                    <div className="text-xl font-black">{formatRp(netSalary)}</div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Bayar & Cetak</button>
                </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-[10px] uppercase"><th>Tgl</th><th>Nama</th><th>Total</th><th>Aksi</th></tr></thead>
                    <tbody>{(expenses||[]).filter(e=>e.category==='GAJI_KARYAWAN').map(p => (
                        <tr key={p.id}><td>{formatDate(p.date)}</td><td>{p.employee_name}</td><td>{formatRp(p.amount)}</td><td><button onClick={() => requestDelete(p.id)}><Trash2 size={16} className="text-red-500"/></button></td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
      )}

      {activeSubTab === 'master' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-[10px] uppercase"><th>Nama</th><th>Posisi</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>{(karyawan||[]).map(k => (
                    <tr key={k.id}><td>{k.name}</td><td>{k.position}</td><td>{k.status}</td><td><button onClick={() => requestDelete(k.id)}><Trash2 size={16} className="text-red-500"/></button></td></tr>
                ))}</tbody>
            </table>
        </div>
      )}
    </div>
  );
}
