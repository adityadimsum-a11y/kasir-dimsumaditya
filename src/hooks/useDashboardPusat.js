import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // Helper untuk 30 hari ke belakang (Data Latih Forecast)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const periodOrders = (orders || []).filter(o => isPeriod(o?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));

    // ==========================================
    // 1. PROFITABILITY & SALES ENGINE
    // ==========================================
    let netProfitTotal = 0, todayNetProfit = 0, totalGrossSales = 0;
    const channelPerf = {};
    const branchPerf = {};

    periodOrders.forEach(o => {
        const gross = Number(o.total) || 0;
        const fee = Number(o.fee_amount) || 0;
        const hpp = Number(o.hpp_total) || 0;
        const netProf = Number(o.net_profit) || (gross - hpp);

        totalGrossSales += gross;
        netProfitTotal += netProf;
        if (getLocalYMD(o.date) === todayStr) todayNetProfit += netProf;

        const ch = String(o.source || 'OFFLINE').toUpperCase();
        if(!channelPerf[ch]) channelPerf[ch] = { gross: 0, fee: 0, netProfit: 0, count: 0 };
        channelPerf[ch].gross += gross; channelPerf[ch].fee += fee; channelPerf[ch].netProfit += netProf; channelPerf[ch].count += 1;

        const br = String(o.branch_id || 'PUSAT').toUpperCase();
        if(!branchPerf[br]) branchPerf[br] = { omzet: 0, hpp: 0, fee: 0, expense: 0, netProfit: 0 };
        branchPerf[br].omzet += gross; branchPerf[br].hpp += hpp; branchPerf[br].fee += fee; branchPerf[br].netProfit += netProf;
    });

    periodExpenses.forEach(e => {
        const br = String(e.branch_id || 'PUSAT').toUpperCase();
        const amt = Number(e.total) || 0;
        if (e.type === 'OUT') {
            if(!branchPerf[br]) branchPerf[br] = { omzet:0, hpp:0, fee:0, expense:0, netProfit:0 };
            branchPerf[br].expense += amt; branchPerf[br].netProfit -= amt;
        }
    });

    const channelArr = Object.keys(channelPerf).map(k => ({ channel: k, ...channelPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);
    const branchArr = Object.keys(branchPerf).map(k => ({ branch_id: k, ...branchPerf[k] })).sort((a,b) => b.netProfit - a.netProfit);

    // ==========================================
    // 2. INVENTORY VALUATION & FINANCE
    // ==========================================
    let assetAyam = 0; let assetDimsum = 0;
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0 && layer.status === 'ACTIVE') {
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

    // Kalkulasi Cashflow Manual (Legacy support)
    periodOrders.forEach(o => {
        if (o.source !== 'OFFLINE' && o.settlement_status === 'PENDING') return; 
        const amt = Number(o.paidAmount) || 0;
        if (String(o.paymentMethod).toLowerCase().includes('cash')) inCash += amt; else inBank += amt;
    });
    periodPurchases.forEach(p => {
        const amt = Number(p.paidAmount) || 0;
        if (String(p.paymentMethod).toLowerCase().includes('cash')) outCash += amt; else outBank += amt;
    });
    periodExpenses.forEach(e => {
        const amt = Number(e.total) || 0;
        const isCash = String(e.paymentMethod).toLowerCase().includes('cash');
        if (e.type === 'IN') { if(isCash) inCash+=amt; else inBank+=amt; } else { if(isCash) outCash+=amt; else outBank+=amt; }
    });

    const cashReadyTotal = (inCash - outCash) + (inBank - outBank);

    // ==========================================
    // 3. FORECAST & DECISION ENGINE (NEW!)
    // ==========================================
    let ayamGudangQty = 0; let frozenDimsumQty = 0;
    let ayamUsed30d = 0; let dimsumSold30d = 0;

    (stockMovements || []).forEach(m => {
        const qty = Number(m.qty) || 0;
        const dateStr = getLocalYMD(m.date);

        // Realtime Balance
        if (m.item_name === 'AYAM') {
            if (m.to_location === 'GUDANG') ayamGudangQty += qty;
            if (m.from_location === 'GUDANG') ayamGudangQty -= qty;
        }
        if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
            if (m.to_location.includes('FREEZER')) frozenDimsumQty += qty;
            if (m.from_location.includes('FREEZER')) frozenDimsumQty -= qty;
        }

        // Training Data: 30 Hari Terakhir
        if (dateStr >= thirtyDaysAgoStr && dateStr <= todayStr) {
            if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30d += qty;
            if ((m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') && m.movement_type === 'SALE') dimsumSold30d += qty;
        }
    });

    // Algoritma Prediksi (Moving Average 30 Hari)
    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1); // Minimal 1kg/hari untuk hindari infinity
    const avgDimsumPerDay = Math.max((dimsumSold30d / 30), 1);
    
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);
    const dimsumDaysRemaining = Math.max(0, frozenDimsumQty / avgDimsumPerDay);

    const forecast = {
        ayamDays: ayamDaysRemaining.toFixed(1),
        ayamAvg: avgAyamPerDay.toFixed(1),
        dimsumDays: dimsumDaysRemaining.toFixed(0),
        dimsumAvg: avgDimsumPerDay.toFixed(0),
        cashDeficit: cashReadyTotal - hutangAyamAktif
    };

    // ==========================================
    // 4. SMART EXECUTIVE ALERTS
    // ==========================================
    const alerts = [];
    
    // CASHFLOW ALERT
    if (forecast.cashDeficit < 0) {
        if ((forecast.cashDeficit + pendingCash) >= 0) {
            alerts.push({ id: 'a-cash-warn', type: 'warning', title: '⚠️ CASH TIGHT (TERTOLONG MARKETPLACE)', desc: `Kas Tunai/Bank minus Rp ${formatRp(Math.abs(forecast.cashDeficit))} untuk bayar ayam. SEGERA cairkan dana Marketplace (Rp ${formatRp(pendingCash)}) untuk bayar hutang!` });
        } else {
            alerts.push({ id: 'a-cash-danger', type: 'danger', title: '🚨 SEVERE CASHFLOW DEFICIT', desc: `BAHAYA! Walaupun uang Marketplace dicairkan semua, kita masih KURANG Rp ${formatRp(Math.abs(forecast.cashDeficit + pendingCash))} untuk melunasi Hutang Ayam!` });
        }
    }

    // AYAM FORECAST ALERT
    if (ayamDaysRemaining <= 3 && ayamDaysRemaining > 0) {
        alerts.push({ id: 'a-ayam', type: 'danger', title: '🚨 STOK AYAM KRITIS', desc: `Rata-rata pemakaian ${forecast.ayamAvg} kg/hari. Stok di gudang diprediksi HABIS DALAM ${forecast.ayamDays} HARI. Segera restock!` });
    }

    // FREEZER HEALTH ALERT
    if (dimsumDaysRemaining > 20) {
        alerts.push({ id: 'a-freezer', type: 'warning', title: '🧊 FREEZER OVERSTOCK (MODAL TIDUR)', desc: `Rata-rata penjualan ${forecast.dimsumAvg} pcs/hari. Freezer diprediksi baru habis ${forecast.dimsumDays} hari lagi. Tahan Produksi! Fokus genjot promosi/distribusi!` });
    }

    return { 
        netProfitTotal, todayNetProfit, totalGrossSales, channelArr, branchArr,
        cashReadyTotal, pendingCash, hutangAyamAktif, totalAssetInventory,
        forecast, alerts, feed: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, dateFrom, dateTo]);
}
