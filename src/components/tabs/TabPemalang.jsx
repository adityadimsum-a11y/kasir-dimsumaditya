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
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-700 normal-case">
      
      {/* HEADER HERO CLOSING NODE - FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
        <div className="relative z-10 text-left w-full pl-2">
          <h2 className="text-lg md:text-xl font-extrabold text-slate-800 normal-case flex items-center gap-2">
            <Lock className="text-blue-600" size={20}/> Closing &amp; settlement node
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case">
            Rekapitulasi setoran kasir harian ke pusat — Cabang: <span className="text-blue-600 font-extrabold">{currentBranch.replace(/_/g, ' ')}</span>
          </p>
        </div>
        {dailyMetrics.isClosed && (
          <div className="relative z-10 bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xs shrink-0">
            <CheckCircle className="text-emerald-500" size={20} />
            <div className="text-left">
              <div className="text-[9px] font-bold text-slate-500 normal-case">Status jaringan</div>
              <div className="text-xs font-extrabold text-emerald-700 normal-case">Terkunci (Closed)</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KANTONG KIRI: KALKULATOR SISTEM */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-holo p-6 h-max">
            <h3 className="font-extrabold text-slate-800 text-xs normal-case flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Calculator size={16} className="text-blue-600"/> Kalkulasi sistem EOD (Hari ini)
            </h3>
            <div className="space-y-4">
              <div>
                 <div className="text-[9px] font-bold text-slate-400 normal-case">Penjualan tunai / lunas</div>
                 <div className="text-xl font-extrabold text-emerald-600 mt-0.5">{formatRupiah(dailyMetrics.cashSales)}</div>
              </div>
              <div>
                 <div className="text-[9px] font-bold text-slate-400 normal-case">Piutang mengambang / marketplace</div>
                 <div className="text-xl font-extrabold text-orange-500 mt-0.5">{formatRupiah(dailyMetrics.marketplaceAR)}</div>
              </div>
              <div className="border-b border-dashed border-slate-200 pb-5">
                 <div className="text-[9px] font-bold text-slate-400 normal-case">Total beban keluar cabang</div>
                 <div className="text-xl font-extrabold text-red-500 mt-0.5">- {formatRupiah(dailyMetrics.totalExpenses)}</div>
              </div>
              <div className="pt-2 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                 <div className="text-[9px] font-bold text-blue-600 normal-case mb-1">Ekspektasi uang fisik di laci</div>
                 <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(dailyMetrics.expectedCash)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* KANTONG KANAN: FORM SETORAN KE PUSAT */}
        <div className="lg:col-span-2">
          <div className={`card-holo overflow-hidden transition-all ${dailyMetrics.isClosed ? 'opacity-70 pointer-events-none' : 'border-t-4 border-t-blue-500'}`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
               <h4 className="font-extrabold text-slate-800 normal-case text-xs flex items-center gap-2">
                 <Send size={16} className={dailyMetrics.isClosed ? 'text-slate-400' : 'text-blue-600'}/> Lembar setoran cabang (Menunggu validasi pusat)
               </h4>
            </div>
            
            <form onSubmit={handleClosingSubmit} className="p-6 md:p-8 space-y-5 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">1. Hitung uang fisik riil di laci</label>
                  <div className="relative">
                     <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                     <input type="text" required value={form.actual_cash ? Number(form.actual_cash).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, actual_cash: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg font-extrabold text-slate-800 outline-none focus:border-blue-500 transition-colors" placeholder="0" />
                  </div>
                  {form.actual_cash && (
                    <div className={`text-[9px] font-bold mt-2 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 normal-case border shadow-xs ${discrepancy === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : discrepancy > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {discrepancy === 0 ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                      {discrepancy === 0 ? 'Balance / Seimbang (Aman)' : discrepancy > 0 ? `Lebih kas: ${formatRupiah(discrepancy)}` : `Minus/Selisih: ${formatRupiah(discrepancy)}`}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-bold text-blue-600 normal-case block mb-1">2. Nominal uang disetor/transfer</label>
                  <div className="relative">
                     <span className="absolute left-3 top-2.5 font-bold text-blue-500 text-xs">Rp</span>
                     <input type="text" required value={form.transfer_amount ? Number(form.transfer_amount).toLocaleString('id-ID') : ''} onChange={e => setForm({...form, transfer_amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2 bg-blue-50 border border-blue-200 rounded-lg font-extrabold text-blue-700 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Metode serah terima setoran</label>
                  <select value={form.transfer_method} onChange={e => setForm({...form, transfer_method: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case text-slate-800 outline-none cursor-pointer focus:border-blue-500">
                    <option value="BCA_PUSAT">Transfer bank (BCA Pusat)</option>
                    <option value="MANDIRI_PUSAT">Transfer bank (Mandiri Pusat)</option>
                    <option value="KAS_TUNAI_PUSAT">Disetor tunai fisik (Pusat/Kurir)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan tambahan transaksi</label>
                  <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium normal-case outline-none focus:border-blue-500" placeholder="Contoh: Titip lewat supir DO" />
                </div>
              </div>

              <button type="submit" disabled={dailyMetrics.isClosed} className="w-full btn-holo py-3.5 rounded-lg normal-case font-bold text-xs flex justify-center items-center gap-2 mt-4 shadow-sm disabled:opacity-50">
                {dailyMetrics.isClosed ? <><Lock size={14}/> Buku kasir cabang sudah terkunci</> : <><Send size={14}/> Kirim setoran &amp; tunggu validasi pusat</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* HISTORI JURNAL SETORAN CABANG EOD */}
      <div className="card-holo flex flex-col overflow-hidden mt-2">
         <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 normal-case text-xs flex items-center gap-2"><Landmark size={16} className="text-blue-500"/> Histori catatan setoran cabang ini</h4>
            <span className="text-[9px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-xs normal-case">Maksimal 10 hari terakhir</span>
         </div>
         <div className="overflow-x-auto flex-1 p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
               <thead className="text-[10px] text-slate-400 normal-case border-b border-slate-200 bg-slate-50/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">Tgl settlement / EOD</th>
                    <th className="px-5 py-3 font-bold">Metode transfer</th>
                    <th className="px-5 py-3 text-right font-bold">Nominal disetor</th>
                    <th className="px-5 py-3 text-center font-bold">Status validasi pusat</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                  {mySettlements.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-16 text-slate-400 bg-white">
                          <div className="flex justify-center mb-2 opacity-30"><FileText size={36}/></div>
                          <span className="font-bold normal-case text-sm">Belum ada histori setoran (Closing) ke markas pusat.</span>
                        </td>
                      </tr>
                  ) : (
                      mySettlements.slice(0, 10).map((s, idx) => (
                         <tr key={s.settlement_id || idx} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="text-slate-800 font-extrabold">{formatDate(s.transfer_date || s.period)}</div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.settlement_id}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-md border border-slate-200 shadow-xs bg-slate-50 text-slate-600 text-[9px] font-bold normal-case">{s.transfer_method.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-5 py-4 text-right text-blue-600 font-extrabold text-sm whitespace-nowrap">{formatRupiah(s.amount_transferred)}</td>
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                                {s.transfer_status === 'PENDING_APPROVAL' ? (
                                    <span className="flex items-center justify-center gap-1.5 text-orange-700 text-[9px] font-bold normal-case bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg w-max mx-auto shadow-xs animate-pulse">
                                      <Clock size={12} /> Menunggu validasi HQ
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-1.5 text-emerald-700 text-[9px] font-bold normal-case bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-max mx-auto shadow-xs">
                                      <CheckCircle size={12} /> Diterima pusat
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
