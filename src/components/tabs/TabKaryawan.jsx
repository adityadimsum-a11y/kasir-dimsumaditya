import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle, Banknote, ShieldCheck } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'CIBINONG';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  // FIX POINT 3: Jika Cabang Resto, Kunci Sub-Tab mutlak di 'kasbon' (Sembunyikan sistem Gaji)
  const [activeSubTab, setActiveSubTab] = useState(isHQ ? 'payroll' : 'kasbon');
  const [formKasbon, setFormKasbon] = useState({ date: todayStr, employeeId: '', amount: '', notes: '' });
  const [formMaster, setFormMaster] = useState({ name: '', position: 'KASIR', baseSalary: '0' });
  const [formPayroll, setFormPayroll] = useState({ date: todayStr, employeeId: '', baseSalary: '', allowance: '', kasbonDeduction: '', otherDeduction: '', paymentMethod: 'CASH' });

  // SMART COMPILING: Filter Karyawan & Kasbon Kepatuhan Cabang ("Jangan Nyampur")
  const employeeData = useMemo(() => {
      const balances = {};
      
      // Filter Karyawan: Pusat melihat semua, Cabang hanya melihat staf miliknya sendiri
      (karyawan || []).forEach(k => {
          if (k.isDeleted) return;
          const matchBranch = isHQ ? true : String(k.branch_id).toUpperCase() === currentBranch.toUpperCase();
          if (matchBranch) {
              balances[k.id] = { id: k.id, name: k.name, position: k.position, branch_id: k.branch_id, totalKasbon: 0, totalDibayar: 0, sisaHutang: 0 };
          }
      });

      // Kalkulasi Arus Kasbon Terikat Kode Cabang masing-masing
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
          b.sisaHutang = b.totalKasbon - b.totalDibayar;
      });

      return balances;
  }, [karyawan, expenses, currentBranch, isHQ]);

  const activeEmployees = Object.values(employeeData);

  const handleSimpanKasbon = async (e) => {
      e.preventDefault();
      if (!formKasbon.employeeId) { showToast('Pilih nama karyawan!', 'error'); return; }
      
      const targetEmp = employeeData[formKasbon.employeeId];

      // FIX POINT 3: Menyuntikkan branch_id agar nancap aman di Google Sheets Pusat (Tangerang)
      const payload = {
          id: generateId('KSB', formKasbon.date), 
          date: formKasbon.date, 
          branch_id: currentBranch, // Kunci utama pemisah cabang di database Tangerang
          employee_id: formKasbon.employeeId, 
          category: 'KASBON', 
          amount: Number(formKasbon.amount), 
          description: `Kasbon [${currentBranch}] - Karyawan: ${targetEmp.name}. Catatan: ${formKasbon.notes}`, 
          payment_method: 'CASH'
      };

      const success = await sendToSheet('insert', payload, 'expenses');
      if(success) {
          setFormKasbon({ date: todayStr, employeeId: '', amount: '', notes: '' });
          if(showToast) showToast('Data Kasbon berhasil diteruskan ke Tangerang!', 'success');
      }
  };

  const handleSimpanMaster = async (e) => {
      e.preventDefault();
      const payload = { id: generateId('EMP', new Date()), name: formMaster.name.toUpperCase(), position: formMaster.position, baseSalary: Number(formMaster.baseSalary), branch_id: currentBranch, status: 'AKTIF' };
      const success = await sendToSheet('insert', payload, 'karyawan');
      if(success) setFormMaster({ name: '', position: 'KASIR', baseSalary: '0' });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* NAVIGASI SUB-TAB: OTOMATIS DISESUAIKAN BERDASARKAN CABANG */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        {isHQ && (
          <button onClick={() => setActiveSubTab('payroll')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'payroll' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Gaji & Payroll</button>
        )}
        <button onClick={() => setActiveSubTab('kasbon')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'kasbon' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Banknote size={16} className="inline mr-2"/> Kasbon Karyawan</button>
        <button onClick={() => setActiveSubTab('master')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${activeSubTab === 'master' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Users size={16} className="inline mr-2"/> {isHQ ? 'Master SDM Global' : 'Registrasi Staf Lokal'}</button>
      </div>

      {/* TAB KASBON KARYAWAN (CONNECTED TO TANGERANG) */}
      {activeSubTab === 'kasbon' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-500 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Banknote size={20}/></div>
                    <div><h3 className="font-black text-slate-800 text-sm uppercase">Pencairan Kasbon</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ambil Kas Laci Cabang</p></div>
                </div>
                <form onSubmit={handleSimpanKasbon} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pencairan</label>
                        <input type="date" required value={formKasbon.date} onChange={e=>setFormKasbon({...formKasbon, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Karyawan Node {currentBranch}</label>
                        <select required value={formKasbon.employeeId} onChange={e=>setFormKasbon({...formKasbon, employeeId: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none">
                            <option value="">-- Pilih Anggota --</option>
                            {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-orange-600 uppercase">Nominal Uang Dipinjam</label>
                        <input type="number" required value={formKasbon.amount} onChange={e=>setFormKasbon({...formKasbon, amount: e.target.value})} className="w-full p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl font-black text-sm" placeholder="Rp" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Alasan Keperluan Pinjaman</label>
                        <input type="text" value={formKasbon.notes} onChange={e=>setFormKasbon({...formKasbon, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" placeholder="Cth: Pinjaman berobat keluarga" />
                    </div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan & Ajukan Pinjaman</button>
                </form>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Daftar Hutang Aktif Karyawan Cabang</h4>
                      <span className="text-[10px] bg-slate-900 text-white font-black px-2 py-0.5 rounded uppercase">Lokasi: {currentBranch}</span>
                  </div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Lengkap</th><th className="px-4 py-3">Posisi</th><th className="px-4 py-3 text-right text-rose-500">Total Pinjam</th><th className="px-4 py-3 text-right">Sisa Hutang</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {activeEmployees.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Tidak ada staf terdaftar di cabang ini.</td></tr> : 
                          activeEmployees.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name} <div className="text-[8px] font-mono text-slate-400">{k.id}</div></td>
                                  <td className="px-4 py-3 uppercase text-slate-500">{k.position}</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-600">{formatRp(k.totalKasbon)}</td>
                                  <td className="px-4 py-3 text-right font-black text-orange-600 bg-orange-50/50">{formatRp(k.sisaHutang)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
            </div>
         </div>
      )}

      {/* REGISTRASI STAF LOKAL */}
      {activeSubTab === 'master' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800 h-max">
                  <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-slate-100 text-slate-700 p-2 rounded-lg"><Users size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase">Registrasi Staf</h3></div></div>
                  <form onSubmit={handleSimpanMaster} className="space-y-4">
                      <div><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Lengkap Karyawan</label><input type="text" required value={formMaster.name} onChange={e=>setFormMaster({...formMaster, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
                      <div><label className="text-[10px] font-bold text-slate-600 uppercase">Posisi Kerja</label><select required value={formMaster.position} onChange={e=>setFormMaster({...formMaster, position: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase"><option value="KASIR">KASIR / RESTO FRONT</option><option value="DAPUR_RESTO">COOK / dAPUR RESTO</option><option value="WAITRESS">PRAMUSAJI / WAITRESS</option></select></div>
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Data Staf</button>
                  </form>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 text-sm uppercase">Database Karyawan Aktif Node Ini</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">ID & Nama Lengkap</th><th className="px-4 py-3">Posisi</th><th className="px-4 py-3">Cabang Penempatan</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {activeEmployees.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{k.name} <div className="font-mono text-[9px] font-bold text-slate-400">{k.id}</div></td>
                                  <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{k.position}</span></td>
                                  <td className="px-4 py-3 font-black text-indigo-600 uppercase">{k.branch_id || currentBranch}</td>
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
