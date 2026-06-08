import React, { useMemo } from 'react';
import { Calculator, AlertTriangle, Wallet, Building2, Truck, RefreshCcw, Landmark, ShieldCheck } from 'lucide-react';
import { formatRp } from '../../utils/helpers'; // <-- Sudah dibersihkan, tanpa formatDate

export default function TabCashWarRoom({ 
  orders, 
  purchases, 
  cashflow_transactions, 
  supplier_ledger, 
  master_branches, 
  inventory_cost_layers, 
  user 
}) {
  
  // ========================================================
  // CORE TREASURY CALCULATION ENGINE
  // ========================================================
  const treasuryMetrics = useMemo(() => {
    let totalCashGlobal = 0;
    let cashHq = 0;
    const branchCashMap = {};

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
      if (o.paymentMethod === 'MARKETPLACE_AR') {
        pendingMarketplaceAR += (Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0));
      }
    });

    let supplierDue = 0;
    (supplier_ledger || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.transaction_type === 'PURCHASE') supplierDue += Number(l.amount || 0);
      if (l.transaction_type === 'PAYMENT') supplierDue -= Number(l.amount || 0);
    });

    const ayamPurchases = (purchases || []).filter(p => {
      const isNotDeleted = !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE';
      const isAyam = String(p.item_name || p.itemName || '').toUpperCase().includes('AYAM');
      return isNotDeleted && isAyam;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const latestChickenPrice = ayamPurchases.length > 0 ? Number(ayamPurchases[0].price || 35000) : 35000;

    const disposableCash = totalCashGlobal - supplierDue;
    const chickenRunwayKg = disposableCash > 0 ? Math.floor(disposableCash / latestChickenPrice) : 0;
    const isDeficit = disposableCash <= 0;

    let totalInventoryValue = 0;
    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.status === 'ACTIVE') {
        totalInventoryValue += (Number(l.qty_remaining || 0) * Number(l.unit_cost || 0));
      }
    });

    return {
      totalCashGlobal,
      cashHq,
      branchCashMap,
      pendingMarketplaceAR,
      supplierDue,
      latestChickenPrice,
      disposableCash,
      chickenRunwayKg,
      isDeficit,
      totalInventoryValue
    };
  }, [cashflow_transactions, orders, supplier_ledger, purchases, inventory_cost_layers]);

  const isHQ = user?.branch_type === 'HQ_FACTORY';

  if (!isHQ) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-slate-200">
          <ShieldCheck size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider mb-2">Akses Terbatas</h2>
        <p className="text-sm font-bold text-slate-500 max-w-md">Global Treasury Dashboard ini secara eksklusif hanya dapat diakses oleh Pusat Komando (HQ_FACTORY).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        
        <div className="p-6 md:p-8 border-b border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase flex items-center gap-3">
                  <Calculator className="text-blue-400"/> Chicken Treasury Engine
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Global Liquidity & Runway Simulator</p>
            </div>
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 px-5 py-3 rounded-2xl text-right flex items-center gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Market Price (Ayam)</div>
                  <div className="text-lg font-black text-blue-400">{formatRp(treasuryMetrics.latestChickenPrice)} <span className="text-xs text-slate-500">/ KG</span></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 relative z-10">
            <div className="p-6 md:p-8 bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={16} className="text-emerald-400"/>
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Kas Global Tersedia</div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white">{formatRp(treasuryMetrics.totalCashGlobal)}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-4 uppercase flex justify-between">
                  <span>Pusat (HQ):</span>
                  <span className="text-white">{formatRp(treasuryMetrics.cashHq)}</span>
                </div>
            </div>

            <div className="p-6 md:p-8 bg-rose-950/10">
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={16} className="text-rose-400"/>
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Kewajiban Hutang (AP)</div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-rose-400">{formatRp(treasuryMetrics.supplierDue)}</div>
                <div className="text-[10px] text-rose-500/80 font-bold mt-4 uppercase">Uang wajib ditahan untuk proteksi arus suplai ayam.</div>
            </div>

            <div className={`p-6 md:p-8 ${treasuryMetrics.isDeficit ? 'bg-rose-900/20' : 'bg-blue-900/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className={treasuryMetrics.isDeficit ? 'text-rose-400' : 'text-blue-400'}/>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${treasuryMetrics.isDeficit ? 'text-rose-400' : 'text-blue-400'}`}>Net Disposable Cash (Runway)</div>
                </div>
                
                {treasuryMetrics.isDeficit ? (
                    <div className="mt-3 bg-rose-950/50 border border-rose-800/50 rounded-xl p-4">
                      <div className="text-sm font-black text-rose-400 uppercase flex items-center gap-2 mb-1"><AlertTriangle size={18}/> DEFISIT ANGGARAN</div>
                      <div className="text-[10px] text-rose-300/80 font-bold">Arus kas negatif. Tahan pembelian ayam sebelum hutang dilunasi atau ada setoran cabang.</div>
                    </div>
                ) : (
                    <div>
                        <div className="text-4xl md:text-5xl font-black text-blue-400">{treasuryMetrics.chickenRunwayKg.toLocaleString('id-ID')} <span className="text-sm font-bold text-blue-400/60 tracking-wider">KG AYAM</span></div>
                        <div className="text-[10px] font-bold text-slate-400 mt-3 uppercase bg-slate-950/50 border border-slate-800 px-3 py-2 rounded-lg">
                          Setara dengan dana tunai aman bernilai <span className="text-white font-black">{formatRp(treasuryMetrics.disposableCash)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0 opacity-50"></div>
             <div className="relative z-10">
               <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                 <RefreshCcw size={16} className="text-orange-500" /> Piutang Mengambang Marketplace (AR)
               </h4>
               <div className="text-3xl font-black text-slate-900">{formatRp(treasuryMetrics.pendingMarketplaceAR)}</div>
               <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Uang nyangkut di GoFood/ShopeeFood yang belum cair ke rekening.</p>
             </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-0 opacity-50"></div>
             <div className="relative z-10">
               <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Building2 size={16} className="text-indigo-500" /> Valuasi Aset Fisik & Frozen
               </h4>
               <div className="text-3xl font-black text-slate-900">{formatRp(treasuryMetrics.totalInventoryValue)}</div>
               <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Total nilai HPP barang yang saat ini menumpuk di Gudang dan Freezer.</p>
             </div>
          </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs">Node Cash Matrix (Posisi Kas Cabang)</h4>
         </div>
         <div className="overflow-x-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {Object.entries(treasuryMetrics.branchCashMap).map(([branchName, amount]) => {
                  if (branchName === 'PUSAT' || branchName === 'HQ_FACTORY') return null; 
                  
                  const bInfo = (master_branches || []).find(b => String(b.branch_id).toUpperCase() === branchName);
                  const bType = bInfo ? bInfo.branch_type : 'NODE';

                  return (
                     <div key={branchName} className="p-5 border border-slate-200 rounded-2xl hover:border-blue-400 transition group bg-white shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{bType.replace('_', ' ')}</div>
                        <div className="text-sm font-black text-slate-800 uppercase mb-4">{branchName}</div>
                        <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition">{formatRp(amount)}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-3 uppercase border-t pt-2 border-slate-100">Status: Belum di-settlement ke Pusat</div>
                     </div>
                  );
               })}
               {Object.keys(treasuryMetrics.branchCashMap).filter(k => k !== 'PUSAT' && k !== 'HQ_FACTORY').length === 0 && (
                 <div className="col-span-3 text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed rounded-2xl">
                    Belum ada data kasir dari Node Produksi maupun Outlet.
                 </div>
               )}
            </div>
         </div>
      </div>

    </div>
  );
}
