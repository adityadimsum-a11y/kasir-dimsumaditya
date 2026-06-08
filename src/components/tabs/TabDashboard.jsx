import React, { useMemo } from 'react';
import { 
  Activity, Wallet, AlertCircle, PieChart, ShieldAlert, 
  AlertTriangle, FileText, CheckCircle, PlusCircle, ShoppingCart, Truck, Package, Layers
} from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabDashboard({ orders, purchases, stockMovements, inventoryCostLayers, supplierLedger, cashflowTransactions, distributionOrders, financialClosings, user, handleTabChange }) {
  const todayStr = getTodayStr();

  const operationCenter = useMemo(() => {
    const today = new Date(todayStr);
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    let revToday = 0, profitToday = 0, rev30D = 0, profit30D = 0;
    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const date = getLocalYMD(o.date);
      if (date === todayStr) { revToday += Number(o.total) || 0; profitToday += Number(o.net_profit) || 0; }
      if (date >= str30Days) { rev30D += Number(o.total) || 0; profit30D += Number(o.net_profit) || 0; }
    });

    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
      if (l.isDeleted) return;
      if (l.transaction_type === 'PURCHASE') hutangAyamAktif += Number(l.amount);
      if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= Number(l.amount);
    });

    let ayamUsed30D = 0, currentAyamKg = 0;
    (stockMovements || []).forEach(m => {
      if (!m.isDeleted && String(m.item_name).toUpperCase() === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE' && getLocalYMD(m.date) >= str30Days) ayamUsed30D += Number(m.qty);
    });
    (inventoryCostLayers || []).forEach(l => {
      if (!l.isDeleted && l.status === 'ACTIVE' && l.item_name === 'AYAM') currentAyamKg += Number(l.qty_remaining);
    });

    const avgAyamPerDay = ayamUsed30D / 30;
    const ayamRunway = avgAyamPerDay > 0 ? currentAyamKg / avgAyamPerDay : 99;

    // 🌟 DAILY OPERATION MATRIX CRON (PHASE 12 CHECKLIST)
    const pendingDOs = (distributionOrders || []).filter(d => d.status === 'IN_TRANSIT' || d.status === 'DIKIRIM').length;
    const pendingAR = (orders || []).filter(o => !o.isDeleted && o.settlement_status === 'PENDING').length;
    const isClosedToday = (financialClosings || []).some(c => !c.isDeleted && getLocalYMD(c.date) === todayStr);

    const summary = {
      cash: currentAyamKg > 0 ? 'AMAN' : 'WARNING',
      stok: ayamRunway >= 3 ? 'AMAN' : 'WARNING',
      hutang: hutangAyamAktif > 5000000 ? 'WARNING' : 'AMAN',
      margin: profit30D > 0 ? 'AMAN' : 'WARNING'
    };

    return { revToday, profitToday, rev30D, profit30D, hutangAyamAktif, currentAyamKg, ayamRunway, pendingDOs, pendingAR, isClosedToday, summary };
  }, [orders, purchases, stockMovements, inventoryCostLayers, supplierLedger, cashflowTransactions, distributionOrders, financialClosings, todayStr]);

  const StatusBadge = ({ label, status }) => (
    <div className={`flex items-center justify-between p-3 rounded-xl border font-bold text-xs shadow-sm transition-all duration-200 ${status === 'AMAN' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800 animate-pulse'}`}>
      <span>{label}</span>
      <span className={`w-2 h-2 rounded-full ${status === 'AMAN' ? 'bg-emerald-500' : 'bg-rose-600'}`}></span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-10">
      
      {/* 1. EXECUTIVE SNAPSHOT HEADER */}
      <div className="bg-slate-900 rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="relative z-10 text-white w-full flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2"><ShieldAlert size={18} className="text-emerald-400"/><span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Executive Command Center</span></div>
            <h2 className="text-2xl font-black tracking-tight">Status Operasional Global</h2>
            <p className="text-slate-400 font-medium mt-1 text-xs max-w-xl">Akses cepat kendali holding, deteksi risiko rantai pasok, dan pengawasan buku keuangan kasir.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 w-full lg:w-[400px]">
            <StatusBadge label="Likuiditas Cash" status={operationCenter.summary.cash} />
            <StatusBadge label="Stok Bahan Baku" status={operationCenter.summary.stok} />
            <StatusBadge label="Hutang Supplier" status={operationCenter.summary.hutang} />
            <StatusBadge label="Margin 30 Hari" status={operationCenter.summary.margin} />
          </div>
        </div>
      </div>

      {/* 2. FAST ACTION RADAR GRID (ZERO-CLICK NAVIGATION SYSTEM) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 no-print">
        <button onClick={() => handleTabChange('orders')} className="p-4 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex flex-col items-center gap-2 transition-all duration-150 transform active:scale-95 shadow-sm">
          <ShoppingCart className="text-blue-600" size={20}/> Order / Kasir Baru
        </button>
        <button onClick={() => handleTabChange('stok')} className="p-4 bg-white hover:bg-purple-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex flex-col items-center gap-2 transition-all duration-150 transform active:scale-95 shadow-sm">
          <Layers className="text-purple-600" size={20}/> Produksi Batch Baru
        </button>
        <button onClick={() => handleTabChange('distribusi')} className="p-4 bg-white hover:bg-orange-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex flex-col items-center gap-2 transition-all duration-150 transform active:scale-95 shadow-sm">
          <Truck className="text-orange-600" size={20}/> Kirim Logistik (DO)
        </button>
        <button onClick={() => handleTabChange('expenses')} className="p-4 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex flex-col items-center gap-2 transition-all duration-150 transform active:scale-95 shadow-sm">
          <Wallet className="text-rose-600" size={20}/> Catat Pengeluaran
        </button>
        <button onClick={() => handleTabChange('stok')} className="p-4 bg-white hover:bg-emerald-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex flex-col items-center gap-2 transition-all duration-150 transform active:scale-95 shadow-sm">
          <Package className="text-emerald-600" size={20}/> Stock Opname Fisik
        </button>
      </div>

      {/* 3. DAILY OPERATION MODE: WHAT TO DO TODAY CHECKLIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-xs tracking-wide uppercase">Daily Operation Board (Agenda Hari Ini)</h3>
          <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-md font-mono">{todayStr}</span>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Sisi Kiri: Checklist Tugas */}
          <div className="space-y-2">
            <div className={`p-3 rounded-xl border flex items-center justify-between ${operationCenter.isClosedToday ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${operationCenter.isClosedToday ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                Closing Buku Harian Kasir
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">{operationCenter.isClosedToday ? 'Selesai' : 'Pending'}</span>
            </div>
            
            <div className={`p-3 rounded-xl border flex items-center justify-between ${operationCenter.pendingDOs === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${operationCenter.pendingDOs === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                Penerimaan Surat Jalan (DO) Gudang
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">{operationCenter.pendingDOs === 0 ? 'Clear' : `${operationCenter.pendingDOs} In Transit`}</span>
            </div>
          </div>

          {/* Sisi Kanan: Warning Operasional */}
          <div className="space-y-2">
            <div className={`p-3 rounded-xl border flex items-center justify-between ${operationCenter.pendingAR === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${operationCenter.pendingAR === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                Pencairan Dana Marketplace (AR Pending)
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">{operationCenter.pendingAR === 0 ? 'Clear' : `${operationCenter.pendingAR} Transaksi Payout`}</span>
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${operationCenter.ayamRunway >= 3 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${operationCenter.ayamRunway >= 3 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                Ketahanan Stok Ayam Fillet Pusat
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">{operationCenter.ayamRunway > 90 ? 'Aman' : `${Math.floor(operationCenter.ayamRunway)} Hari Lagi`}</span>
            </div>
          </div>

        </div>
      </div>

      {/* 4. REAL-TIME FISIK SNAPSHOT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Omzet Penjualan Hari Ini</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{formatRp(operationCenter.revToday)}</div>
          <div className="text-[10px] font-bold text-emerald-600 mt-0.5">Profit Bersih Terbuku: {formatRp(operationCenter.profitToday)}</div>
        </div>
        <div className="border-l-0 md:border-l pl-0 md:pl-6">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hutang Supplier Berjalan</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{formatRp(operationCenter.hutangAyamAktif)}</div>
          <div className="text-[10px] font-bold text-rose-600 mt-0.5">Beban AP Jatuh Tempo Terdekat</div>
        </div>
        <div className="border-l-0 md:border-l pl-0 md:pl-6">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ayam Tersisa Di Gudang</div>
          <div className="text-2xl font-black text-orange-600 mt-1">{Math.round(operationCenter.currentAyamKg)} <span className="text-xs text-slate-400">KG</span></div>
          <div className="text-[10px] font-bold text-slate-400 mt-0.5">Siap digunakan untuk lini produksi</div>
        </div>
      </div>

    </div>
  );
}
