import React, { useMemo } from 'react';
import { 
  Activity, Wallet, AlertCircle, PieChart, ShieldAlert, 
  AlertTriangle, FileText, CheckCircle
} from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabDashboard({ orders, purchases, stockMovements, inventoryCostLayers, supplierLedger, cashflowTransactions, user }) {
  const todayStr = getTodayStr();

  const analytics = useMemo(() => {
    const today = new Date(todayStr);
    const last7DaysDate = new Date(today); last7DaysDate.setDate(today.getDate() - 7);
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str7Days = last7DaysDate.toISOString().split('T')[0];
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    // Revenue & Profit Snapshot
    let revToday = 0, rev7D = 0, rev30D = 0;
    let profitToday = 0, profit7D = 0, profit30D = 0;

    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const date = getLocalYMD(o.date);
      const gross = Number(o.total) || 0;
      const net = Number(o.net_profit) || 0;

      if (date === todayStr) { revToday += gross; profitToday += net; }
      if (date >= str7Days) { rev7D += gross; profit7D += net; }
      if (date >= str30Days) { rev30D += gross; profit30D += net; }
    });

    // Treasury & Hutang
    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
      if (l.isDeleted) return;
      if (l.transaction_type === 'PURCHASE') hutangAyamAktif += Number(l.amount);
      if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= Number(l.amount);
    });

    let ayamUsed30D = 0;
    let currentAyamKg = 0;
    (stockMovements || []).forEach(m => {
      if (m.isDeleted) return;
      if (String(m.item_name).toUpperCase() === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE' && getLocalYMD(m.date) >= str30Days) ayamUsed30D += Number(m.qty);
    });
    
    (inventoryCostLayers || []).forEach(l => {
      if (!l.isDeleted && l.status === 'ACTIVE' && l.item_name === 'AYAM') currentAyamKg += Number(l.qty_remaining);
    });

    const activeAyamLayers = (inventoryCostLayers || []).filter(l => l.item_name === 'AYAM' && l.status === 'ACTIVE');
    const avgAyamPrice = activeAyamLayers.length > 0 ? Number(activeAyamLayers[0].unit_cost) : 38000;

    const avgAyamPerDay = ayamUsed30D / 30;
    const estAyam7DaysCost = (avgAyamPerDay * 7) * avgAyamPrice;
    const ayamRunway = avgAyamPerDay > 0 ? currentAyamKg / avgAyamPerDay : 99;

    let cashAvailable = 0;
    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      if (c.type === 'CASH_IN' || c.treasury_flow_type === 'MARKETPLACE_SETTLEMENT' || c.treasury_flow_type === 'BRANCH_SETTLEMENT') cashAvailable += Number(c.amount_in || c.amount);
      if (c.type === 'CASH_OUT' || c.treasury_flow_type === 'SUPPLIER_PAYMENT') cashAvailable -= Number(c.amount_out || c.amount);
    });

    // 🌟 AUTO SUMMARY ENGINE (PHASE 8)
    const summary = {
      cash: cashAvailable >= (hutangAyamAktif + estAyam7DaysCost) ? 'AMAN' : 'WARNING',
      stok: ayamRunway >= 3 ? 'AMAN' : 'WARNING',
      hutang: hutangAyamAktif > 0 ? 'WARNING' : 'AMAN',
      margin: profit30D > 0 ? 'AMAN' : 'WARNING'
    };

    return { revToday, rev7D, rev30D, profitToday, profit7D, profit30D, hutangAyamAktif, avgAyamPerDay, estAyam7DaysCost, cashAvailable, summary };
  }, [orders, purchases, stockMovements, inventoryCostLayers, supplierLedger, cashflowTransactions, todayStr]);

  const StatusBadge = ({ label, status }) => (
    <div className={`flex items-center justify-between p-3 rounded-xl border font-bold text-xs shadow-sm ${status === 'AMAN' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      <span>{label}</span>
      {status === 'AMAN' ? <CheckCircle size={16} className="text-emerald-600"/> : <AlertTriangle size={16} className="text-red-600 animate-pulse"/>}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. EXECUTIVE SNAPSHOT HEADER WITH AUTO SUMMARY */}
      <div className="bg-slate-900 rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute -top-24 -right-24 text-slate-800 opacity-50"><PieChart size={250}/></div>
        <div className="relative z-10 text-white w-full">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2"><ShieldAlert size={20} className="text-emerald-400"/><span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Executive Command Center</span></div>
              <h2 className="text-3xl font-black tracking-tight">Bisnis Hari Ini, {user.name}!</h2>
              <p className="text-slate-400 font-medium mt-1 text-sm max-w-xl">Snapshot performa holding, profitabilitas real-time, dan status peringatan dini (*Early Warning*).</p>
            </div>
            
            {/* AUTO SUMMARY GRID */}
            <div className="grid grid-cols-2 gap-2 w-full lg:w-[400px]">
              <StatusBadge label="Likuiditas Cash" status={analytics.summary.cash} />
              <StatusBadge label="Stok Bahan Baku" status={analytics.summary.stok} />
              <StatusBadge label="Hutang Supplier" status={analytics.summary.hutang} />
              <StatusBadge label="Margin 30 Hari" status={analytics.summary.margin} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Omzet Hari Ini</div>
              <div className="text-2xl font-black text-emerald-400">{formatRp(analytics.revToday)}</div>
              <div className="text-xs text-emerald-500/70 font-bold mt-1">Net: {formatRp(analytics.profitToday)}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Omzet 7 Hari (WTD)</div>
              <div className="text-2xl font-black text-blue-400">{formatRp(analytics.rev7D)}</div>
              <div className="text-xs text-blue-500/70 font-bold mt-1">Net: {formatRp(analytics.profit7D)}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Omzet 30 Hari (MTD)</div>
              <div className="text-2xl font-black text-purple-400">{formatRp(analytics.rev30D)}</div>
              <div className="text-xs text-purple-500/70 font-bold mt-1">Net: {formatRp(analytics.profit30D)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CHICKEN WAR ROOM (CORE BUSINESS METRICS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-100 p-5 flex items-center gap-3">
          <div className="bg-orange-500 text-white p-2 rounded-lg"><Activity size={20}/></div>
          <div>
            <h3 className="font-black text-orange-900 text-lg uppercase tracking-wide">Chicken War Room</h3>
            <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">Pantauan Arus Kas vs Kebutuhan Rantai Pasok Utama</p>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kas Tersedia (Liquid)</div>
            <div className={`text-3xl font-black ${analytics.cashAvailable >= analytics.hutangAyamAktif ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(analytics.cashAvailable)}</div>
            <div className="text-[10px] font-bold text-slate-400">Total uang di tangan Holding.</div>
          </div>
          
          <div className="space-y-1 border-l-2 pl-6">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hutang Ayam Berjalan</div>
            <div className="text-3xl font-black text-slate-800">{formatRp(analytics.hutangAyamAktif)}</div>
            <div className="text-[10px] font-bold text-red-500">Wajib dibayar ke Supplier.</div>
          </div>

          <div className="space-y-1 border-l-2 pl-6">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Burn Rate Ayam (Harian)</div>
            <div className="text-3xl font-black text-orange-600">{Math.round(analytics.avgAyamPerDay)} <span className="text-sm">KG/Hari</span></div>
            <div className="text-[10px] font-bold text-slate-400">Rata-rata pemakaian 30 hari.</div>
          </div>

          <div className="space-y-1 border-l-2 pl-6">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimasi Modal 7 Hari Depan</div>
            <div className="text-3xl font-black text-slate-800">{formatRp(analytics.estAyam7DaysCost)}</div>
            <div className="text-[10px] font-bold text-slate-400">Dibutuhkan untuk restock ayam.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
