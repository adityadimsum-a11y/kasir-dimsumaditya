import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const periodOrders = (orders || []).filter(o => isPeriod(o?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));

    // ==========================================
    // 1. PROFITABILITY & SALES ENGINE
    // ==========================================
    let netProfitTotal = 0;
    let todayNetProfit = 0;
    let totalGrossSales = 0;
    
    // Performa Channel / Marketplace
    const channelPerf = {};
    // Performa Cabang P&L
    const branchPerf = {};

    periodOrders.forEach(o => {
        // Ambil hasil Auto Costing dari Backend
        const gross = Number(o.total) || 0;
        const fee = Number(o.fee_amount) || 0;
        const hpp = Number(o.hpp_total) || 0;
        const netProf = Number(o.net_profit) || (gross - hpp); // Fallback jika belum kena Auto Costing

        totalGrossSales += gross;
        netProfitTotal += netProf;
        if (getLocalYMD(o.date) === todayStr) todayNetProfit += netProf;

        // Channel Aggregation
        const ch = String(o.source || 'OFFLINE').toUpperCase();
        if(!channelPerf[ch]) channelPerf[ch] = { gross: 0, fee: 0, netProfit: 0, count: 0 };
        channelPerf[ch].gross += gross;
        channelPerf[ch].fee += fee;
        channelPerf[ch].netProfit += netProf;
        channelPerf[ch].count += 1;

        // Branch Aggregation
        const br = String(o.branch_id || 'PUSAT').toUpperCase();
        if(!branchPerf[br]) branchPerf[br] = { omzet: 0, hpp: 0, fee: 0, expense: 0, netProfit: 0 };
        branchPerf[br].omzet += gross;
        branchPerf[br].hpp += hpp;
        branchPerf[br].fee += fee;
        branchPerf[br].netProfit += netProf;
    });

    // Masukkan Expense ke P&L Cabang
    periodExpenses.forEach(e => {
        const br = String(e.branch_id || 'PUSAT').toUpperCase();
        const amt = Number(e.total) || 0;
        if (e.type === 'OUT') {
            if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, netProfit:0 };
            branchPerf[br].expense += amt;
            branchPerf[br].netProfit -= amt; // Kurangi profit karena biaya operasional
        }
    });

    const channelArr = Object.keys(channelPerf).map(k => ({ channel: k, ...channelPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);
    const branchArr = Object.keys(branchPerf).map(k => ({ branch_id: k, ...branchPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);

    // ==========================================
    // 2. INVENTORY VALUATION & FINANCE
    // ==========================================
    let assetAyam = 0; let assetDimsum = 0;
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0) {
            const val = Number(layer.qty_remaining) * Number(layer.unit_cost);
            if(String(layer.item_name).toUpperCase() === 'AYAM') assetAyam += val;
            if(String(layer.item_name).toUpperCase() === 'DIMSUM') assetDimsum += val;
        }
    });
    const totalAssetInventory = assetAyam + assetDimsum;

    let inCash = 0, outCash = 0, inBank = 0, outBank = 0, pendingCash = 0, hutangAyamAktif = 0;
    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING') pendingCash += (Number(m.net) || 0); });
    (supplierLedger || []).forEach(l => {
        const amt = Number(l.amount) || 0;
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; 
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; 
    });

    // ... (Logika Cash Riil seperti biasa)
    const cashReadyTotal = (inCash - outCash) + (inBank - outBank);

    // ==========================================
    // 3. SMART ALERTS ENGINE
    // ==========================================
    const alerts = [];
    if (hutangAyamAktif > cashReadyTotal) alerts.push({ id: 'danger-cash', type: 'danger', title: 'WARNING: CASHFLOW DEFICIT', desc: `Kas tunai tidak cukup untuk melunasi Hutang Ayam (Kurang Rp ${formatRp(hutangAyamAktif - cashReadyTotal)}).` });
    if (assetAyam < 500000) alerts.push({ id: 'warn-ayam', type: 'warning', title: 'STOK AYAM MENIPIS', desc: `Nilai valuasi ayam gudang di bawah batas aman. Harap pertimbangkan restock.` });
    if (pendingCash > 5000000) alerts.push({ id: 'warn-marketplace', type: 'warning', title: 'PENDING SETTLEMENT TINGGI', desc: `Ada Rp ${formatRp(pendingCash)} dana tertahan di Marketplace. Segera lakukan penarikan.` });

    return { 
        netProfitTotal, todayNetProfit, totalGrossSales, channelArr, branchArr,
        cashReadyTotal, pendingCash, hutangAyamAktif, totalAssetInventory,
        alerts, feed: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, dateFrom, dateTo]);
}
