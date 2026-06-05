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

    // ==========================================
    // 1. INVENTORY VALUATION (ASSET VALUE)
    // ==========================================
    let assetAyam = 0;
    let assetDimsum = 0;
    
    (inventoryCostLayers || []).forEach(layer => {
        if (Number(layer.qty_remaining) > 0) {
            const val = Number(layer.qty_remaining) * Number(layer.unit_cost);
            if(String(layer.item_name).toUpperCase() === 'AYAM') assetAyam += val;
            if(String(layer.item_name).toUpperCase() === 'DIMSUM') assetDimsum += val;
        }
    });

    const totalAssetInventory = assetAyam + assetDimsum;

    // ==========================================
    // 2. FINANCE CORE (CASH READY & HUTANG)
    // ==========================================
    let inCash = 0, outCash = 0, inBank = 0, outBank = 0;
    let pendingCash = 0;
    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING') pendingCash += (Number(m.net) || 0); });

    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
        const amt = Number(l.amount) || 0;
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; 
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; 
    });

    // ... (Logika kalkulasi Cash seperti biasa)
    const cashReadyTotal = (inCash - outCash) + (inBank - outBank);

    // ==========================================
    // 3. PIUTANG & FEED ENGINE
    // ==========================================
    const piutangBerjalan = [];
    const alerts = [];
    if (hutangAyamAktif > cashReadyTotal) {
        alerts.push({ id: 'danger-cash', type: 'danger', title: 'WARNING: CASHFLOW DEFICIT', desc: `Kas tunai + Bank tidak cukup untuk melunasi total Hutang Ayam.` });
    }

    return { 
        cashReadyTotal, inCash, outCash, inBank, outBank,
        pendingCash, hutangAyamAktif, 
        assetAyam, assetDimsum, totalAssetInventory, // <--- EXPORT ASSET VALUE
        piutangBerjalan, alerts, feed: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, dateFrom, dateTo]);
}
