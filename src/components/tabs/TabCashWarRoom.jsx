import React, { useMemo, useState } from 'react';
import { Layers, ShieldAlert, DollarSign, Package, AlertTriangle, Calculator } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabCashWarRoom({ orders, purchases, expenses, marketplaceSettlement, supplierLedger, inventoryCostLayers }) {
  const todayStr = getTodayStr();

  const warRoomData = useMemo(() => {
    let cashIn = 0;
    (orders || []).forEach(o => { if (!o.isDeleted && o.paymentMethod !== 'MARKETPLACE') cashIn += Number(o.total) || 0; });

    let cashOutExp = 0;
    (expenses || []).forEach(e => { if (!e.isDeleted) cashOutExp += Number(e.amount) || 0; });

    let cashOutPur = 0;
    (purchases || []).forEach(p => { if (!p.isDeleted && p.paymentMethod === 'CASH') cashOutPur += Number(p.paidAmount) || 0; });

    let hutangAyam = 0; let cicilanPay = 0;
    (supplierLedger || []).forEach(l => {
        if (!l.isDeleted) {
            if (l.transaction_type === 'PURCHASE') hutangAyam += Number(l.amount) || 0;
            if (l.transaction_type === 'PAYMENT') { hutangAyam -= Number(l.amount) || 0; cicilanPay += Number(l.amount) || 0; }
        }
    });

    const netCash = cashIn - cashOutExp - cashOutPur - cicilanPay;
    const ayamPurchases = (purchases || []).filter(p => !p.isDeleted && String(p.itemName).toUpperCase().includes('AYAM')).sort((a, b) => new Date(b.date) - new Date(a.date));
    const latestPrice = ayamPurchases.length > 0 ? Number(ayamPurchases[0].price) : 35000;

    const disposable = netCash - hutangAyam;
    const kgBisaBeli = disposable > 0 ? Math.floor(disposable / latestPrice) : 0;

    let pendingMarketplace = 0;
    (marketplaceSettlement || []).forEach(m => { if (!m.isDeleted && m.status === 'PENDING') pendingMarketplace += Number(m.net_received || m.net) || 0; });

    let assetVal = 0;
    (inventoryCostLayers || []).forEach(l => { if (!l.isDeleted && l.status === 'ACTIVE') assetVal += (Number(l.qty_remaining) * Number(l.unit_cost)); });

    return { netCash, cashIn, cashOutExp, hutangAyam, latestPrice, disposable, kgBisaBeli, pendingMarketplace, assetVal };
  }, [orders, purchases, expenses, supplierLedger, marketplaceSettlement, inventoryCostLayers]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center relative z-10">
            <div>
                <h2 className="text-lg font-black text-white uppercase flex items-center gap-2"><Calculator className="text-amber-400"/> Chicken Cashflow Engine</h2>
                <p className="text-xs text-slate-400 mt-1">Simulasi daya beli modal mengacu pada timbunan hutang berjalan.</p>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-xl text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Harga Ayam Terakhir</div>
                <div className="text-lg font-black text-amber-400">{formatRp(warRoomData.latestPrice)} <span className="text-xs text-slate-500">/ KG</span></div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 relative z-10">
            <div className="p-6">
                <div className="text-[10px] font-black text-emerald-400 uppercase mb-2">Estimasi Kas Tersedia</div>
                <div className="text-3xl font-black text-white">{formatRp(warRoomData.netCash)}</div>
                <div className="text-[9px] text-slate-500 font-bold mt-4">Kotor Masuk Laci: {formatRp(warRoomData.cashIn)}</div>
            </div>

            <div className="p-6 bg-slate-800/20">
                <div className="text-[10px] font-black text-rose-400 uppercase mb-2">Hutang Bahan Baku (AP)</div>
                <div className="text-3xl font-black text-rose-400">{formatRp(warRoomData.hutangAyam)}</div>
                <div className="text-[9px] text-slate-500 font-bold mt-4">Wajib dilunasi untuk proteksi supplier.</div>
            </div>

            <div className="p-6 bg-amber-500/10">
                <div className="text-[10px] font-black text-amber-400 uppercase mb-2">Sisa Kemampuan Beli Anggaran</div>
                {warRoomData.disposable <= 0 ? (
                    <div className="text-sm font-black text-rose-400 uppercase flex items-center gap-1 mt-2"><AlertTriangle size={16}/> DEFISIT KAS OPERASIONAL</div>
                ) : (
                    <div>
                        <div className="text-4xl font-black text-amber-400">{warRoomData.kgBisaBeli.toLocaleString('id-ID')} <span className="text-sm font-bold">KG AYAM</span></div>
                        <div className="text-[10px] text-slate-400 mt-2">Setara {Math.floor(warRoomData.kgBisaBeli/10)} Kantong mentah aman.</div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
             <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3">Piutang Mengambang Marketplace</h4>
             <div className="bg-slate-50 p-4 rounded-xl font-black text-xl text-orange-600 border">{formatRp(warRoomData.pendingMarketplace)}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
             <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3">Valuasi Lapisan Aset Beku</h4>
             <div className="bg-slate-50 p-4 rounded-xl font-black text-xl text-purple-700 border">{formatRp(warRoomData.assetVal)}</div>
          </div>
      </div>
    </div>
  );
}
