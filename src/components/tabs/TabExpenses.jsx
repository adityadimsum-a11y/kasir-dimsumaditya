import React, { useState } from 'react';
import { Wallet, CheckCircle, Clock } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabExpenses({ expenses, sendToSheet }) {
  const todayStr = getTodayStr();
  const [form, setForm] = useState({
      date: todayStr, category: 'OPERASIONAL', description: '', amount: '', paymentMethod: 'CASH'
  });

  // HELPER: INPUT RUPIAH OTOMATIS
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

const handleSubmit = async (e) => {
      e.preventDefault();
      
      // 1. Siapkan data untuk tabel Pengeluaran (Expenses)
      const expenseId = generateId('EXP', form.date);
      const payloadExpense = {
          id: expenseId, 
          date: form.date, 
          category: form.category,
          description: form.description, 
          amount: Number(form.amount), 
          payment_method: form.paymentMethod,
          branch_id: user?.branch_id || 'TANGERANG_PUSAT' // Catat siapa yang keluarin uang
      };

      // 2. Siapkan data tembusan untuk Buku Besar (Cashflow Transactions)
      const payloadCashflow = {
          id: generateId('CASH', form.date),
          date: form.date,
          branch_id: user?.branch_id || 'TANGERANG_PUSAT',
          type: 'OUT', // Arus Kas Keluar
          method: form.paymentMethod,
          amount: Number(form.amount),
          description: `EXPENSE: ${form.category} - ${form.description}`,
          reference_id: expenseId // Hubungkan dengan ID Pengeluaran
      };

      // 3. Tembak kedua data ke database secara berurutan
      const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
      
      if (successExpense) {
          // Jika sukses simpan pengeluaran, langsung potong saldo dompet
          await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
          setForm({...form, description: '', amount: ''});
      }
  };

  const listExpenses = (expenses || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-500">
          <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg"><Wallet size={20}/></div><div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Pencatatan Kas & Operasional</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Catat semua biaya listrik, gaji, bensin, dll</p></div></div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Kategori Biaya</label>
                  <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="OPERASIONAL">Operasional (Listrik, Air)</option>
                      <option value="MARKETING">Marketing & Iklan</option>
                      <option value="LOGISTIK">Logistik & Bensin</option>
                      <option value="LAINNYA">Lain-lain / Miscellaneous</option>
                  </select>
              </div>
              <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-600 uppercase">Deskripsi Pengeluaran</label><input type="text" required placeholder="Beli lakban, bayar listrik, dll..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium text-sm" /></div>
              
              {/* INPUT RUPIAH: NOMINAL */}
              <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-red-600 uppercase">Nominal Keluar (Rp)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-red-600/50">Rp</span>
                      <input type="text" required placeholder="0" value={form.amount ? Number(form.amount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('amount', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-red-50 border border-red-200 rounded-xl font-black text-red-700 outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Sumber Dana</label>
                  <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="CASH">Kas Tunai</option><option value="TRANSFER">Rekening Bank</option>
                  </select>
              </div>

              <div className="mt-6">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl shadow-md transition tracking-wide uppercase text-xs flex items-center justify-center gap-2 h-[45px]"><CheckCircle size={16}/> Catat Pengeluaran</button>
              </div>
          </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Buku Kas & Pengeluaran</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Tgl & ID</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Deskripsi</th><th className="px-4 py-3 text-center">Sumber Dana</th><th className="px-4 py-3 text-right">Nominal</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listExpenses.map(e => (
                          <tr key={e.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-bold text-slate-700">{formatDate(e.date)}</div><div className="text-[10px] text-slate-500 font-mono">{e.id}</div></td>
                              <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-bold uppercase">{e.category}</span></td>
                              <td className="px-4 py-3 text-slate-800">{e.description}</td>
                              <td className="px-4 py-3 text-center font-bold text-xs uppercase text-slate-500">{e.payment_method}</td>
                              <td className="px-4 py-3 text-right font-black text-red-600">-{formatRp(e.amount)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
