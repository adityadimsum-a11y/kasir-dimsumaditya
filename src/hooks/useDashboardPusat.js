import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, safeSort, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  stockMovements, supplierLedger, cashflowTransactions, marketplaceSettlement,
  dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const periodOrders = (orders || []).filter(o => o?.category !== 'Pemalang' && isPeriod(o?.date));
    const periodPurchases = (purchases || []).filter(p => isPeriod(p?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));
    
    // ==========================================
    // 1. FINANCE CORE ENGINE
    // ==========================================
    
    // A. CASH READY (Uang Riil di Tangan)
    let inCash = 0, outCash = 0, inBank = 0, outBank = 0;
    
    // B. PENDING SETTLEMENT (Uang Nyangkut di Marketplace)
    let pendingCash = 0;
    (marketplaceSettlement || []).forEach(m => {
        if (m.status === 'PENDING') pendingCash += (Number(m.net) || 0);
    });

    // C. SUPPLIER LEDGER (Hutang Ayam & Bahan)
    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
        const amt = Number(l.amount) || 0;
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; // Tambah hutang
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; // Kurangi hutang
    });

    // Kalkulasi Cash Ready & Bank via Legacy & New Cashflow
    periodOrders.forEach(o => {
        if (o.source && o.source !== 'OFFLINE' && o.settlement_status === 'PENDING') {
            // Abaikan dari Cash Ready jika uangnya masih di Marketplace
            return; 
        }
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
        if (e.type === 'IN') { if(isCash) inCash += amt; else inBank += amt; }
        else { if(isCash) outCash += amt; else outBank += amt; }
    });

    (pemalangReports || []).forEach(r => {
        if (isPeriod(r.date)) inBank += (Number(r.nominal) || 0);
    });

    const cashReadyTotal = (inCash - outCash) + (inBank - outBank);

    // ==========================================
    // 2. PIUTANG & FEED ENGINE
    // ==========================================
    let totalOmset = 0;
    const piutangBerjalan = [];
    
    periodOrders.forEach(o => {
        totalOmset += Number(o.total) || 0;
        const sisa = (Number(o.total) || 0) - (Number(o.paidAmount) || 0);
        if (sisa > 0 && o.statusProduksi === 'Sudah Diambil') piutangBerjalan.push({ ...o, sisaTagihan: sisa });
    });

    const alerts = [];
    if (hutangAyamAktif > cashReadyTotal) {
        alerts.push({ id: 'danger-cash', type: 'danger', title: 'WARNING: CASHFLOW DEFICIT', desc: `Kas tunai + Bank (Rp ${formatRp(cashReadyTotal)}) tidak cukup untuk melunasi total Hutang Ayam (Rp ${formatRp(hutangAyamAktif)}).` });
    }

    return { 
        // Finance Focus
        cashReadyTotal, inCash, outCash, inBank, outBank,
        pendingCash, hutangAyamAktif, 
        
        // General
        totalOmset, piutangBerjalan, alerts, feed: []
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, dateFrom, dateTo]);
}
