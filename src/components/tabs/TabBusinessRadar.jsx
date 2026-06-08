import React, { useMemo } from 'react';
import { Radar, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Package, Activity, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

const THRESHOLDS = {
  MIN_CASH_DAYS: 7,
  MIN_AYAM_DAYS: 3,
  MIN_FROZEN_DAYS: 4,
  MAX_FROZEN_DAYS: 21,
  WASTE_WARNING_PERCENT: 2 // 2% dari Omzet
};

export default function TabBusinessRadar({ 
  orders, stockMovements, expenses, supplierLedger, 
  cashflowTransactions, inventoryCostLayers, marketplaceSettlement, masterBranches, discrepancyLogs 
}) {
  const todayStr = getTodayStr();

  const forecast = useMemo(() => {
    const today = new Date();
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    // ==========================================
    // 1. DATA GATHERING (LAST 30 DAYS VELOCITY)
    // ==========================================
    let netSales30D = 0, opex30D = 0, wasteLoss30D = 0;
    let ayamUsed30D = 0, frozenSold30D = 0;
    
    (orders || []).forEach(o => { if (!o.isDeleted && getLocalYMD(o.date) >= str30Days) netSales30D += (Number(o.net_profit) || 0); });
    (expenses || []).forEach(e => { if (!e.isDeleted && getLocalYMD(e.date) >= str30Days) opex30D += (Number(e.amount) || 0); });
    (discrepancyLogs || []).forEach(d => { if (!d.isDeleted && getLocalYMD(d.date) >= str30Days) wasteLoss30D += (Number(d.financial_loss) || 0); });
    
    (stockMovements || []).forEach(m => {
      if (m.isDeleted || getLocalYMD(m.date) < str30Days) return;
      if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30D += Number(m.qty);
      if (String(m.item_name).includes('DIMSUM') && m.movement_type === 'SALE') frozenSold30D += Number(m.qty);
    });

    const avgNetSalesDay = netSales30D / 30;
    const avgOpexDay = opex30D / 30;
    const avgAyamDay = ayamUsed30D / 30;
    const avgFrozenDay = frozenSold30D / 30;

    // ==========================================
    // 2. CURRENT SNAPSHOT
    // ==========================================
    let currentCash = 0, pendingAR = 0, supplierAP = 0;
    let currentAyamKg = 0, currentFrozenPcs = 0;

    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      currentCash += (Number(c.amount_in || (c.type === 'CASH_IN' ? c.amount : 0)) - Number(c.amount_out || (c.type === 'CASH_OUT' ? c.amount : 0)));
    });
    (marketplaceSettlement || []).forEach(m => { if (!m.isDeleted && m.status === 'PENDING') pendingAR += Number(m.net); });
    (supplierLedger || []).forEach(l => {
      if (l.isDeleted) return;
      if (l.transaction_type === 'PURCHASE') supplierAP += Number(l.amount);
      if (l.transaction_type === 'PAYMENT') supplierAP -= Number(l.amount);
    });

    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.status !== 'ACTIVE') return;
      if (l.item_name === 'AYAM') currentAyamKg += Number(l.qty_remaining);
      if (String(l.item_name).includes('DIMSUM')) currentFrozenPcs += Number(l.qty_remaining);
    });

    // Ayam Price Estimator
    const activeAyamLayers = (inventoryCostLayers || []).filter(l => l.item_name === 'AYAM' && l.status === 'ACTIVE');
    const avgAyamPrice = activeAyamLayers.length > 0 ? Number(activeAyamLayers[0].unit_cost) : 38000;

    // ==========================================
    // 3. CASHFLOW FORECAST ENGINE (7, 14, 30 Days)
    // ==========================================
    const generateForecast = (days) => {
      const projectedSales = avgNetSalesDay * days;
      const projectedOpex = avgOpexDay * days;
      const projectedAyamCost = (avgAyamDay * days) * avgAyamPrice;
      // Asumsi AP dibayar lunas dalam 7 hari, AR cair dalam 3 hari
      const apDeduction = days >= 7 ? supplierAP : (supplierAP / 7) * days;
      const arAddition = days >= 3 ? pendingAR : (pendingAR / 3) * days;
      
      const projectedCash = currentCash + arAddition + projectedSales - apDeduction - projectedOpex - projectedAyamCost;
      return projectedCash;
    };

    const cashForecast = { d7: generateForecast(7), d14: generateForecast(14), d30: generateForecast(30) };

    // ==========================================
    // 4. RUNWAY & EARLY WARNING ENGINE
    // ==========================================
    const ayamRunwayDays = avgAyamDay > 0 ? currentAyamKg / avgAyamDay : 999;
    const frozenRunwayDays = avgFrozenDay > 0 ? currentFrozenPcs / avgFrozenDay : 999;
    const netCashBurnRate = (avgOpexDay + (avgAyamDay * avgAyamPrice)) - avgNetSalesDay; // Jika positif, artinya bakar duit
    const cashRunwayDays = netCashBurnRate > 0 ? currentCash / netCashBurnRate : 999;

    const alerts = [];
    
    // CASH ALERTS
    if (cashForecast.d7 < 0) alerts.push({ type: 'CRITICAL', title: 'POTENSI GAGAL BAYAR 7 HARI', desc: `Kas diprediksi minus ${formatRp(Math.abs(cashForecast.d7))} dalam seminggu ke depan. Tunda pembayaran supplier atau genjot sales.` });
    else if (currentCash < supplierAP) alerts.push({ type: 'WARNING', title: 'DEFISIT KAS VS HUTANG', desc: `Kas likuid tidak cukup untuk menutup hutang ayam aktif.` });

    // STOCK ALERTS
    if (ayamRunwayDays < THRESHOLDS.MIN_AYAM_DAYS) alerts.push({ type: 'CRITICAL', title: 'KRISIS RAW MATERIAL', desc: `Ayam mentah sisa ${Math.floor(ayamRunwayDays)} hari. Proses pengadaan sekarang!` });
    if (frozenRunwayDays < THRESHOLDS.MIN_FROZEN_DAYS) alerts.push({ type: 'WARNING', title: 'FROZEN STOCK MENIPIS', desc: `Stok gudang beku habis dalam ${Math.floor(frozenRunwayDays)} hari dengan velocity saat ini.` });
    if (frozenRunwayDays > THRESHOLDS.MAX_FROZEN_DAYS) alerts.push({ type: 'INFO', title: 'INDIKASI OVERSTOCK FROZEN', desc: `Stok beku menumpuk untuk ${Math.floor(frozenRunwayDays)} hari. Hati-hati risiko expiry.` });

    // BRANCH HEALTH & MARKETPLACE ALERTS
    if (pendingAR > currentCash) alerts.push({ type: 'WARNING', title: 'LIKUIDITAS TERTAHAN MARKETPLACE', desc: `Dana tertahan di aplikasi online melebihi kas di tangan. Cek status settlement!` });
    const wastePercent = netSales30D > 0 ? (wasteLoss30D / netSales30D) * 100 : 0;
    if (wastePercent > THRESHOLDS.WASTE_WARNING_PERCENT) alerts.push({ type: 'CRITICAL', title: 'WASTE LOSS ABNORMAL', desc: `Rasio barang rusak/hilang mencapai ${wastePercent.toFixed(1)}% dari omzet. Segera lakukan Stock Opname!` });

    // Sort alerts: CRITICAL -> WARNING -> INFO
    alerts.sort((a, b) => {
      const weight = { CRITICAL: 3, WARNING: 2, INFO: 1 };
      return weight[b.type] - weight[a.type];
    });

    return { cashForecast, ayamRunwayDays, frozenRunwayDays, alerts, avgAyamDay, currentAyamKg, currentCash, supplierAP, pendingAR };
  }, [orders, stockMovements, expenses, supplierLedger, cashflowTransactions, inventoryCostLayers, marketplaceSettlement, discrepancyLogs]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER RADAR */}
      <div className="bg-slate-900 rounded-2xl p-6 border shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2"><Radar className="text-cyan-400 animate-pulse"/> Business Radar & Prediction Engine</h2>
          <p className="text-xs text-slate-400 mt-1">Sistem menganalisis pergerakan data 30 hari terakhir untuk memprediksi masa depan.</p>
        </div>
        <div className="text-xs font-bold text-slate-900 bg-cyan-400 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          AI FORECAST ACTIVE
        </div>
      </div>

      {/* SMART ALERT CENTER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
          <AlertTriangle size={18} className="text-slate-600"/>
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Early Warning System</h3>
        </div>
        <div className="p-4 space-y-3">
          {forecast.alerts.length === 0 ? (
             <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
               <ShieldCheck size={24} className="text-emerald-600"/>
               <div>
                 <div className="font-bold text-sm">Bisnis Terpantau Sangat Sehat</div>
                 <div className="text-xs font-medium mt-0.5">Tidak ada anomali atau risiko kritikal dalam 7 hari ke depan.</div>
               </div>
             </div>
          ) : (
            forecast.alerts.map((alert, idx) => (
              <div key={idx} className={`p-4 rounded-xl border flex gap-4 items-start shadow-sm transition-all hover:scale-[1.01] ${
                alert.type === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-800' : 
                alert.type === 'WARNING' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                {alert.type === 'CRITICAL' ? <AlertTriangle size={24} className="text-red-600 shrink-0"/> : 
                 alert.type === 'WARNING' ? <AlertCircle size={24} className="text-amber-500 shrink-0"/> : 
                 <Activity size={24} className="text-blue-500 shrink-0"/>}
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide">{alert.title}</h4>
                  <p className="text-xs mt-1 font-medium">{alert.desc}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FORECAST DASHBOARD (CASH & STOCK) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CASHFLOW PREDICTION */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2"><DollarSign size={18} className="text-emerald-600"/> Cashflow Forecast Model</h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prediksi 7 Hari Depan</div>
              <div className={`text-lg font-black ${forecast.cashForecast.d7 >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(forecast.cashForecast.d7)}</div>
            </div>
            <div className="flex justify-between items-center border-b pb-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prediksi 14 Hari Depan</div>
              <div className={`text-lg font-black ${forecast.cashForecast.d14 >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatRp(forecast.cashForecast.d14)}</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prediksi 30 Hari Depan</div>
              <div className={`text-xl font-black ${forecast.cashForecast.d30 >= 0 ? 'text-purple-600' : 'text-red-600'}`}>{formatRp(forecast.cashForecast.d30)}</div>
            </div>
          </div>
        </div>

        {/* INVENTORY RUNWAY */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2"><Package size={18} className="text-orange-600"/> Inventory Runway (Stock Life)</h3>
          </div>
          <div className="p-6 flex-1 grid grid-cols-2 gap-4">
             <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${forecast.ayamRunwayDays < 3 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sisa Ayam Gudang</div>
                <div className={`text-4xl font-black ${forecast.ayamRunwayDays < 3 ? 'text-red-600' : 'text-slate-800'}`}>{forecast.ayamRunwayDays > 900 ? '∞' : Math.floor(forecast.ayamRunwayDays)}</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Hari Tersisa</div>
             </div>
             <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${forecast.frozenRunwayDays < 4 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sisa Dimsum Frozen</div>
                <div className={`text-4xl font-black ${forecast.frozenRunwayDays < 4 ? 'text-red-600' : 'text-slate-800'}`}>{forecast.frozenRunwayDays > 900 ? '∞' : Math.floor(forecast.frozenRunwayDays)}</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Hari Tersisa</div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
