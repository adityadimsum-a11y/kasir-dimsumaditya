import React, { useState, useMemo } from 'react';
import { Lock, Send, AlertTriangle, CheckCircle, Calculator, Landmark, Clock } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabPemalang({ orders, expenses, financial_closings, branch_settlements, sendToSheet, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'NODE_UNKNOWN';

  const [form, setForm] = useState({ actual_cash: '', transfer_amount: '', transfer_method: 'BCA_PUSAT', notes: '' });

  const dailyMetrics = useMemo(() => {
    let cashSales = 0; let marketplaceAR = 0; let totalExpenses = 0;
    (orders || []).forEach(o => {
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      if (o.date !== todayStr || String(o.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      const netSales = Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0);
      if (o.paymentMethod === 'MARKETPLACE_AR') marketplaceAR += netSales; else cashSales += netSales;
    });

    (expenses || []).forEach(e => {
      if (e.isDeleted || String(e.isDeleted).toUpperCase() === 'TRUE') return;
      if (e.date !== todayStr || String(e.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      totalExpenses += Number(e.amount || 0);
    });

    const expectedCash = cashSales - totalExpenses;
    const isClosed = (financial_closings || []).some(c => c.date === todayStr && String(c.branch_id).toUpperCase() === currentBranch.toUpperCase() && (!c.isDeleted || String(c.isDeleted).toUpperCase() !== 'TRUE'));

    return { cashSales, marketplaceAR, totalExpenses, expectedCash, isClosed };
  }, [orders, expenses, financial_closings, currentBranch, todayStr]);

  const actualCashNum = Number(form.actual_cash || 0);
  const discrepancy = actualCashNum - dailyMetrics.expectedCash;

  const handleClosingSubmit = async (e) => {
    e.preventDefault();
    if (dailyMetrics.isClosed) { alert("Sudah Closing hari ini!"); return; }

    const confirmMsg = `Konfirmasi SETORAN KE PUSAT:\n\nTotal Disetor: ${formatRp(form.transfer_amount)}\n\nApakah Anda yakin nominal sudah ditransfer/diserahkan? Data akan dikunci dan menunggu APPROVAL dari Pusat.`;
    if (!window.confirm(confirmMsg)) return;

    const closingId = generateId('CLOSE', todayStr);
    const settlementId = generateId('SETTLE', todayStr);
    const transferAmt = Number(form.transfer_amount || 0);

    const closingPayload = {
      id: closingId, date: todayStr, branch_id: currentBranch, cash_ready: actualCashNum,
      total_sales: dailyMetrics.cashSales + dailyMetrics.marketplaceAR, status: 'LOCKED', closed_by: user?.name || 'KASIR'
    };

    // STATUS UANG MENJADI PENDING_APPROVAL (Belum diakui pusat)
    const settlementPayload = {
      settlement_id: settlementId, branch_id: currentBranch, period: todayStr, cash_collected: actualCashNum,
      amount_to_transfer: transferAmt, amount_transferred: transferAmt, transfer_method: form.transfer_method,
      transfer_status: 'PENDING_APPROVAL', transfer_date: todayStr
    };

    // HANYA CATAT UANG KELUAR DARI CABANG (Uang masuk ke pusat tunggu tombol Approve ditekan bos)
    const cashflowPayload = {
      id: generateId('CFO', new Date()), date: todayStr, branch_id: currentBranch, transaction_type: 'OUTFLOW', 
      category: 'BRANCH_SETTLEMENT', amount: transferAmt, payment_method: form.transfer_method, reference_id: settlementId,
      description: `Setoran kasir harian ke Pusat (Menunggu Validasi Pusat). Catatan: ${form.notes || '-'}`
    };

    const ok1 = await sendToSheet('insert', closingPayload, 'financial_closings');
    if (ok1) {
      await sendToSheet('insert', settlementPayload, 'branch_settlements');
      await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');
      setForm({ actual_cash: '', transfer_amount: '', transfer_method: 'BCA_PUSAT', notes: '' });
    }
  };

  const mySettlements = (branch_settlements || [])
    .filter(s => String(s.branch_id).toUpperCase() === currentBranch.toUpperCase() && (!s.isDeleted || String(s.isDeleted).toUpperCase() !== 'TRUE'))
    .sort((a, b) => new Date(b.transfer_date) - new Date(a.period || todayStr));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 text-center md:text-left w-full">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase flex items-center justify-center md:justify-start gap-3">
            <Lock className="text-blue-400" /> Closing & Settlement Node
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
            Rekapitulasi Harian & Setoran Kas ke Pusat — Cabang: <span className="text-blue-400">{currentBranch}</span>
          </p>
        </div>
        {dailyMetrics.isClosed && (
          <div className="relative z-10 bg-emerald-500/20 border border-emerald-500/50 px-6 py-3 rounded-2xl flex items-center gap-3">
            <CheckCircle className="text-emerald-400" />
            <div className="text-left">
              <div className="text-xs font-black text-emerald-400 uppercase tracking-widest">Status Node</div>
              <div className="text-sm font-bold text-white uppercase">Terkunci (Closed)</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2 border-b pb-3 mb-4">
              <Calculator size={16} className="text-slate-500"/> Kalkulasi Sistem (Hari Ini)
            </h3>
            <div className="space-y-4">
              <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penjualan Tunai / QRIS</div><div className="text-lg font-black text-emerald-600">{formatRp(dailyMetrics.cashSales)}</div></div>
              <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Piutang Marketplace</div><div className="text-lg font-black text-orange-500">{formatRp(dailyMetrics.marketplaceAR)}</div></div>
              <div className="border-b border-dashed border-slate-200 pb-4"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengeluaran Cabang</div><div className="text-lg font-black text-rose-500">- {formatRp(dailyMetrics.totalExpenses)}</div></div>
              <div className="pt-2 bg-slate-50 p-4 rounded-2xl border border-slate-100"><div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Ekspektasi Kas Laci</div><div className="text-2xl font-black text-slate-800">{formatRp(dailyMetrics.expectedCash)}</div></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${dailyMetrics.isClosed ? 'opacity-70 pointer-events-none' : 'border-blue-200'}`}>
            <div className={`p-4 border-b ${dailyMetrics.isClosed ? 'bg-slate-50' : 'bg-blue-50'} flex items-center justify-between`}>
               <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2">
                 <Send size={16} className={dailyMetrics.isClosed ? 'text-slate-400' : 'text-blue-600'}/> Form Setoran (Menunggu Validasi Pusat)
               </h4>
            </div>
            
            <form onSubmit={handleClosingSubmit} className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Hitung Uang Fisik Riil di Laci</label>
                  <div className="relative"><span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span><input type="text" required value={form.actual_cash ? Number(form.actual_cash).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, actual_cash: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none" placeholder="0" /></div>
                  {form.actual_cash && (
                    <div className={`text-[10px] font-bold mt-2 px-3 py-2 rounded-xl flex items-center gap-1 ${discrepancy === 0 ? 'bg-emerald-50 text-emerald-600' : discrepancy > 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                      {discrepancy === 0 ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                      {discrepancy === 0 ? 'Balance / Seimbang (Aman)' : discrepancy > 0 ? `Lebih: ${formatRp(discrepancy)}` : `Minus/Selisih: ${formatRp(discrepancy)}`}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">2. Nominal Disetor/Transfer</label>
                  <div className="relative"><span className="absolute left-4 top-3.5 font-black text-blue-400">Rp</span><input type="text" required value={form.transfer_amount ? Number(form.transfer_amount).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, transfer_amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3.5 bg-blue-50 border border-blue-200 rounded-2xl font-black text-blue-800 outline-none" placeholder="0" /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metode Serah Terima</label>
                  <select value={form.transfer_method} onChange={e => setForm({...form, transfer_method: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none">
                    <option value="BCA_PUSAT">Transfer BCA Pusat</option>
                    <option value="MANDIRI_PUSAT">Transfer Mandiri Pusat</option>
                    <option value="KAS_TUNAI_PUSAT">Disetor Tunai ke Kurir/Pusat</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Catatan Tambahan</label>
                  <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none" placeholder="Titip lewat supir DO" />
                </div>
              </div>

              <button type="submit" disabled={dailyMetrics.isClosed} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs flex justify-center items-center gap-2 mt-4 shadow-lg disabled:opacity-50 transition">
                {dailyMetrics.isClosed ? <><Lock size={16}/> Node Sudah Terkunci Hari Ini</> : <><Send size={16}/> Kirim Setoran & Tunggu Approval Pusat</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-6">
         <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2"><Landmark size={16}/> Histori Setoran Cabang Ini</h4>
         </div>
         <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-sm text-left">
               <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="px-6 py-4">Tgl Settlement</th><th className="px-6 py-4 text-center">Metode Transfer</th><th className="px-6 py-4 text-right">Nominal Disetor</th><th className="px-6 py-4 text-center">Status Validasi Pusat</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {mySettlements.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada histori setoran ke pusat.</td></tr>
                  ) : (
                      mySettlements.slice(0, 10).map(s => (
                         <tr key={s.settlement_id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4"><div className="text-slate-800">{formatDate(s.transfer_date || s.period)}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.settlement_id}</div></td>
                            <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[9px] uppercase tracking-wider">{s.transfer_method}</span></td>
                            <td className="px-6 py-4 text-right text-blue-600 font-black text-sm">{formatRp(s.amount_transferred)}</td>
                            <td className="px-6 py-4 text-center">
                                {s.transfer_status === 'PENDING_APPROVAL' ? (
                                    <span className="flex items-center justify-center gap-1 text-orange-600 text-[10px] uppercase tracking-wider bg-orange-50 px-2 py-1 rounded-lg w-max mx-auto"><Clock size={12} /> Menunggu Validasi</span>
                                ) : (
                                    <span className="flex items-center justify-center gap-1 text-emerald-600 text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-lg w-max mx-auto"><CheckCircle size={12} /> Diterima Pusat</span>
                                )}
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
