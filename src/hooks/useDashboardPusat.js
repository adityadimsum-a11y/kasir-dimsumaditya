import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, discrepancyLogs, financialClosings, masterBranches, dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // Time Travel Helpers untuk Prediksi
    const today = new Date();
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 7);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // ==========================================
    // 1. ACCOUNTING & VALUATION BASE (Dari Fase 10)
    // ==========================================
    let assetAyam = 0; let assetDimsum = 0; let costPerLayerAyam = [];
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0 && layer.status.includes('ACTIVE')) {
            const val = Number(layer.qty_remaining) * Number(layer.unit_cost);
            if(String(layer.item_name).toUpperCase() === 'AYAM') { assetAyam += val; costPerLayerAyam.push(Number(layer.unit_cost)); }
            if(String(layer.item_name).toUpperCase() === 'DIMSUM') assetDimsum += val;
        }
    });
    const totalAssetInventory = assetAyam + assetDimsum;
    const avgAyamCost = costPerLayerAyam.length > 0 ? (costPerLayerAyam.reduce((a,b)=>a+b,0) / costPerLayerAyam.length) : 37500; // Fallback harga pasar

    let inCash = 0, outCash = 0, pendingMarketplace = 0, hutangAyamAktif = 0;
    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING') pendingMarketplace += (Number(m.net) || 0); });
    (supplierLedger || []).forEach(l => { const amt = Number(l.amount) || 0; if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; });
    (cashflowTransactions || []).forEach(c => { if(c.type === 'CASH_IN') inCash += Number(c.amount); if(c.type === 'CASH_OUT') outCash += Number(c.amount); });
    (orders || []).forEach(o => { if(o.source==='OFFLINE' && String(o.paymentMethod).toUpperCase().includes('CASH')) inCash += Number(o.paidAmount); });
    (expenses || []).forEach(e => { if(e.type==='OUT') outCash += Number(e.total); });

    const cashReadyTotal = inCash - outCash;
    const cashflowHealth = cashReadyTotal - hutangAyamAktif; 

    // ==========================================
    // 2. DATA MINING FOR FORECASTING
    // ==========================================
    let totalGrossSales = 0, totalHPP = 0, totalFees = 0, totalOpex = 0, totalWasteCost = 0;
    let trueNetProfit = 0, todayNetProfit = 0;
    
    // Trend Variables
    let salesLast7Days = 0, salesPrev7Days = 0;
    let ayamUsed30d = 0, dimsumSold30d = 0, waste30d = 0;
    let ayamGudangQty = 0, frozenPusatQty = 0;
    
    const channelPerf = {}; const branchPerf = {};

    (orders || []).forEach(o => {
        const dateObj = getLocalYMD(o.date);
        const gross = Number(o.total) || 0;
        const fee = Number(o.fee_amount) || 0;
        const hpp = Number(o.hpp_total) || 0;
        const netProf = Number(o.net_profit) || (gross - hpp - fee);

        // Trend Tracking
        if (dateObj >= sevenDaysAgoStr && dateObj <= todayStr) salesLast7Days += gross;
        else if (dateObj >= new Date(sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7)).toISOString().split('T')[0] && dateObj < sevenDaysAgoStr) salesPrev7Days += gross;

        if (isPeriod(dateObj)) {
            totalGrossSales += gross; totalHPP += hpp; totalFees += fee; trueNetProfit += netProf;
            if (dateObj === todayStr) todayNetProfit += netProf;

            const ch = String(o.source || 'OFFLINE').toUpperCase();
            if(!channelPerf[ch]) channelPerf[ch] = { gross: 0, fee: 0, netProfit: 0, count: 0 };
            channelPerf[ch].gross += gross; channelPerf[ch].fee += fee; channelPerf[ch].netProfit += netProf; channelPerf[ch].count += 1;

            const br = String(o.branch_id || 'PUSAT').toUpperCase();
            if(!branchPerf[br]) branchPerf[br] = { omzet: 0, hpp: 0, fee: 0, expense: 0, waste: 0, netProfit: 0 };
            branchPerf[br].omzet += gross; branchPerf[br].hpp += hpp; branchPerf[br].fee += fee; branchPerf[br].netProfit += netProf;
        }
    });

    (expenses || []).filter(e => isPeriod(e?.date)).forEach(e => {
        const br = String(e.branch_id || 'PUSAT').toUpperCase();
        const amt = Number(e.total) || 0;
        if (e.type === 'OUT') {
            totalOpex += amt; trueNetProfit -= amt;
            if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, waste: 0, netProfit:0 };
            branchPerf[br].expense += amt; branchPerf[br].netProfit -= amt;
        }
    });

    (discrepancyLogs || []).forEach(d => {
        const dateObj = getLocalYMD(d.date);
        const loss = Number(d.financial_loss) || 0;
        if (dateObj >= thirtyDaysAgoStr && dateObj <= todayStr) waste30d += loss;
        if (isPeriod(dateObj)) {
            totalWasteCost += loss; trueNetProfit -= loss;
            const br = String(d.branch_id || 'PUSAT').toUpperCase();
            if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, waste: 0, netProfit:0 };
            branchPerf[br].waste += loss; branchPerf[br].netProfit -= loss;
        }
    });

    (stockMovements || []).forEach(m => {
        const qty = Number(m.qty) || 0;
        const dateObj = getLocalYMD(m.date);
        
        if (m.item_name === 'AYAM') { if(m.to_location === 'GUDANG') ayamGudangQty += qty; if(m.from_location === 'GUDANG') ayamGudangQty -= qty; }
        if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
            if(m.to_location === 'FREEZER_PUSAT') frozenPusatQty += qty; if(m.from_location === 'FREEZER_PUSAT') frozenPusatQty -= qty;
        }
        if (dateObj >= thirtyDaysAgoStr && dateObj <= todayStr) {
            if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30d += qty;
            if ((m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') && m.movement_type === 'SALE') dimsumSold30d += qty;
        }
    });

    // ==========================================
    // 3. PREDICTIVE BUSINESS ENGINE (FORECASTING)
    // ==========================================
    
    // A. Chicken Demand Planner
    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1); 
    const targetAyam7Days = Math.ceil(avgAyamPerDay * 7);
    const ayamDeficit7Days = Math.max(0, targetAyam7Days - ayamGudangQty);
    const estimatedCostAyam7Days = ayamDeficit7Days * avgAyamCost;

    // B. Cashflow Runway Prediction
    const avgDailyOpex = Math.max((totalOpex / 30), 50000); // Estimasi kasar biaya harian
    const usableCash = cashReadyTotal - hutangAyamAktif; // Uang yang benar2 bebas
    const cashRunwayDays = usableCash > 0 ? (usableCash / avgDailyOpex) : 0;

    // C. Sales Trend
    const salesGrowth = salesPrev7Days > 0 ? (((salesLast7Days - salesPrev7Days) / salesPrev7Days) * 100) : 0;

    const forecast = {
        ayamDays: Math.max(0, ayamGudangQty / avgAyamPerDay).toFixed(1),
        ayamAvg: avgAyamPerDay.toFixed(1),
        targetAyam7Days, ayamDeficit7Days, estimatedCostAyam7Days,
        dimsumDays: Math.max(0, frozenPusatQty / Math.max((dimsumSold30d / 30), 1)).toFixed(0),
        cashRunwayDays: cashRunwayDays.toFixed(0),
        salesGrowth: salesGrowth.toFixed(1)
    };

    // ==========================================
    // 4. EXECUTIVE AI INSIGHT ENGINE
    // ==========================================
    const aiInsights = [];
    
    // Insight 1: Cashflow & Demand Survival
    if (usableCash < estimatedCostAyam7Days) {
        aiInsights.push({ type: 'CRITICAL', icon: '🚨', text: `CASHFLOW DANGER: Anda butuh Rp ${formatRp(estimatedCostAyam7Days)} untuk beli ayam 7 hari ke depan, tapi Cash Bebas Anda hanya Rp ${formatRp(usableCash)}. Segera cairkan dana Marketplace!` });
    } else {
        aiInsights.push({ type: 'GOOD', icon: '✅', text: `CASHFLOW SAFE: Cash Anda cukup aman untuk menopang pembelian ayam senilai Rp ${formatRp(estimatedCostAyam7Days)} untuk operasional 7 hari ke depan.` });
    }

    // Insight 2: Sales Trend
    if (salesGrowth > 5) {
        aiInsights.push({ type: 'GOOD', icon: '📈', text: `SALES SURGE: Trend penjualan 7 hari terakhir NAIK ${salesGrowth.toFixed(1)}%. Pastikan Freezer Pusat memiliki buffer stock yang cukup untuk akhir pekan.` });
    } else if (salesGrowth < -5) {
        aiInsights.push({ type: 'WARNING', icon: '📉', text: `SALES DROP: Penjualan 7 hari terakhir TURUN ${Math.abs(salesGrowth).toFixed(1)}%. Lakukan review pada promo di Marketplace (GoFood/Shopee) hari ini.` });
    }

    // Insight 3: Marketplace Analytics (Mencari Biang Kerok Margin)
    const channelArr = Object.keys(channelPerf).map(k => ({ channel: k, ...channelPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);
    const worstMarginChannel = channelArr.length > 0 ? channelArr.sort((a,b) => (a.netProfit/a.gross) - (b.netProfit/b.gross))[0] : null;
    if (worstMarginChannel && (worstMarginChannel.fee / worstMarginChannel.gross) > 0.25) {
        aiInsights.push({ type: 'WARNING', icon: '⚠️', text: `MARGIN LEAK: ${worstMarginChannel.channel} menyedot fee terlalu besar (${((worstMarginChannel.fee/worstMarginChannel.gross)*100).toFixed(1)}%). Pertimbangkan menaikkan harga jual di platform tersebut.` });
    }

    // Insight 4: Waste Prediction
    if (waste30d > 2000000) {
        aiInsights.push({ type: 'CRITICAL', icon: '🗑️', text: `WASTE LEAKAGE: Total kerugian barang rusak/hilang 30 hari terakhir mencapai Rp ${formatRp(waste30d)}. Lakukan audit ketat pada proses Distribusi (SOP Packing)!` });
    }

    const branchArr = Object.keys(branchPerf).map(k => ({ branch_id: k, ...branchPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);

    return { 
        trueNetProfit, totalGrossSales, channelArr, branchArr,
        cashReadyTotal, pendingMarketplace, hutangAyamAktif, cashflowHealth, totalAssetInventory,
        forecast, aiInsights, alerts: [], automationTasks: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, discrepancyLogs, financialClosings, masterBranches, dateFrom, dateTo]);
}
