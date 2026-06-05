import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, masterBranches, dateFrom, dateTo 
}) {
  return useMemo(() => {
    // ... (KODE KALKULASI SALES, BRANCH P&L, KPI, INVENTORY, CASHFLOW SAMA SEPERTI FASE 7) ...
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // ==========================================
    // PROFITABILITY, KPI, FINANCE (MINIFIED FOR HOOK)
    // ==========================================
    let netProfitTotal = 0, todayNetProfit = 0, totalGrossSales = 0;
    let ayamGudangQty = 0, frozenPusatQty = 0, ayamUsed30d = 0, dimsumSold30d = 0;
    let inCash = 0, outCash = 0, inBank = 0, outBank = 0, pendingCash = 0, hutangAyamAktif = 0, totalAssetInventory = 0;
    const channelPerf = {}, branchPerf = {}, branchStocks = {};

    (orders || []).filter(o => isPeriod(o?.date)).forEach(o => {
        const netProf = Number(o.net_profit) || (Number(o.total) - Number(o.hpp_total));
        todayNetProfit += (getLocalYMD(o.date) === todayStr) ? netProf : 0;
        // ... (Kalkulasi lain)
    });

    (stockMovements || []).forEach(m => {
        const qty = Number(m.qty) || 0;
        const brId = m.branch_id;
        if(!branchStocks[brId]) branchStocks[brId] = { frozen: 0, sold30d: 0 };

        if (m.item_name === 'AYAM') { if(m.to_location === 'GUDANG') ayamGudangQty += qty; if(m.from_location === 'GUDANG') ayamGudangQty -= qty; }
        if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
            if(m.to_location === 'FREEZER_PUSAT') frozenPusatQty += qty; if(m.from_location === 'FREEZER_PUSAT') frozenPusatQty -= qty;
            if(m.to_location.includes('FREEZER') && brId !== 'PUSAT') branchStocks[brId].frozen += qty;
            if(m.from_location.includes('FREEZER') && brId !== 'PUSAT') branchStocks[brId].frozen -= qty;
        }

        if (getLocalYMD(m.date) >= thirtyDaysAgoStr && getLocalYMD(m.date) <= todayStr) {
            if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30d += qty;
            if ((m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') && m.movement_type === 'SALE') { dimsumSold30d += qty; branchStocks[brId].sold30d += qty; }
        }
    });

    (supplierLedger || []).forEach(l => { if (l.transaction_type === 'PURCHASE') hutangAyamAktif += Number(l.amount); if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= Number(l.amount); });

    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1); 
    const avgDimsumPerDay = Math.max((dimsumSold30d / 30), 1);
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);
    const dimsumDaysRemaining = Math.max(0, frozenPusatQty / avgDimsumPerDay);
    const cashReadyTotal = (inCash - outCash) + (inBank - outBank); // Estimasi kas (simplified)
    const cashDeficit = cashReadyTotal - hutangAyamAktif;

    const forecast = { ayamDays: ayamDaysRemaining.toFixed(1), ayamAvg: avgAyamPerDay.toFixed(1), dimsumDays: dimsumDaysRemaining.toFixed(0), dimsumAvg: avgDimsumPerDay.toFixed(0), cashDeficit };

    // ==========================================
    // 3. GENERATE AUTO-PILOT TASKS (THE EXECUTION PAYLOAD)
    // ==========================================
    const automationTasks = [];

    // TUGAS 1: AUTO PURCHASE (Beri Payload untuk dieksekusi Backend)
    if (ayamDaysRemaining <= 4) {
        const targetAyam = Math.ceil(avgAyamPerDay * 7) - ayamGudangQty;
        if (targetAyam > 0) {
            automationTasks.push({ 
                id: 'task-purchase', type: 'PURCHASE', title: 'Draft Purchase: Beli Ayam', 
                desc: `Rekomendasi pembelian: ${targetAyam} KG (Target stok aman 7 hari).`, 
                actionLabel: 'Eksekusi Draft Pembelian',
                payload: { qty: targetAyam } // <--- THE SECRET SAUCE
            });
        }
    }

    // TUGAS 2: AUTO DISTRIBUTION 
    (masterBranches || []).forEach(br => {
        if (br.branch_id === 'PUSAT') return;
        const brData = branchStocks[br.branch_id];
        if (brData) {
            const avgSoldBr = Math.max(brData.sold30d / 30, 1);
            const brDaysRemain = brData.frozen / avgSoldBr;
            if (brDaysRemain <= 3) {
                const targetKirim = Math.ceil(avgSoldBr * 10) - brData.frozen;
                if (targetKirim > 0) {
                    automationTasks.push({ 
                        id: `task-do-${br.branch_id}`, type: 'DISTRIBUTION', title: `Draft DO: Kirim ke ${br.branch_name}`, 
                        desc: `Sisa stok ${brDaysRemain.toFixed(0)} hari. Rekomendasi kirim: ${targetKirim} Pcs.`, 
                        actionLabel: 'Buat & Kirim DO Sekarang',
                        payload: { branch_id: br.branch_id, qty: targetKirim } // <--- THE SECRET SAUCE
                    });
                }
            }
        }
    });

    const alerts = []; // Smart alerts...

    return { 
        todayNetProfit, totalGrossSales, channelArr: [], branchArr: [], kpiEngine: {},
        cashReadyTotal, pendingCash, hutangAyamAktif, totalAssetInventory,
        forecast, alerts, automationTasks
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, masterBranches, dateFrom, dateTo]);
}
