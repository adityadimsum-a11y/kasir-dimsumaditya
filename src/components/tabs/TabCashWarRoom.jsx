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

  const pendingSettlements = useMemo(() => {
    return (branch_settlements || []).filter(s => 
      s.transfer_status === 'PENDING_APPROVAL' && (!s.isDeleted || String(s.isDeleted).toUpperCase() !== 'TRUE')
    );
  }, [branch_settlements]);

  const handleApproveSettlement = async (settlement) => {
    if (!window.confirm(`Konfirmasi Uang Masuk\n\nApakah setoran ${formatRp(settlement.amount_transferred)} dari ${settlement.branch_id} sudah diterima fisik/mutasinya?`)) return;

    try {
      // PERBAIKAN FATAL: Memanggil aksi khusus yang ada di backend (Apps Script).
      // Backend akan melakukan UPDATE dan INSERT secara atomik (bersamaan dan aman).
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
      {pendingSettlements.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-black text-orange-800 text-sm tracking-widest uppercase mb-4 flex items-center gap-2"><AlertTriangle size={18}/> Validasi Uang Masuk ({pendingSettlements.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pendingSettlements.map(s => {
              const branchInfo = (master_branches || []).find(b => String(b.branch_id).toUpperCase() === String(s.branch_id).toUpperCase());
              return (
                <div key={s.settlement_id} className="bg-white p-5 rounded-2xl border border-orange-100 shadow-md">
                  <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">{branchInfo?.branch_name || s.branch_id}</div>
                  <div className="text-2xl font-black text-slate-800 mb-4">{formatRp(s.amount_transferred)}</div>
                  <button onClick={() => handleApproveSettlement(s)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-2 rounded-xl uppercase tracking-wider transition">Approve</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DASHBOARD KAS GLOBAL */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Calculator className="text-blue-400"/> Treasury Engine</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kas Global Tersedia</div>
                <div className="text-4xl font-black text-emerald-400 mt-2">{formatRp(treasuryMetrics.totalCashGlobal)}</div>
            </div>
            <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kewajiban Hutang</div>
                <div className="text-4xl font-black text-rose-400 mt-2">{formatRp(treasuryMetrics.supplierDue)}</div>
            </div>
            <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Runway (KG)</div>
                <div className="text-4xl font-black text-blue-400 mt-2">{treasuryMetrics.chickenRunwayKg.toLocaleString()}</div>
            </div>
        </div>
      </div>
    </div>
  );
}
