import React, { useMemo } from 'react';
import { Calculator, AlertTriangle, Wallet, Building2, Truck, RefreshCcw, Landmark, ShieldCheck, CheckCircle } from 'lucide-react';
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
  
  // ========================================================
  // CORE TREASURY CALCULATION ENGINE
  // ========================================================
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

  // SETTLEMENTS YANG MENUNGGU APPROVAL PUSAT
  const pendingSettlements = useMemo(() => {
    return (branch_settlements || []).filter(s => 
      s.transfer_status === 'PENDING_APPROVAL' && (!s.isDeleted || String(s.isDeleted).toUpperCase() !== 'TRUE')
    );
  }, [branch_settlements]);

  const handleApproveSettlement = async (settlement) => {
    if (!window.confirm(`Konfirmasi Uang Masuk\n\nApakah setoran sebesar ${formatRp(settlement.amount_transferred)} dari cabang ${settlement.branch_id} sudah Anda terima?`)) return;

    const updatedSettlement = { ...settlement, transfer_status: 'SETTLED' };

    const cfiPayload = {
      id: generateId('CFI', new Date()), date: getTodayStr(), branch_id: 'HQ_FACTORY',
      transaction_type: 'INFLOW', category: 'BRANCH_SETTLEMENT', amount: settlement.amount_transferred,
      payment_method: settlement.transfer_method, reference_id: settlement.settlement_id,
      description: `Penerimaan setoran closing dari cabang ${settlement.branch_id}`
    };

    const ok = await sendToSheet('update', updatedSettlement, 'branch_settlements');
    if (ok) {
      await sendToSheet('insert', cfiPayload, 'cashflow_transactions');
      if (showToast) showToast("Setoran divalidasi, kas global bertambah!", "success");
      window.location.reload(); 
    }
  };

  if (user?.branch_type !== 'HQ_FACTORY') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-slate-200"><ShieldCheck size={32} className="text-slate-400" /></div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider mb-2">Akses Terbatas</h2>
        <p className="text-sm font-bold text-slate-500 max-w-md">Global Treasury Dashboard secara eksklusif diakses oleh Pusat Komando (HQ_FACTORY).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {pendingSettlements.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-black text-orange-800 text-sm tracking-widest uppercase mb-4 flex items-center gap-2"><AlertTriangle size={18}/> Validasi Uang Masuk Cabang ({pendingSettlements.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingSettlements.map(s => {
              const branchInfo = (master_branches || []).find(b => String(b.branch_id).toUpperCase() === String(s.branch_id).toUpperCase());
              const displayName = branchInfo ? branchInfo.branch_name : s.branch_id;
              
              return (
                <div key={s.settlement_id} className="bg-white p-5 rounded-2xl border border-orange-100 shadow-md flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-1 rounded uppercase tracking-widest">{displayName}</span>
                      <span className="text-[9px] font-bold text-slate-400 font-mono">{s.settlement_id}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{formatRp(s.amount_transferred)}</div>
                    <div className="text-[10px] text-slate-500 font-bold mt-2 border-t pt-2">Metode: {s.transfer_method}</div>
                  </div>
                  <button onClick={() => handleApproveSettlement(s)} className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-2.5 rounded-xl uppercase tracking-wider flex justify-center items-center gap-1 transition">
                    <CheckCircle size={14}/> Approve & Terima Kas
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        <div className="p-6 md:p-8 border-b border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase flex items-center gap-3"><Calculator className="text-blue-400"/> Chicken Treasury Engine</h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Global Liquidity & Runway Simulator</p>
            </div>
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 px-5 py-3 rounded-2xl text-right flex items-center gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Market Price (Ayam)</div>
                  <div className="text-lg font-black text-blue-400">{formatRp(treasuryMetrics.latestChickenPrice)}</div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 relative z-10">
            <div className="p-6 md:p-8 bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2"><Landmark size={16} className="text-emerald-400"/><div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Kas Global Tersedia</div></div>
                <div className="text-3xl md:text-4xl font-black text-white">{formatRp(treasuryMetrics.totalCashGlobal)}</div>
            </div>
            <div className="p-6 md:p-8 bg-rose-950/10">
                <div className="flex items-center gap-2 mb-2"><Truck size={16} className="text-rose-400"/><div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Kewajiban Hutang (AP)</div></div>
                <div className="text-3xl md:text-4xl font-black text-rose-400">{formatRp(treasuryMetrics.supplierDue)}</div>
            </div>
            <div className={`p-6 md:p-8 ${treasuryMetrics.isDeficit ? 'bg-rose-900/20' : 'bg-blue-900/20'}`}>
                <div className="flex items-center gap-2 mb-2"><Wallet size={16} className={treasuryMetrics.isDeficit ? 'text-rose-400' : 'text-blue-400'}/><div className={`text-[10px] font-black uppercase tracking-widest ${treasuryMetrics.isDeficit ? 'text-rose-400' : 'text-blue-400'}`}>Net Runway</div></div>
                {treasuryMetrics.isDeficit ? (
                    <div className="mt-3 bg-rose-950/50 border border-rose-800/50 rounded-xl p-4">
                      <div className="text-sm font-black text-rose-400 uppercase flex items-center gap-2 mb-1"><AlertTriangle size={18}/> DEFISIT</div>
                    </div>
                ) : (
                    <div className="text-4xl md:text-5xl font-black text-blue-400">{treasuryMetrics.chickenRunwayKg.toLocaleString('id-ID')} <span className="text-sm font-bold text-blue-400/60 tracking-wider">KG AYAM</span></div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm"><h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><RefreshCcw size={16} className="text-orange-500" /> Piutang Marketplace</h4><div className="text-3xl font-black text-slate-900">{formatRp(treasuryMetrics.pendingMarketplaceAR)}</div></div>
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm"><h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Building2 size={16} className="text-indigo-500" /> Valuasi Aset</h4><div className="text-3xl font-black text-slate-900">{formatRp(treasuryMetrics.totalInventoryValue)}</div></div>
      </div>
    </div>
  );
}
