import React, { useMemo } from 'react';
import { Calculator, AlertTriangle, Wallet, Building2, Truck, RefreshCcw, Landmark, ShieldCheck, CheckCircle, ArrowDownLeft, FileText } from 'lucide-react';
import { formatRp, getTodayStr, generateId } from '../../utils/helpers';

export default function TabCashWarRoom({ 
  orders, 
  purchases, 
  cashflow_transactions, 
  supplier_ledger, 
  master_branches, 
  inventory_cost_layers, 
  branch_settlements, 
  sendToSheet, 
  user, 
  showToast 
}) {
  
  // 1. ENGINE KALKULASI SALDO
  const treasuryMetrics = useMemo(() => {
    let totalCashGlobal = 0; let cashHq = 0; const branchCashMap = {};

    (cashflow_transactions || []).forEach(tx => {
      if (tx.isDeleted || String(tx.isDeleted).toUpperCase() === 'TRUE') return;
      if (tx.payment_method === 'PIUTANG' || tx.payment_method === 'MARKETPLACE_AR') return;
      const amt = Number(tx.amount || 0);
      const isOutflow = tx.transaction_type === 'OUTFLOW';
      const netAmt = isOutflow ? -amt : amt;

      totalCashGlobal += netAmt;
      const bId = String(tx.branch_id).toUpperCase();
      if (!branchCashMap[bId]) branchCashMap[bId] = 0;
      branchCashMap[bId] += netAmt;
      if (bId === 'PUSAT' || bId === 'HQ_FACTORY') cashHq += netAmt;
    });

    let pendingMarketplaceAR = 0;
    (orders || []).forEach(o => {
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      if (o.paymentMethod === 'MARKETPLACE_AR') pendingMarketplaceAR += (Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0));
    });

    let supplierDue = 0;
    (supplier_ledger || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.transaction_type === 'PURCHASE') supplierDue += Number(l.amount || 0);
      if (l.transaction_type === 'PAYMENT') supplierDue -= Number(l.amount || 0);
    });

    const ayamPurchases = (purchases || []).filter(p => !p.isDeleted && String(p.item_name || p.itemName || '').toUpperCase().includes('AYAM')).sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestChickenPrice = ayamPurchases.length > 0 ? Number(ayamPurchases[0].price || 35000) : 35000;

    const disposableCash = totalCashGlobal - supplierDue;
    const chickenRunwayKg = disposableCash > 0 ? Math.floor(disposableCash / latestChickenPrice) : 0;
    const isDeficit = disposableCash <= 0;

    let totalInventoryValue = 0;
    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.status === 'ACTIVE') totalInventoryValue += (Number(l.qty_remaining || 0) * Number(l.unit_cost || 0));
    });

    return { totalCashGlobal, cashHq, branchCashMap, pendingMarketplaceAR, supplierDue, latestChickenPrice, disposableCash, chickenRunwayKg, isDeficit, totalInventoryValue };
  }, [cashflow_transactions, orders, supplier_ledger, purchases, inventory_cost_layers]);

  // 2. DATA PENDING APPROVAL
  const pendingSettlements = useMemo(() => {
    return (branch_settlements || []).filter(s => 
      s.transfer_status === 'PENDING_APPROVAL' && (!s.isDeleted || String(s.isDeleted).toUpperCase() !== 'TRUE')
    );
  }, [branch_settlements]);

  // 3. DATA HISTORI YANG SUDAH DI-APPROVE (BARU)
  const settlementHistory = useMemo(() => {
    return (cashflow_transactions || [])
      .filter(tx => tx.category === 'BRANCH_SETTLEMENT' && tx.transaction_type === 'INFLOW' && (!tx.isDeleted || String(tx.isDeleted).toUpperCase() !== 'TRUE'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [cashflow_transactions]);


  const handleApproveSettlement = async (settlement) => {
    if (!window.confirm(`Konfirmasi Uang Masuk\n\nApakah setoran ${formatRp(settlement.amount_transferred)} dari ${settlement.branch_id} sudah diterima fisik/mutasinya?`)) return;

    try {
      await sendToSheet('event_approve_settlement', settlement, 'auto');
      if (showToast) showToast("Setoran Berhasil Divalidasi!", "success");
      window.location.reload(); 
    } catch (error) {
      console.error("Gagal Approve:", error);
      alert("Sistem gagal terkoneksi. Silakan cek konsol.");
    }
  };

  if (user?.branch_type !== 'HQ_FACTORY') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <ShieldCheck size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-black text-slate-800 uppercase">Akses Terbatas</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* SECTION 1: KARTU APPROVAL (Hanya Muncul Jika Ada Data) */}
      {pendingSettlements.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><AlertTriangle size={100} /></div>
          <h3 className="font-black text-orange-800 text-sm tracking-widest uppercase mb-4 flex items-center gap-2 relative z-10"><AlertTriangle size={18}/> Validasi Uang Masuk ({pendingSettlements.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
            {pendingSettlements.map(s => {
              const branchInfo = (master_branches || []).find(b => String(b.branch_id).toUpperCase() === String(s.branch_id).toUpperCase());
              return (
                <div key={s.settlement_id} className="bg-white p-5 rounded-2xl border border-orange-100 shadow-lg shadow-orange-100/50 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 flex justify-between items-center">
                      <span>{branchInfo?.branch_name || s.branch_id}</span>
                      <span className="text-slate-400 font-mono text-[8px]">{s.settlement_id}</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800 my-2">{formatRp(s.amount_transferred)}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-t border-dashed pt-2">Metode: <span className="text-blue-600">{s.transfer_method}</span></div>
                  </div>
                  <button onClick={() => handleApproveSettlement(s)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 text-xs"><CheckCircle size={14}/> Approve & Terima Kas</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: DASHBOARD KAS GLOBAL */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <h2 className="text-xl md:text-2xl font-black mb-8 flex items-center gap-3 relative z-10"><Calculator className="text-blue-400"/> Treasury Engine <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg tracking-widest uppercase ml-2">HQ Access</span></h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative z-10 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="pt-4 md:pt-0">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Wallet size={14}/> Kas Global Tersedia</div>
                <div className="text-4xl md:text-5xl font-black text-white">{formatRp(treasuryMetrics.totalCashGlobal)}</div>
            </div>
            <div className="pt-4 md:pt-0 md:pl-8">
                <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Truck size={14}/> Kewajiban Hutang (AP)</div>
                <div className="text-3xl md:text-4xl font-black text-rose-400">{formatRp(treasuryMetrics.supplierDue)}</div>
            </div>
            <div className="pt-4 md:pt-0 md:pl-8">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Calculator size={14}/> Net Runway (Kapasitas Produksi)</div>
                <div className="text-3xl md:text-4xl font-black text-blue-400">{treasuryMetrics.chickenRunwayKg.toLocaleString()} <span className="text-sm text-slate-500">KG Ayam</span></div>
            </div>
        </div>
      </div>

      {/* SECTION 3: MINI CARDS TAMBAHAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-1 flex items-center gap-2"><RefreshCcw size={14} className="text-orange-500" /> Piutang Marketplace</h4>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Dana belum cair dari platform</div>
              <div className="text-2xl font-black text-slate-900">{formatRp(treasuryMetrics.pendingMarketplaceAR)}</div>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center"><ArrowDownLeft size={20} className="text-orange-500"/></div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-1 flex items-center gap-2"><Building2 size={14} className="text-indigo-500" /> Valuasi Aset Beku</h4>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Total nilai stok (HPP) saat ini</div>
              <div className="text-2xl font-black text-slate-900">{formatRp(treasuryMetrics.totalInventoryValue)}</div>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center"><FileText size={20} className="text-indigo-500"/></div>
          </div>
      </div>

      {/* SECTION 4: TABEL HISTORI PENERIMAAN KAS (BARU) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-4">
         <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2"><Landmark size={16} className="text-blue-600"/> Histori Penerimaan Setoran Cabang</h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase bg-white border px-2 py-1 rounded-lg shadow-sm">15 Transaksi Terakhir</span>
         </div>
         <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-sm text-left">
               <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Tgl & ID Ref</th>
                    <th className="px-6 py-4">Keterangan Setoran</th>
                    <th className="px-6 py-4 text-center">Metode</th>
                    <th className="px-6 py-4 text-right">Nominal Masuk</th>
                    <th className="px-6 py-4 text-center">Status Validasi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {settlementHistory.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-10 text-slate-400"><Landmark size={32} className="mx-auto mb-2 opacity-20"/>Belum ada histori penerimaan kas dari cabang.</td></tr>
                  ) : (
                      settlementHistory.slice(0, 15).map(tx => (
                         <tr key={tx.id} className="hover:bg-blue-50/50 transition">
                            <td className="px-6 py-4">
                              <div className="text-slate-800">{tx.date}</div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{tx.reference_id || tx.id}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-slate-700">{tx.description}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border text-[9px] uppercase tracking-wider">{tx.payment_method}</span>
                            </td>
                            <td className="px-6 py-4 text-right text-emerald-600 font-black text-sm">
                              + {formatRp(tx.amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="flex items-center justify-center gap-1 text-emerald-600 text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-lg w-max mx-auto shadow-sm">
                                <CheckCircle size={12} /> Diterima
                              </span>
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
