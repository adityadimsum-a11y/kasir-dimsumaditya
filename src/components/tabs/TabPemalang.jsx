import React, { useState, useMemo } from 'react';
import { Lock, Send, AlertTriangle, CheckCircle, Calculator, Landmark, Clock, FileText } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabPemalang({ 
  orders = [], orders_data, 
  expenses = [], expenses_data, 
  financial_closings = [], branch_settlements = [], 
  sendToSheet, user 
}) {
  const todayStr = getTodayStr();
  
  // 🔥 KUNCI KABEL OTOMATIS: DETEKSI CABANG AKTIF ATAU PUSAT
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [form, setForm] = useState({ actual_cash: '', transfer_amount: '', transfer_method: 'BCA_PUSAT', notes: '' });

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // --- ENGINE KALKULATOR CLOSING HARIAN (SINKRON POS KASIR) ---
  const dailyMetrics = useMemo(() => {
    let cashSales = 0; 
    let marketplaceAR = 0; 
    let totalExpenses = 0;

    realOrders.forEach(o => {
      if (o.isDeleted) return;
      const orderDate = o.date ? o.date.substring(0, 10) : '';
      if (orderDate !== todayStr || String(o.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      
      // 🔥 FIX KABEL PROPERTI: total_amount dan payment_method
      const netSales = Number(o.total_amount || o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0);
      const method = String(o.payment_method || '').toUpperCase();
      
      if (method.includes('MARKETPLACE') || method.includes('HUTANG') || method.includes('DP') || method.includes('PIUTANG')) {
        marketplaceAR += netSales; 
      } else {
        cashSales += netSales;
      }
    });

    realExpenses.forEach(e => {
      if (e.isDeleted) return;
      const expDate = e.date ? e.date.substring(0, 10) : '';
      if (expDate !== todayStr || String(e.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      totalExpenses += Number(e.amount || 0);
    });

    const expectedCash = Math.max(0, cashSales - totalExpenses);
    
    // Cek apakah hari ini cabang tersebut sudah melakukan closing
    const isClosed = (financial_closings || []).some(c => 
      c.date === todayStr && 
      String(c.branch_id).toUpperCase() === currentBranch.toUpperCase() && 
      !c.isDeleted
    );

    return { cashSales, marketplaceAR, totalExpenses, expectedCash, isClosed };
  }, [realOrders, realExpenses, financial_closings, currentBranch, todayStr]);

  const actualCashNum = Number(form.actual_cash || 0);
  const discrepancy = actualCashNum - dailyMetrics.expectedCash;

  // --- ACTIONS: PROSES SETORAN & KUNCI BUKU HARIAN ---
  const handleClosingSubmit = async (e) => {
    e.preventDefault();
    if (dailyMetrics.isClosed) { alert("Akses Ditolak! Buku kasir cabang hari ini sudah dikunci (Closed)."); return; }
    if (actualCashNum <= 0) { alert("Uang fisik di laci tidak boleh kosong!"); return; }

    const confirmMsg = `Konfirmasi SETORAN KE PUSAT TANGERANG:\n\nTotal Disetor: ${formatRupiah(form.transfer_amount)}\n\nApakah Anda yakin nominal sudah ditransfer/diserahkan? Data kasir hari ini akan dikunci dan menunggu APPROVAL/Validasi dari Markas Pusat.`;
    if (!window.confirm(confirmMsg)) return;

    const closingId = generateId('CLOSE', todayStr);
    const settlementId = generateId('SETTLE', todayStr);
    const transferAmt = Number(form.transfer_amount || 0);

    const closingPayload = {
      id: closingId, date: todayStr, branch_id: currentBranch, cash_ready: actualCashNum,
      total_sales: dailyMetrics.cashSales + dailyMetrics.marketplaceAR, status: 'LOCKED', closed_by: user?.name || 'KASIR CABANG'
    };

    const settlementPayload = {
      settlement_id: settlementId, branch_id: currentBranch, period: todayStr, cash_collected: actualCashNum,
      amount_to_transfer: transferAmt, amount_transferred: transferAmt, transfer_method: form.transfer_method,
      transfer_status: 'PENDING_APPROVAL', transfer_date: todayStr
    };

    const cashflowPayload = {
      id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, transaction_type: 'OUTFLOW', 
      type: 'OUT', category: 'BRANCH_SETTLEMENT', amount: transferAmt, method: form.transfer_method, reference_id: settlementId,
      description: `Setoran kasir harian EOD ke Pusat (Status: Menunggu Validasi HQ). Catatan: ${form.notes || '-'}`
    };

    // Tembak beruntun ke 3 tabel database inti
    const ok1 = await sendToSheet('insert', closingPayload, 'financial_closings');
    if (ok1) {
      await sendToSheet('insert', settlementPayload, 'branch_settlements');
      await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');
      setForm({ actual_cash: '', transfer_amount: '', transfer_method: 'BCA_PUSAT', notes: '' });
      alert("Setoran berhasil dikirim! Silakan hubungi admin Pusat Tangerang untuk proses validasi.");
    }
  };

  const mySettlements = (branch_settlements || [])
    .filter(s => String(s.branch_id).toUpperCase() === currentBranch.toUpperCase() && !s.isDeleted)
    .sort((a, b) => new Date(b.transfer_date) - new Date(a.period || todayStr));

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800">
      
      {/* HEADER HERO CLOSING NODE */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 text-left w-full">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase flex items-center gap-3 tracking-widest">
            <Lock className="text-blue-400" /> Closing &amp; Settlement Node
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
            Rekapitulasi Setoran Kasir Harian ke Pusat — Cabang: <span className="text-blue-400">{currentBranch.replace('_', ' ')}</span>
          </p>
        </div>
        {dailyMetrics.isClosed && (
          <div className="relative z-10 bg-emerald-500/20 border border-emerald-500/50 px-6 py-3.5 rounded-2xl flex items-center gap-3 shadow-lg">
            <CheckCircle className="text-emerald-400" size={24} />
            <div className="text-left">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Status Jaringan</div>
              <div className="text-sm font-black text-white uppercase tracking-wider">Terkunci (Closed)</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KANTONG KIRI: KALKULATOR SISTEM */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 h-max">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Calculator size={16} className="text-slate-500"/> Kalkulasi Sistem EOD (Hari Ini)
            </h3>
            <div className="space-y-4">
              <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penjualan Tunai / Lunas</div>
                 <div className="text-xl font-black text-emerald-600 mt-0.5">{formatRupiah(dailyMetrics.cashSales)}</div>
              </div>
              <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Piutang Mengambang / Marketplace</div>
                 <div className="text-xl font-black text-orange-500 mt-0.5">{formatRupiah(dailyMetrics.marketplaceAR)}</div>
              </div>
              <div className="border-b border-dashed border-slate-200 pb-5">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Beban Keluar Cabang</div>
                 <div className="text-xl font-black text-rose-500 mt-0.5">- {formatRupiah(dailyMetrics.totalExpenses)}</div>
              </div>
              <div className="pt-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                 <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Ekspektasi Uang Fisik Di Laci</div>
                 <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(dailyMetrics.expectedCash)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* KANTONG KANAN: FORM SETORAN KE PUSAT */}
        <div className="lg:col-span-2">
          <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${dailyMetrics.isClosed ? 'opacity-70 pointer-events-none border-slate-200' : 'border-blue-300 shadow-blue-500/10'}`}>
            <div className={`p-5 border-b ${dailyMetrics.isClosed ? 'bg-slate-50' : 'bg-blue-50/50'} flex items-center justify-between`}>
               <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2">
                 <Send size={16} className={dailyMetrics.isClosed ? 'text-slate-400' : 'text-blue-600'}/> Lembar Setoran Cabang (Menunggu Validasi Pusat)
               </h4>
            </div>
            
            <form onSubmit={handleClosingSubmit} className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Hitung Uang Fisik Riil di Laci</label>
                  <div className="relative">
                     <span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span>
                     <input type="text" required value={form.actual_cash ? Number(form.actual_cash).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, actual_cash: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-blue-400 focus:bg-white transition-colors" placeholder="0" />
                  </div>
                  {form.actual_cash && (
                    <div className={`text-[10px] font-bold mt-2 px-3 py-2.5 rounded-xl flex items-center gap-1.5 uppercase tracking-wide border shadow-sm ${discrepancy === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : discrepancy > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {discrepancy === 0 ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
                      {discrepancy === 0 ? 'Balance / Seimbang (Aman)' : discrepancy > 0 ? `Lebih Kas: ${formatRupiah(discrepancy)}` : `Minus/Selisih: ${formatRupiah(discrepancy)}`}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">2. Nominal Uang Disetor/Transfer</label>
                  <div className="relative">
                     <span className="absolute left-4 top-3.5 font-black text-blue-500">Rp</span>
                     <input type="text" required value={form.transfer_amount ? Number(form.transfer_amount).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, transfer_amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3.5 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metode Serah Terima Setoran</label>
                  <select value={form.transfer_method} onChange={e => setForm({...form, transfer_method: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-400">
                    <option value="BCA_PUSAT">Transfer Bank (BCA PUSAT)</option>
                    <option value="MANDIRI_PUSAT">Transfer Bank (MANDIRI PUSAT)</option>
                    <option value="KAS_TUNAI_PUSAT">Disetor Tunai Fisik (Pusat/Kurir)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Catatan Tambahan Transaksi</label>
                  <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase outline-none focus:bg-white focus:border-blue-400" placeholder="Contoh: Titip lewat supir DO" />
                </div>
              </div>

              <button type="submit" disabled={dailyMetrics.isClosed} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4.5 rounded-2xl uppercase tracking-widest text-xs flex justify-center items-center gap-2 mt-4 shadow-xl disabled:opacity-50 transition-transform active:scale-95">
                {dailyMetrics.isClosed ? <><Lock size={16}/> Buku Kasir Cabang Sudah Terkunci</> : <><Send size={16}/> Kirim Setoran &amp; Tunggu Validasi Pusat</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* HISTORI JURNAL SETORAN CABANG EOD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-2">
         <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2"><Landmark size={16} className="text-blue-500"/> Histori Catatan Setoran Cabang Ini</h4>
            <span className="text-[9px] font-black text-slate-500 bg-white px-2.5 py-1 rounded-md border shadow-sm uppercase tracking-wider">Maksimal 10 Hari Terakhir</span>
         </div>
         <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
               <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                  <tr>
                    <th className="px-5 py-3 font-black">Tgl Settlement / EOD</th>
                    <th className="px-5 py-3 font-black">Metode Transfer</th>
                    <th className="px-5 py-3 text-right font-black">Nominal Disetor</th>
                    <th className="px-5 py-3 text-center font-black">Status Validasi Pusat</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 text-xs font-bold">
                  {mySettlements.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-16 text-slate-400 bg-slate-50/50">
                          <div className="flex justify-center mb-2 opacity-20"><FileText size={36}/></div>
                          <span className="font-black uppercase tracking-widest text-xs">Belum ada histori setoran (Closing) ke markas pusat.</span>
                        </td>
                      </tr>
                  ) : (
                      mySettlements.slice(0, 10).map((s, idx) => (
                         <tr key={s.settlement_id || idx} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="text-slate-800 font-black">{formatDate(s.transfer_date || s.period)}</div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.settlement_id}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-md border border-slate-200 shadow-sm bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-widest">{s.transfer_method.replace('_', ' ')}</span>
                            </td>
                            <td className="px-5 py-4 text-right text-blue-600 font-black text-sm whitespace-nowrap">{formatRupiah(s.amount_transferred)}</td>
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                                {s.transfer_status === 'PENDING_APPROVAL' ? (
                                    <span className="flex items-center justify-center gap-1.5 text-orange-700 text-[9px] font-black uppercase tracking-widest bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg w-max mx-auto shadow-sm animate-pulse">
                                      <Clock size={12} /> Menunggu Validasi HQ
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-1.5 text-emerald-700 text-[9px] font-black uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-max mx-auto shadow-sm">
                                      <CheckCircle size={12} /> Diterima Pusat
                                    </span>
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
