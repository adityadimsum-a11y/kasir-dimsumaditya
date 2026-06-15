import React, { useState } from 'react';
import { Wallet, Clock, ArrowDownRight, FileText } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

// 🔥 HELPER LOKAL ANTI-CRASH
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

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
      if (Number(form.amount) <= 0) return alert("Nominal pengeluaran harus lebih besar dari Rp 0!");
      
      const confirmMsg = `Konfirmasi Catat Pengeluaran:\n\n` +
        `Kategori: ${form.category.replace('_', ' ')}\n` +
        `Nominal: ${formatRupiah(form.amount)}\n` +
        `Sumber Dana: ${form.paymentMethod.replace('_', ' ')}\n\n` +
        `Sistem akan memotong kas. Lanjutkan?`;
        
      if (!window.confirm(confirmMsg)) return;

      // 1. Siapkan data untuk tabel Pengeluaran (Expenses)
      const expenseId = generateId('EXP', form.date);
      const payloadExpense = {
          id: expenseId, 
          date: form.date, 
          category: form.category,
          description: form.description.toUpperCase(), 
          amount: Number(form.amount), 
          payment_method: form.paymentMethod,
          branch_id: user?.branch_id || 'TANGERANG_PUSAT',
          isDeleted: false
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
          description: `BIAYA: [${form.category}] ${form.description.toUpperCase()}`,
          reference_id: expenseId,
          isDeleted: false
      };

      // 3. Tembak kedua data ke database secara berurutan
      const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
      
      if (successExpense) {
          await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
          setForm({...form, description: '', amount: ''});
      }
  };

  // Filter & Sort list untuk tabel (Abaikan data yang kena Soft Delete)
  const listExpenses = (expenses || [])
    .filter(e => !e.isDeleted)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800 normal-case duration-300">
      
      {/* FORM PENCATATAN PENGELUARAN */}
      <div className="card-holo bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl"><Wallet size={18}/></div>
              <div>
                <h2 className="text-sm font-black text-slate-800 normal-case">Pencatatan Beban Pengeluaran Kas</h2>
                <p className="text-[10px] font-bold text-slate-500 normal-case mt-0.5">Kunci pengeluaran operasional harian agar memotong alokasi kantong pos yang tepat.</p>
              </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1.5">Tanggal Keluar Kas</label>
                    <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:border-indigo-400 focus:bg-white transition-colors" />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-indigo-600 normal-case block mb-1.5 flex items-center gap-1"><ArrowDownRight size={12}/> Kategori Alokasi Anggaran</label>
                      <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 border border-indigo-200 rounded-xl text-xs font-black uppercase text-indigo-800 bg-indigo-50/50 outline-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-colors">
                          <option value="OPERASIONAL">AMPLOP 2: Operasional Pabrik / Bahan Pendukung</option>
                          <option value="GAJI">AMPLOP 2: Gaji Karyawan / Bonus Tim</option>
                          <option value="MARKETING">AMPLOP 2: Marketing, Iklan, &amp; Sales</option>
                          <option value="DARURAT_SERVIS">AMPLOP 3: Dana Cadangan / Servis Mesin Jebol</option>
                          <option value="INVESTASI_EKSPANSI">AMPLOP 3: Investasi / Modal Cabang Baru</option>
                          <option value="LAINNYA">AMPLOP 4: Pengeluaran Pribadi Owner (Prive)</option>
                      </select>
                  </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1.5 flex items-center gap-1"><FileText size={12}/> Keterangan / Rincian Pengeluaran</label>
                <input type="text" required placeholder="Contoh: Beli Tepung Tapioka 5 Sak, Bayar Listrik Freezer, dll..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium normal-case bg-slate-50 outline-none focus:border-indigo-400 focus:bg-white transition-colors shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-inner">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Nominal Uang Keluar (Rp)</label>
                    <input type="text" required placeholder="0" value={form.amount ? Number(form.amount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('amount', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-indigo-700 bg-white outline-none focus:border-indigo-500 shadow-3xs" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Sumber Fisik Uang</label>
                      <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold uppercase text-slate-700 bg-white outline-none cursor-pointer focus:border-indigo-400 shadow-3xs">
                          <option value="CASH">Kas Tunai (Laci Toko)</option>
                          <option value="TF_BCA">Transfer Bank (BCA)</option>
                          <option value="TF_BRI">Transfer Bank (BRI)</option>
                      </select>
                  </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-3.5 rounded-xl text-xs normal-case hover:bg-slate-800 shadow-md active:scale-95 transition-transform mt-2">
                Sahkan Catatan &amp; Potong Saldo Kas
              </button>
          </form>
      </div>

      {/* REKENING KORAN RIWAYAT PENGELUARAN */}
      <div className="card-holo bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="font-black text-slate-800 text-xs flex items-center gap-2 normal-case">
            <Clock size={16} className="text-indigo-500"/> Buku Jurnal Riwayat Pengeluaran Kas
          </h4>
        </div>
        <div className="overflow-x-auto custom-scrollbar p-1">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] text-slate-500 normal-case border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-black">No. Bukti &amp; Tanggal</th>
                    <th className="px-5 py-3 font-black">Alokasi Anggaran</th>
                    <th className="px-5 py-3 font-black">Deskripsi Rincian Biaya</th>
                    <th className="px-5 py-3 font-black text-center">Sumber Dana</th>
                    <th className="px-5 py-3 font-black text-right">Nominal Uang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                    {listExpenses.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-medium normal-case">Belum ada riwayat pengeluaran kas tercatat di sistem.</td></tr>
                    ) : (
                      listExpenses.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-black text-slate-800">{formatDate(e.date)}</div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{e.id}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md text-[9px] font-black uppercase border border-slate-200">
                                {e.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-700 normal-case text-xs font-semibold">{e.description}</td>
                            <td className="px-5 py-4 text-center text-[10px] font-black uppercase text-slate-500">{e.payment_method?.replace(/_/g, ' ')}</td>
                            <td className="px-5 py-4 text-right font-black text-rose-600 text-sm">-{formatRupiah(e.amount)}</td>
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
