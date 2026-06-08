import React, { useMemo, useState } from 'react';
import { Layers, ShieldAlert, TrendingUp, DollarSign, Package, AlertTriangle, CheckCircle, Activity, ShoppingCart, Calculator } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabCashWarRoom({ orders, purchases, expenses, marketplaceSettlement, supplierLedger, inventoryCostLayers }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  // ==============================================================
  // CHICKEN CASHFLOW ENGINE & PROFITABILITY LOGIC (PHASE 12.5)
  // ==============================================================
  const warRoomData = useMemo(() => {
    // 1. HITUNG UANG KAS TUNAI (OPERASIONAL)
    // Pendekatan: Pemasukan Penjualan Tunai - Pengeluaran Kas - Pembelian Tunai - Cicilan Hutang
    let cashInFromSales = 0;
    (orders || []).forEach(o => {
        if (!o.isDeleted && o.paymentMethod !== 'MARKETPLACE') {
            cashInFromSales += Number(o.total) || 0;
        }
    });

    let cashOutExpenses = 0;
    (expenses || []).forEach(e => {
        if (!e.isDeleted) cashOutExpenses += Number(e.amount) || 0;
    });

    let cashOutPurchases = 0;
    (purchases || []).forEach(p => {
        if (!p.isDeleted && p.paymentMethod === 'CASH') cashOutPurchases += Number(p.paidAmount) || 0;
    });

    let hutangAyamBerjalan = 0;
    let cicilanDibayar = 0;
    (supplierLedger || []).forEach(l => {
        if (!l.isDeleted) {
            const amt = Number(l.amount) || 0;
            if (l.transaction_type === 'PURCHASE') {
                hutangAyamBerjalan += amt;
            } else if (l.transaction_type === 'PAYMENT') {
                hutangAyamBerjalan -= amt;
                cicilanDibayar += amt;
            }
        }
    });

    // Estimasi Kas Bersih di Tangan
    const netCashAvailable = cashInFromSales - cashOutExpenses - cashOutPurchases - cicilanDibayar;

    // 2. DAPATKAN HARGA AYAM TERBARU (HPP UPDATE)
    const ayamPurchases = (purchases || [])
        .filter(p => !p.isDeleted && String(p.itemName).toUpperCase().includes('AYAM'))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const latestAyamPrice = ayamPurchases.length > 0 ? Number(ayamPurchases[0].price) : 35000; // Default 35k jika kosong

    // 3. KALKULATOR KEMAMPUAN BELI AYAM (RUNWAY)
    // Asumsi konservatif: Hutang harus bisa dilunasi dulu dari Kas sebelum beli ayam baru.
    const disposableCash = netCashAvailable - hutangAyamBerjalan;
    const kgBisaDibeli = disposableCash > 0 ? Math.floor(disposableCash / latestAyamPrice) : 0;
    const kantongBisaDibeli = Math.floor(kgBisaDibeli / 10); // 1 Kantong = 10 KG

    // 4. MARKETPLACE REVENUE & PIUTANG GANTUNG
    let pendingMarketplace = 0;
    let settledMarketplace = 0;
    (marketplaceSettlement || []).forEach(m => {
        if (!m.isDeleted) {
            if (m.status === 'PENDING') pendingMarketplace += Number(m.net_received) || 0;
            if (m.status === 'SETTLED') settledMarketplace += Number(m.net_received) || 0;
        }
    });

    // 5. INVENTORY VALUATION (NILAI ASET BEKU DI FREEZER & RAW)
    let totalAssetValue = 0;
    (inventoryCostLayers || []).forEach(l => {
        if (!l.isDeleted && l.status === 'ACTIVE') {
            totalAssetValue += (Number(l.qty_remaining) * Number(l.unit_cost));
        }
    });

    return {
        cashInFromSales, cashOutExpenses, hutangAyamBerjalan, netCashAvailable, disposableCash,
        latestAyamPrice, kgBisaDibeli, kantongBisaDibeli, 
        pendingMarketplace, settledMarketplace, totalAssetValue
    };
  }, [orders, purchases, expenses, supplierLedger, marketplaceSettlement, inventoryCostLayers]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. CHICKEN CASHFLOW ENGINE (HERO BOARD) */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute -right-10 -bottom-10 opacity-5"><Calculator size={200} className="text-white"/></div>
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center relative z-10">
            <div>
                <h2 className="text-lg font-black text-white tracking-wide uppercase flex items-center gap-2"><Activity className="text-amber-400"/> Chicken Cashflow Engine</h2>
                <p className="text-xs text-slate-400 mt-1">Indikator daya beli bahan baku riil berdasarkan kas tunai & beban hutang.</p>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-xl text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Harga Ayam (Acuan Terakhir)</div>
                <div className="text-lg font-black text-amber-400">{formatRp(warRoomData.latestAyamPrice)} <span className="text-xs text-slate-500">/ KG</span></div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 relative z-10">
            {/* KOLOM 1: UANG TUNAI */}
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Estimasi Kas Tersedia</div>
                    <DollarSign size={16} className="text-emerald-500"/>
                </div>
                <div className="text-3xl font-black text-white mb-2">{formatRp(warRoomData.netCashAvailable)}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase flex flex-col gap-1 mt-4">
                    <div className="flex justify-between"><span>Penjualan Tunai:</span> <span className="text-slate-300">{formatRp(warRoomData.cashInFromSales)}</span></div>
                    <div className="flex justify-between"><span>Beban Opex & Beli:</span> <span className="text-rose-400">-{formatRp(warRoomData.cashOutExpenses)}</span></div>
                </div>
            </div>

            {/* KOLOM 2: BEBAN HUTANG */}
            <div className="p-6 bg-slate-800/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Hutang Supplier (Ayam)</div>
                    <ShieldAlert size={16} className="text-rose-500"/>
                </div>
                <div className="text-3xl font-black text-rose-400 mb-2">{formatRp(warRoomData.hutangAyamBerjalan)}</div>
                <div className="text-[10px] font-bold text-slate-500 mt-2 bg-slate-800/50 p-2 rounded-lg">
                    ⚠️ Uang kas akan dipotong imajiner oleh sistem untuk mengamankan pelunasan hutang ini terlebih dahulu sebelum membeli ayam baru.
                </div>
            </div>

            {/* KOLOM 3: KEMAMPUAN BELI (THE ULTIMATE ANSWER) */}
            <div className="p-6 bg-amber-500/10">
                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShoppingCart size={14}/> Daya Beli (Runway Produksi)
                </div>
                {warRoomData.disposableCash <= 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-2">
                        <AlertTriangle size={32} className="text-rose-500 mb-2"/>
                        <div className="text-sm font-black text-rose-400 uppercase">Defisit Anggaran</div>
                        <div className="text-[10px] text-slate-400 mt-1">Kas tidak cukup untuk menutupi hutang jatuh tempo. Stop belanja ayam!</div>
                    </div>
                ) : (
                    <div>
                        <div className="text-4xl font-black text-amber-400 flex items-end gap-2">
                            {warRoomData.kgBisaDibeli.toLocaleString('id-ID')} <span className="text-lg font-bold text-amber-600 mb-1">KG</span>
                        </div>
                        <div className="text-sm font-bold text-amber-200 mt-1">Atau setara <span className="text-white font-black">{warRoomData.kantongBisaDibeli.toLocaleString('id-ID')} Kantong</span>.</div>
                        <div className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-amber-500/20">
                            *Sisa uang aman (Disposable) setelah potong hutang: <b>{formatRp(warRoomData.disposableCash)}</b>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 2. REVENUE PENDAPATAN PASIF & ASET BEKU */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <div className="flex items-center gap-3 mb-4">
                 <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Layers size={20}/></div>
                 <div>
                     <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Piutang Gantung Marketplace</h3>
                     <p className="text-[10px] font-bold text-slate-500 uppercase">Uang belum cair dari GoFood/ShopeeFood</p>
                 </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 border p-4 rounded-xl">
                     <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Status: Belum Cair</div>
                     <div className="text-xl font-black text-orange-600">{formatRp(warRoomData.pendingMarketplace)}</div>
                 </div>
                 <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                     <div className="text-[10px] font-black text-emerald-700 uppercase mb-1">Sudah Cair (Settled)</div>
                     <div className="text-xl font-black text-emerald-600">{formatRp(warRoomData.settledMarketplace)}</div>
                 </div>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <div className="flex items-center gap-3 mb-4">
                 <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Package size={20}/></div>
                 <div>
                     <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Valuasi Aset Inventaris</h3>
                     <p className="text-[10px] font-bold text-slate-500 uppercase">Uang yang membeku menjadi barang</p>
                 </div>
             </div>
             <div className="flex items-center justify-between bg-slate-50 border p-4 rounded-xl h-[88px]">
                 <div>
                     <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Nilai HPP (FIFO) Aktif</div>
                     <div className="text-2xl font-black text-purple-700">{formatRp(warRoomData.totalAssetValue)}</div>
                 </div>
                 <CheckCircle size={32} className="text-purple-200"/>
             </div>
          </div>
      </div>
    </div>
  );
}
