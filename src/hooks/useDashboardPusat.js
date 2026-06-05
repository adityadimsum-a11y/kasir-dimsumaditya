import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, discrepancyLogs, financialClosings, masterBranches, systemTasks, dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    
    // ... [Kalkulasi aset, cashflow, net profit SAMA PERSIS SEPERTI FASE 10] ...
    let inCash = 0, outCash = 0, pendingMarketplace = 0, hutangAyamAktif = 0, totalAssetInventory = 0;
    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING') pendingMarketplace += (Number(m.net) || 0); });
    (supplierLedger || []).forEach(l => { const amt = Number(l.amount) || 0; if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; });
    (cashflowTransactions || []).forEach(c => { if(c.type === 'CASH_IN') inCash += Number(c.amount); if(c.type === 'CASH_OUT') outCash += Number(c.amount); });
    (orders || []).forEach(o => { if(o.source==='OFFLINE' && String(o.paymentMethod).toUpperCase().includes('CASH')) inCash += Number(o.paidAmount); });
    (expenses || []).forEach(e => { if(e.type==='OUT') outCash += Number(e.total); });

    const cashReadyTotal = inCash - outCash;

    // PREDIKSI & DATA MINING
    let ayamGudangQty = 0, frozenPusatQty = 0, ayamUsed30d = 0, dimsumSold30d = 0;
    const branchStocks = {}; 

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

        const dateObj = getLocalYMD(m.date);
        const thirtyAgo = new Date(); thirtyAgo.setDate(new Date().getDate() - 30);
        if (dateObj >= thirtyAgo.toISOString().split('T')[0] && dateObj <= todayStr) {
            if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30d += qty;
            if ((m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') && m.movement_type === 'SALE') { dimsumSold30d += qty; branchStocks[brId].sold30d += qty; }
        }
    });

    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1); 
    const avgDimsumPerDay = Math.max((dimsumSold30d / 30), 1);
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);
    const cashDeficit = cashReadyTotal - hutangAyamAktif;

    // ==========================================
    // TASK QUEUE & SMART PRIORITY ENGINE
    // ==========================================
    const operationTasks = [];
    
    // Cek daftar task yang sudah dieksekusi agar tidak dobel
    const executedTaskIds = (systemTasks || []).map(t => t.id);

    // 1. OPERATION: CHICKEN PURCHASE
    if (ayamDaysRemaining <= 4) {
        const taskId = 'TASK-PURCHASE-' + todayStr;
        if (!executedTaskIds.includes(taskId)) {
            const targetAyam = Math.ceil(avgAyamPerDay * 7) - ayamGudangQty;
            const estCost = targetAyam * 38000;
            const priority = ayamDaysRemaining <= 2 ? 'CRITICAL' : 'HIGH';
            
            operationTasks.push({ 
                id: taskId, type: 'PURCHASE', priority,
                title: `Auto-Procurement: Beli ${targetAyam} KG Ayam`, 
                desc: `Sisa ayam untuk ${ayamDaysRemaining.toFixed(1)} hari. Estimasi biaya: Rp ${formatRp(estCost)}.`, 
                actionLabel: estCost > 20000000 ? 'Minta Approval Owner' : 'Eksekusi Pembelian',
                payload: { qty: targetAyam, estimated_cost: estCost }
            });
        }
    }

    // 2. OPERATION: DISTRIBUTION TO BRANCHES
    (masterBranches || []).forEach(br => {
        if (br.branch_id === 'PUSAT') return;
        const brData = branchStocks[br.branch_id];
        if (brData) {
            const avgSoldBr = Math.max(brData.sold30d / 30, 1);
            const brDaysRemain = brData.frozen / avgSoldBr;
            if (brDaysRemain <= 3) {
                const taskId = `TASK-DO-${br.branch_id}-${todayStr}`;
                if (!executedTaskIds.includes(taskId)) {
                    const targetKirim = Math.ceil(avgSoldBr * 10) - brData.frozen;
                    operationTasks.push({ 
                        id: taskId, type: 'DISTRIBUTION', priority: brDaysRemain <= 1 ? 'CRITICAL' : 'HIGH',
                        title: `Auto-Distribution: Restock ${br.branch_name}`, 
                        desc: `Stok menipis (${brDaysRemain.toFixed(0)} hari). Sistem menyarankan kirim ${targetKirim} Pcs.`, 
                        actionLabel: 'Buat & Reserve DO',
                        payload: { branch_id: br.branch_id, qty: targetKirim }
                    });
                }
            }
        }
    });

    // Urutkan Task berdasarkan Prioritas
    const priorityWeight = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
    operationTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return { 
        cashReadyTotal, pendingMarketplace, hutangAyamAktif, 
        ayamDaysRemaining, ayamGudangQty, avgAyamPerDay, cashDeficit,
        operationTasks, 
        alerts: [], branchArr: [] // Placeholder
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, discrepancyLogs, financialClosings, masterBranches, systemTasks, dateFrom, dateTo]);
}
