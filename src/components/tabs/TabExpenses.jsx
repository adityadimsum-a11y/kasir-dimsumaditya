import React, { useState } from 'react';
import { Wallet, CheckCircle, Clock } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabExpenses({ expenses, sendToSheet, user }) {
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
          branch_id: user?.branch_id || 'TANGERANG_PUSAT'
      };

      // 2. Siapkan data tembusan untuk Buku Besar (Cashflow Transactions)
      const payloadCashflow = {
          id: generateId('CFO', form.date),
          date: form.date,
          branch_id: user?.branch_id || 'TANGERANG_PUSAT',
          type: 'OUT', 
          category: 'PENGELUARAN ' + form.category,
          method: form.paymentMethod,
          amount: Number(form.amount),
          description: `EXPENSE: ${form.description}`,
          reference_id: expenseId 
      };

      // 3. Tembak kedua data ke database secara berurutan
      const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
      
      if (successExpense) {
          await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
          setForm({...form, description: '', amount: ''});
      }
  };

  const listExpenses = (expenses || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-500">
          <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl"><Wallet size={20}/></div>
              <div><h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Catat Pengeluaran</h2><p className="text-xs font-bold text-slate-500">Biaya operasional, bensin, listrik, &amp; lain-lain.</p></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tgl Keluar</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold bg-slate-50 outline-none" /></div>
                  <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Kategori</label>
                      <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none cursor-pointer">
                          <option value="OPERASIONAL">Operasional Pabrik</option>
                          <option value="MARKETING">Marketing & Iklan</option>
                          <option value="GAJI">Gaji / Bonus</option>
                          <option value="LAINNYA">Lain-lain</option>
                      </select>
                  </div>
              </div>
              <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Keterangan / Rincian</label><input type="text" required placeholder="Cth: Bayar listrik pabrik bulan ini..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-indigo-400 focus:bg-white transition" /></div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nominal (Rp)</label><input type="text" required placeholder="0" value={formatRp(form.amount).replace('Rp', '').trim()} onChange={e=>handleCurrencyChange('amount', e.target.value)} className="w-full p-2.5 border rounded-xl text-sm font-black text-indigo-700 bg-indigo-50 outline-none focus:border-indigo-400" /></div>
                  <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Sumber Uang</label>
                      <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none cursor-pointer">
                          <option value="CASH">Kas Tunai (Laci)</option>
                          <option value="TF_BCA">Transfer BCA</option>
                      </select>
                  </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-md">Catat Beban Pengeluaran</button>
          </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-xs flex items-center gap-2"><Clock size={14} className="text-indigo-500"/> Riwayat Pengeluaran</h4></div>
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
                            <td className="px-4 py-3 text-right font-black text-rose-600">{formatRp(e.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
