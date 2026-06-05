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

    // ==========================================
    // 1. INVENTORY VALUATION ENGINE (ASSETS)
    // ==========================================
    let assetAyam = 0; let assetDimsum = 0;
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0 && layer.status.includes('ACTIVE')) {
            const val = Number(layer.qty_remaining) * Number(layer.unit_cost);
            if(String(layer.item_name).toUpperCase() === 'AYAM') assetAyam += val;
            if(String(layer.item_name).toUpperCase() === 'DIMSUM') assetDimsum += val;
        }
    });
    const totalAssetInventory = assetAyam + assetDimsum;

    // ==========================================
    // 2. CASHFLOW & OBLIGATION ENGINE (CASH & LIABILITIES)
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

    // Fallback Legacy
    (orders || []).forEach(o => { if(o.source==='OFFLINE' && String(o.paymentMethod).toUpperCase().includes('CASH')) inCash += Number(o.paidAmount); });
    (expenses || []).forEach(e => { if(e.type==='OUT') outCash += Number(e.total); });

    const cashReadyTotal = inCash - outCash;

    // ==========================================
    // 3. BALANCE SHEET & FINANCIAL HEALTH SCORE
    // ==========================================
    const totalAssets = cashReadyTotal + pendingMarketplace + totalAssetInventory;
    const totalLiabilities = hutangAyamAktif; // Bisa ditambah hutang operasional dll nanti
    const totalEquity = totalAssets - totalLiabilities;

    // Current Ratio (Assets / Liabilities) - Di atas 1.5 itu sangat sehat, di bawah 1 itu bangkrut
    const liquidityRatio = totalLiabilities === 0 ? 9.9 : (totalAssets / totalLiabilities);
    
    let healthScore = 100;
    let healthStatus = 'EXCELLENT';
    if (liquidityRatio < 1.0) { healthScore = 30; healthStatus = 'DANGER (Deficit)'; }
    else if (liquidityRatio < 1.5) { healthScore = 65; healthStatus = 'WARNING (Tight Cash)'; }
    else if (liquidityRatio >= 1.5 && liquidityRatio <= 2.5) { healthScore = 90; healthStatus = 'HEALTHY'; }

    // ==========================================
    // 4. CLOSING STATUS CHECK
    // ==========================================
    const todayClosing = (financialClosings || []).find(c => c.date === todayStr);
    const isTodayClosed = !!todayClosing;

    // Hitung Net Profit Today untuk dikirim ke payload Closing
    let todayNetProfit = 0;
    (orders || []).filter(o => getLocalYMD(o.date) === todayStr).forEach(o => {
        todayNetProfit += (Number(o.net_profit) || (Number(o.total) - Number(o.hpp_total) - Number(o.fee_amount)));
    });

    const closingPayload = {
        date: todayStr, cash_ready: cashReadyTotal, inventory_value: totalAssetInventory,
        hutang_aktif: hutangAyamAktif, net_profit_today: todayNetProfit
    };

    return { 
        // Balance Sheet
        totalAssets, totalLiabilities, totalEquity,
        cashReadyTotal, pendingMarketplace, totalAssetInventory, hutangAyamAktif,
        
        // Health
        healthScore, healthStatus, liquidityRatio,

        // Closing
        isTodayClosed, closingPayload, todayNetProfit,
        
        alerts: [], automationTasks: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, discrepancyLogs, financialClosings, masterBranches, dateFrom, dateTo]);
}
