import React, { useState, useMemo } from 'react';
import { 
  Wallet, History, CheckCircle2, DollarSign, 
  ArrowDownToLine, Crown, AlertTriangle, Loader2 
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabProfitOwner({ 
  orders = [], 
  piutangPayments = [], 
  cashflowTransactions = [], 
  sendToSheet, 
  showToast, 
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  
  // State untuk form penarikan Prive
  const [form, setForm] = useState({
    date: todayStr,
    amount: '',
    paymentMethod: 'TF_BRI_PUSAT',
    notes: ''
  });

  const [displayAmount, setDisplayAmount] = useState('');

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setForm(prev => ({...prev, amount: val}));
    setDisplayAmount(val ? Number(val).toLocaleString('id-ID') : '');
  };

  // 🔥 ENGINE AKUMULATOR PROFIT 5% (ALL-TIME)
  const profitData = useMemo(() => {
    let totalCashInAllTime = 0;

    // 1. Hitung total uang tunai/transfer riil dari nota penjualan
    (orders || []).forEach(o => {
      if (!o.isDeleted) {
        totalCashInAllTime += Number(o.amount_paid || o.paidAmount || 0);
      }
    });

    // 2. Hitung total uang dari pelunasan piutang agen
    (piutangPayments || []).forEach(p => {
      if (!p.isDeleted) {
        totalCashInAllTime += Number(p.amount || 0);
      }
    });

    // 3. Kalkulasi Plafon Hak Profit 5% (Diset statis sesuai Undang-Undang Pabrik)
    const totalJatahProfit = totalCashInAllTime * 0.05;

    // 4. Hitung uang profit yang SUDAH DITARIK oleh Bos
    let totalSudahDitarik = 0;
    const historyPenarikan = [];

    (cashflowTransactions || []).forEach(c => {
      if (!c.isDeleted && c.category === 'PRIVE_OWNER') {
        totalSudahDitarik += Number(c.amount || 0);
        historyPenarikan.push(c);
      }
    });

    // Urutkan histori dari yang terbaru
    historyPenarikan.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 5. Saldo Akhir yang masih bisa ditarik
    const sisaBisaDitarik = Math.max(0, totalJatahProfit - totalSudahDitarik);

    return {
      totalCashInAllTime,
      totalJatahProfit,
      totalSudahDitarik,
      sisaBisaDitarik,
      historyPenarikan
    };
  }, [orders, piutangPayments, cashflowTransactions]);

  // --- ACTIONS: TARIK PROFIT KE REKENING PRIBADI ---
  const handleWithdraw = async (e) => {
    e.preventDefault();
    const withdrawAmount = Number(form.amount);

    if (withdrawAmount <= 0) return alert("Nominal penarikan harus lebih dari 0!");
    if (withdrawAmount > profitData.sisaBisaDitarik) {
      if (!window.confirm(`⚠️ PERINGATAN OWNER!\n\nAnda mencoba menarik ${formatRupiah(withdrawAmount)}, padahal saldo profit yang tersedia hanya ${formatRupiah(profitData.sisaBisaDitarik)}.\n\nIni akan menguras jatah amplop lain (Operasional/Ayam). Tetap paksa tarik dana?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Konfirmasi Penarikan Profit / Prive:\n\nNominal: ${formatRupiah(withdrawAmount)}\nSumber Dana: ${form.paymentMethod.replace(/_/g, ' ')}\nKeterangan: ${form.notes}\n\nUang fisik akan dipotong dari sistem kas. Lanjutkan?`)) return;
    }

    setIsSubmitting(true);
    const trxId = generateId('PRV', form.date);

    // Bikin jurnal khusus Prive di Arus Kas (Tanpa masuk ke Expenses Operasional Pabrik)
    const payloadCashflow = {
      id: trxId,
      date: form.date,
      branch_id: currentBranch,
      type: 'OUT',
      category: 'PRIVE_OWNER',
      method: form.paymentMethod,
      amount: withdrawAmount,
      description: `PENARIKAN PROFIT BOS: ${form.notes.toUpperCase()}`,
      reference_id: 'OWNER_ACCOUNT',
      isDeleted: false
    };

    try {
      const isSuccess = await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
      if (isSuccess) {
        if(typeof showToast === 'function') showToast('Penarikan profit berhasil dicatat dan kas pabrik telah dipotong!', 'success');
        setForm({ date: todayStr, amount: '', paymentMethod: 'TF_BRI_PUSAT', notes: '' });
        setDisplayAmount('');
        setShowWithdrawForm(false);
      }
    } catch (error) {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 👑 HERO BANNER - BRANKAS SULTAN */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-amber-800">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Crown size={120} className="text-amber-300"/></div>
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-3 mb-2 tracking-wide uppercase">
            <Crown className="text-amber-400" size={28}/> Brankas Profit Owner (Prive)
          </h2>
          <p className="text-[11px] font-bold text-amber-200/80 leading-relaxed max-w-md normal-case">
            Halaman khusus Owner. Sistem otomatis menabung 5% dari setiap uang riil yang masuk ke pabrik (Amplop 4) untuk Anda nikmati tanpa mengganggu perputaran modal ayam dan gaji karyawan.
          </p>
        </div>
      </div>

      {/* 📊 MATRIKS SALDO PROFIT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-slate-400 relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Total Plafon Profit (All-Time)</div>
          <div className="text-3xl font-black text-slate-800 tracking-tight">{formatRupiah(profitData.totalJatahProfit)}</div>
          <div className="text-[9px] font-bold text-slate-400 mt-2">Dihitung otomatis 5% dari total omset cair riil: {formatRupiah(profitData.totalCashInAllTime)}</div>
        </div>

        <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-200 shadow-sm border-t-4 border-t-rose-500 relative overflow-hidden">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-2">Total Sudah Ditarik</div>
          <div className="text-3xl font-black text-rose-700 tracking-tight">-{formatRupiah(profitData.totalSudahDitarik)}</div>
          <div className="text-[9px] font-bold text-rose-400 mt-2">Uang yang sudah dipindahkan ke rekening pribadi.</div>
        </div>

        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-md border-t-4 border-t-amber-500 relative overflow-hidden">
          <Wallet className="absolute -right-4 -bottom-4 text-amber-500/10 pointer-events-none" size={100} />
          <div className="text-[11px] font-black text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 relative z-10"><DollarSign size={16}/> Sisa Saldo Bisa Ditarik</div>
          <div className="text-4xl font-black text-amber-700 tracking-tight relative z-10">{formatRupiah(profitData.sisaBisaDitarik)}</div>
          
          <button 
            onClick={() => setShowWithdrawForm(!showWithdrawForm)}
            className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl text-[11px] uppercase tracking-widest shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative z-10"
          >
            {showWithdrawForm ? 'Tutup Form' : 'Tarik Profit Sekarang'}
          </button>
        </div>
      </div>

      {/* 💸 FORM PENARIKAN (TOGGLE) */}
      {showWithdrawForm && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500 animate-in slide-in-from-top-4 duration-300">
          <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
            <ArrowDownToLine size={20} className="text-amber-500"/> Eksekusi Penarikan Dana Prive
          </h3>
          
          <form onSubmit={handleWithdraw} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nominal Penarikan (Rp)</label>
                <input 
                  type="text" required placeholder="0" 
                  value={displayAmount} onChange={handleAmountChange} 
                  className="w-full p-4 border-2 border-amber-200 bg-amber-50/30 rounded-xl text-xl font-black text-amber-700 outline-none focus:border-amber-500 transition-colors shadow-inner" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Sumber Wadah Dompet</label>
                <select 
                  value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-amber-400 cursor-pointer shadow-sm uppercase tracking-wider transition-colors"
                >
                  <option value="TF_BRI_PUSAT">Rekening BRI Pusat (Amplop 3 & 4)</option>
                  <option value="TF_BCA_PUSAT">Rekening BCA Pusat</option>
                  <option value="CASH">Uang Tunai (Brankas / Laci)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Keterangan / Tujuan Transfer</label>
                <input 
                  type="text" required 
                  value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-amber-400 shadow-sm normal-case transition-colors" 
                  placeholder="Cth: Tarik cuan ke Mandiri Istri..." 
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button 
                type="submit" disabled={isSubmitting} 
                className="w-full md:w-auto px-10 py-4 rounded-xl bg-slate-900 text-white font-black text-[11px] shadow-md hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer transition-transform active:scale-95"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
                {isSubmitting ? 'Memproses Jurnal...' : 'Sahkan Penarikan & Potong Kas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 📜 TABEL RIWAYAT PENARIKAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <History size={18} className="text-amber-600"/>
          <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">Histori Penarikan Profit (Buku Prive)</h4>
        </div>

        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Waktu Eksekusi</th>
                <th className="px-5 py-4">Keterangan / Memo</th>
                <th className="px-5 py-4 text-center">Dompet Asal</th>
                <th className="px-5 py-4 text-right">Nominal Ditarik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 bg-white">
              {profitData.historyPenarikan.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-bold text-xs normal-case">Belum ada riwayat penarikan profit ke rekening pribadi.</td></tr>
              ) : (
                profitData.historyPenarikan.map(log => (
                  <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800">{formatDate(log.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-wider">{log.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-700 normal-case leading-snug">{log.description}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-sm">
                        {String(log.method || 'CASH').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="font-black text-rose-600 text-base tracking-tight">-{formatRupiah(log.amount)}</div>
                    </td>
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
