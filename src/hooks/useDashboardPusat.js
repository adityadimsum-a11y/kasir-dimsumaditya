import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, discrepancyLogs, masterBranches, dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // ==========================================
    // 1. INVENTORY VALUATION ENGINE
    // ==========================================
    let assetAyam = 0; let assetDimsum = 0;
    let costPerLayerAyam = [];
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0 && layer.status.includes('ACTIVE')) {
            const val = Number(layer.qty_remaining) * Number(layer.unit_cost);
            if(String(layer.item_name).toUpperCase() === 'AYAM') {
                assetAyam += val;
                costPerLayerAyam.push(Number(layer.unit_cost));
            }
            if(String(layer.item_name).toUpperCase() === 'DIMSUM') {
                assetDimsum += val;
            }
        }
    });
    const totalAssetInventory = assetAyam + assetDimsum;
    const avgAyamCost = costPerLayerAyam.length > 0 ? (costPerLayerAyam.reduce((a,b)=>a+b,0) / costPerLayerAyam.length) : 0;

    // ==========================================
    // 2. WASTE COSTING ENGINE
    // ==========================================
    let totalWasteCost = 0;
    (discrepancyLogs || []).filter(d => isPeriod(d?.date)).forEach(d => {
        totalWasteCost += (Number(d.financial_loss) || 0);
    });

    // ==========================================
    // 3. REAL NET PROFIT & P&L ENGINE
    // ==========================================
    let totalGrossSales = 0, totalHPP = 0, totalFees = 0, totalOpex = 0;
    let netProfitTotal = 0, todayNetProfit = 0;
    const branchPerf = {};

    // Penjualan & HPP
    (orders || []).filter(o => isPeriod(o?.date)).forEach(o => {
        const gross = Number(o.total) || 0;
        const fee = Number(o.fee_amount) || 0;
        const hpp = Number(o.hpp_total) || 0;
        const netProf = Number(o.net_profit) || (gross - hpp - fee);

        totalGrossSales += gross;
        totalHPP += hpp;
        totalFees += fee;
        netProfitTotal += netProf;
        if (getLocalYMD(o.date) === todayStr) todayNetProfit += netProf;

        const br = String(o.branch_id || 'PUSAT').toUpperCase();
        if(!branchPerf[br]) branchPerf[br] = { omzet: 0, hpp: 0, fee: 0, expense: 0, waste: 0, netProfit: 0 };
        branchPerf[br].omzet += gross; branchPerf[br].hpp += hpp; branchPerf[br].fee += fee; branchPerf[br].netProfit += netProf;
    });

    // Opex (Biaya Operasional)
    (expenses || []).filter(e => isPeriod(e?.date)).forEach(e => {
        const br = String(e.branch_id || 'PUSAT').toUpperCase();
        const amt = Number(e.total) || 0;
        if (e.type === 'OUT') {
            totalOpex += amt;
            if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, waste: 0, netProfit:0 };
            branchPerf[br].expense += amt; branchPerf[br].netProfit -= amt;
        }
    });

    // Alokasi Waste ke Cabang
    (discrepancyLogs || []).filter(d => isPeriod(d?.date)).forEach(d => {
        const br = String(d.branch_id || 'PUSAT').toUpperCase();
        const loss = Number(d.financial_loss) || 0;
        if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, waste: 0, netProfit:0 };
        branchPerf[br].waste += loss; branchPerf[br].netProfit -= loss;
    });

    // Final True Net Profit System-Wide
    const trueNetProfit = totalGrossSales - totalHPP - totalFees - totalOpex - totalWasteCost;

    // ==========================================
    // 4. CASHFLOW OBLIGATION ENGINE
    // ==========================================
    let inCash = 0, outCash = 0, pendingMarketplace = 0, hutangAyamAktif = 0;
    
    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING') pendingMarketplace += (Number(m.net) || 0); });
    
    (supplierLedger || []).forEach(l => {
        const amt = Number(l.amount) || 0;
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; 
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; 
    });

    (cashflowTransactions || []).forEach(c => {
        if(c.type === 'CASH_IN') inCash += Number(c.amount);
        if(c.type === 'CASH_OUT') outCash += Number(c.amount);
    });
    // Fallback: Orders yg cash & offline jika cashflow table blm penuh
    (orders || []).forEach(o => { if(o.source==='OFFLINE' && String(o.paymentMethod).toUpperCase().includes('CASH')) inCash += Number(o.paidAmount); });
    (expenses || []).forEach(e => { if(e.type==='OUT') outCash += Number(e.total); });

    const cashReadyTotal = inCash - outCash;
    const cashflowHealth = cashReadyTotal - hutangAyamAktif; // Surplus/Deficit

    const branchArr = Object.keys(branchPerf).map(k => ({ branch_id: k, ...branchPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);

    return { 
        trueNetProfit, totalGrossSales, totalHPP, totalFees, totalOpex, totalWasteCost,
        todayNetProfit, branchArr,
        cashReadyTotal, pendingMarketplace, hutangAyamAktif, cashflowHealth,
        assetAyam, assetDimsum, totalAssetInventory, avgAyamCost,
        alerts: [], automationTasks: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, discrepancyLogs, masterBranches, dateFrom, dateTo]);
}
