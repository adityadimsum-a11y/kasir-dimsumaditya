import React, { useState } from 'react';
import { Wallet, Clock, ArrowDownRight, FileText, Loader2 } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

// 🔥 HELPER LOKAL ANTI-CRASH
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabExpenses({ expenses, sendToSheet, user }) {
  const todayStr = getTodayStr();
  
  // 🔥 FIX: Tambahkan proteksi submit (Anti-Spam / Loading State)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🔥 FIX: Pisahkan rawAmount dan displayAmount agar kursor ngetik tidak lompat
  const [rawAmount, setRawAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');

  const [form, setForm] = useState({
      date: todayStr, category: 'OPERASIONAL', description: '', paymentMethod: 'CASH'
  });

  // HELPER: INPUT RUPIAH OTOMATIS ANTI KURSOR LOMPAT
  const handleAmountChange = (e) => {
      const val = e.target.value.replace(/\D/g, ''); 
      setRawAmount(val);
      setDisplayAmount(val ? Number(val).toLocaleString('id-ID') : '');
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (Number(rawAmount) <= 0) return alert("Nominal pengeluaran harus lebih besar dari Rp 0!");
      
      const confirmMsg = `Konfirmasi Catat Pengeluaran:\n\n` +
        `Kategori: ${form.category.replace(/_/g, ' ')}\n` +
        `Nominal: ${formatRupiah(rawAmount)}\n` +
        `Sumber Dana: ${form.paymentMethod.replace(/_/g, ' ')}\n\n` +
        `Sistem akan memotong kas. Lanjutkan?`;
        
      if (!window.confirm(confirmMsg)) return;

      setIsSubmitting(true); // Kunci tombol

      try {
          // 1. Siapkan data untuk tabel Pengeluaran (Expenses)
          const expenseId = generateId('EXP', form.date);
          const payloadExpense = {
              id: expenseId, 
              date: form.date, 
              category: form.category,
              description: form.description.toUpperCase(), 
              amount: Number(rawAmount), 
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
              amount: Number(rawAmount),
              description: `BIAYA: [${form.category}] ${form.description.toUpperCase()}`,
              reference_id: expenseId,
              isDeleted: false
          };

          // 3. Tembak kedua data ke database secara berurutan dengan proteksi
          const successExpense = await sendToSheet('insert', payloadExpense, 'expenses');
          
          if (successExpense) {
              await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
              setForm({...form, description: ''});
              setRawAmount('');
              setDisplayAmount('');
          }
      } catch (error) {
          console.error("Gagal mencatat pengeluaran:", error);
          alert("Terjadi kesalahan jaringan saat menyimpan data. Cek koneksi Anda.");
      } finally {
          setIsSubmitting(false); // Buka kunci tombol
      }
  };

  // Filter & Sort list untuk tabel (Abaikan data yang kena Soft Delete)
  const listExpenses = (expenses || [])
    .filter(e => !e.isDeleted)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800 duration-300">
      
      {/* 🚀 FORM PENCATATAN PENGELUARAN - FLUID GRADIENT */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-800 shadow-xl p-6 lg:p-8 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4 relative z-10">
              <div className="bg-indigo-500/20 text-indigo-400 p-3 rounded-2xl border border-indigo-500/30"><Wallet size={24}/></div>
              <div>
                <h2 className="text-lg font-black text-white tracking-wide">Pencatatan Beban Pengeluaran Kas</h2>
                <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-lg leading-relaxed">Kunci pengeluaran operasional harian agar memotong alokasi kantong pos rekening yang tepat secara otomatis.</p>
              </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tanggal Keluar Kas</label>
                    <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-700 rounded-xl text-xs font-bold bg-slate-800/50 text-white outline-none cursor-pointer focus:border-indigo-400 transition-colors shadow-inner" />
                  </div>
                  <div>
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><ArrowDownRight size={14}/> Kategori Alokasi Anggaran</label>
                      <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-3 border border-indigo-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-indigo-300 bg-indigo-900/30 outline-none cursor-pointer focus:border-indigo-400 transition-colors shadow-inner">
                          <option value="OPERASIONAL" className="text-slate-800 bg-white">AMPLOP 2: Operasional Pabrik / Bahan Pendukung</option>
                          <option value="GAJI" className="text-slate-800 bg-white">AMPLOP 2: Gaji Karyawan / Bonus Tim</option>
                          <option value="MARKETING" className="text-slate-800 bg-white">AMPLOP 2: Marketing, Iklan, &amp; Sales</option>
                          <option value="DARURAT_SERVIS" className="text-slate-800 bg-white">AMPLOP 3: Dana Cadangan / Servis Mesin Jebol</option>
                          <option value="INVESTASI_EKSPANSI" className="text-slate-800 bg-white">AMPLOP 3: Investasi / Modal Cabang Baru</option>
                          <option value="LAINNYA" className="text-slate-800 bg-white">AMPLOP 4: Pengeluaran Pribadi Owner (Prive)</option>
                      </select>
                  </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><FileText size={14}/> Keterangan / Rincian Pengeluaran</label>
                <input type="text" required placeholder="Contoh: Beli Tepung Tapioka 5 Sak, Bayar Listrik Freezer, dll..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full p-3.5 border border-slate-700 rounded-xl text-sm font-bold text-white bg-slate-800/50 outline-none focus:border-indigo-400 transition-colors shadow-inner placeholder:text-slate-600" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 shadow-inner">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nominal Uang Keluar (Rp)</label>
                    <input type="text" required placeholder="0" value={displayAmount} onChange={handleAmountChange} className="w-full p-3.5 border-2 border-slate-600 rounded-xl text-lg font-black text-white bg-slate-800 outline-none focus:border-indigo-500 shadow-inner transition-colors" />
                  </div>
                  <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Sumber Fisik Uang</label>
                      <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3.5 border-2 border-slate-600 rounded-xl text-sm font-black uppercase tracking-wider text-slate-200 bg-slate-800 outline-none cursor-pointer focus:border-indigo-500 shadow-inner transition-colors">
                          <option value="CASH">Kas Tunai (Laci Toko)</option>
                          <option value="TF_BCA_PUSAT">Transfer Bank (BCA)</option>
                          <option value="TF_BRI_PUSAT">Transfer Bank (BRI)</option>
                      </select>
                  </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider hover:bg-indigo-500 shadow-md active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Wallet size={16}/>}
                {isSubmitting ? 'Memproses Jurnal...' : 'Sahkan Catatan & Potong Saldo Kas'}
              </button>
          </form>
      </div>

      {/* REKENING KORAN RIWAYAT PENGELUARAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
            <Clock size={18} className="text-indigo-600"/> Buku Jurnal Riwayat Pengeluaran Kas
          </h4>
        </div>
        <div className="overflow-x-auto custom-scrollbar p-2">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-4 font-black">No. Bukti &amp; Tanggal</th>
                    <th className="px-5 py-4 font-black">Alokasi Anggaran</th>
                    <th className="px-5 py-4 font-black">Deskripsi Rincian Biaya</th>
                    <th className="px-5 py-4 font-black text-center">Sumber Dana</th>
                    <th className="px-5 py-4 font-black text-right">Nominal Uang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                    {listExpenses.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-medium">Belum ada riwayat pengeluaran kas tercatat di sistem.</td></tr>
                    ) : (
                      listExpenses.map(e => (
                        <tr key={e.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-black text-slate-800">{formatDate(e.date)}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-1">{e.id}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                                {e.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-700 text-xs font-bold leading-relaxed">{e.description}</td>
                            <td className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">{e.payment_method?.replace(/_/g, ' ')}</td>
                            <td className="px-5 py-4 text-right font-black text-rose-600 text-base tracking-tight">-{formatRupiah(e.amount)}</td>
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
