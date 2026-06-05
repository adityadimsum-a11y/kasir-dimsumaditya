import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, masterBranches, dateFrom, dateTo 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const periodOrders = (orders || []).filter(o => isPeriod(o?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));

    // ==========================================
    // 1. PROFITABILITY, KPI & SALES ENGINE
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

    // KPI ENGINE: Get Best Performers
    const kpiEngine = {
        bestChannel: channelArr.length > 0 ? channelArr[0] : null,
        bestBranch: branchArr.length > 0 ? branchArr[0] : null,
        worstMarginChannel: channelArr.length > 0 ? channelArr.sort((a,b) => (a.netProfit/a.gross) - (b.netProfit/b.gross))[0] : null
    };

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
    // 3. FORECAST & AUTOMATION TASK ENGINE
    // ==========================================
    let ayamGudangQty = 0; let frozenPusatQty = 0;
    let ayamUsed30d = 0; let dimsumSold30d = 0;
    
    // Per-Branch Stock Tracking untuk Auto-Distribution
    const branchStocks = {}; 

    (stockMovements || []).forEach(m => {
        const qty = Number(m.qty) || 0;
        const dateStr = getLocalYMD(m.date);
        const brId = m.branch_id;

        // Init branch stock counter
        if(!branchStocks[brId]) branchStocks[brId] = { frozen: 0, sold30d: 0 };

        // Global Realtime Balance
        if (m.item_name === 'AYAM') {
            if (m.to_location === 'GUDANG') ayamGudangQty += qty;
            if (m.from_location === 'GUDANG') ayamGudangQty -= qty;
        }
        if (m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') {
            if (m.to_location === 'FREEZER_PUSAT') frozenPusatQty += qty;
            if (m.from_location === 'FREEZER_PUSAT') frozenPusatQty -= qty;
            
            // Branch Stock
            if (m.to_location.includes('FREEZER') && brId !== 'PUSAT') branchStocks[brId].frozen += qty;
            if (m.from_location.includes('FREEZER') && brId !== 'PUSAT') branchStocks[brId].frozen -= qty;
        }

        // Training Data: 30 Hari Terakhir
        if (dateStr >= thirtyDaysAgoStr && dateStr <= todayStr) {
            if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE') ayamUsed30d += qty;
            if ((m.item_name === 'DIMSUM' || m.item_name === 'DIMSUM FROZEN') && m.movement_type === 'SALE') {
                dimsumSold30d += qty;
                branchStocks[brId].sold30d += qty;
            }
        }
    });

    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1); 
    const avgDimsumPerDay = Math.max((dimsumSold30d / 30), 1);
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);
    const dimsumDaysRemaining = Math.max(0, frozenPusatQty / avgDimsumPerDay);
    const cashDeficit = cashReadyTotal - hutangAyamAktif;

    const forecast = { ayamDays: ayamDaysRemaining.toFixed(1), ayamAvg: avgAyamPerDay.toFixed(1), dimsumDays: dimsumDaysRemaining.toFixed(0), dimsumAvg: avgDimsumPerDay.toFixed(0), cashDeficit };

    // ------------------------------------------
    // GENERATE AUTO-PILOT TASKS (THE ENGINE)
    // ------------------------------------------
    const automationTasks = [];

    // 1. AUTO PURCHASE PLANNER
    if (ayamDaysRemaining <= 4) {
        // Rekomendasi beli ayam untuk 7 hari ke depan
        const targetAyam = Math.ceil(avgAyamPerDay * 7) - ayamGudangQty;
        if (targetAyam > 0) {
            automationTasks.push({ id: 'task-purchase', type: 'PURCHASE', title: 'Draft Purchase: Beli Ayam', desc: `Rekomendasi pembelian: ${targetAyam} KG (Target stok aman 7 hari).`, actionLabel: 'Buat Draft Pembelian' });
        }
    }

    // 2. AUTO DISTRIBUTION ENGINE
    (masterBranches || []).forEach(br => {
        if (br.branch_id === 'PUSAT') return;
        const brData = branchStocks[br.branch_id];
        if (brData) {
            const avgSoldBr = Math.max(brData.sold30d / 30, 1);
            const brDaysRemain = brData.frozen / avgSoldBr;
            if (brDaysRemain <= 3) {
                // Rekomendasi kirim dimsum untuk stok 10 hari
                const targetKirim = Math.ceil(avgSoldBr * 10) - brData.frozen;
                if (targetKirim > 0) {
                    automationTasks.push({ id: `task-do-${br.branch_id}`, type: 'DISTRIBUTION', title: `Draft DO: Kirim ke ${br.branch_name}`, desc: `Stok sisa ${brDaysRemain.toFixed(0)} hari. Rekomendasi kirim: ${targetKirim} Pcs.`, actionLabel: 'Buat Delivery Order' });
                }
            }
        }
    });

    // 3. AUTO CASHFLOW PLANNER
    if (cashDeficit < 0 && pendingCash > 0) {
        const cairkanTarget = Math.min(Math.abs(cashDeficit), pendingCash);
        automationTasks.push({ id: 'task-finance', type: 'FINANCE', title: 'Cashflow Action: Tarik Dana Marketplace', desc: `Defisit kas terdeteksi. Segera cairkan minimal Rp ${formatRp(cairkanTarget)} dari Shopee/GoFood untuk menutup hutang jatuh tempo.`, actionLabel: 'Konfirmasi Pencairan' });
    }

    // 4. SMART ALERTS
    const alerts = [];
    if (cashDeficit < 0) {
        if ((cashDeficit + pendingCash) >= 0) alerts.push({ id: 'a-cash-warn', type: 'warning', title: '⚠️ CASH TIGHT (TERTOLONG MARKETPLACE)', desc: `Kas Tunai/Bank minus Rp ${formatRp(Math.abs(cashDeficit))} untuk bayar ayam. SEGERA cairkan dana Marketplace!` });
        else alerts.push({ id: 'a-cash-danger', type: 'danger', title: '🚨 SEVERE CASHFLOW DEFICIT', desc: `BAHAYA! Walaupun uang Marketplace dicairkan semua, kita masih KURANG Rp ${formatRp(Math.abs(cashDeficit + pendingCash))} untuk melunasi Hutang Ayam!` });
    }
    if (dimsumDaysRemaining > 20) alerts.push({ id: 'a-freezer', type: 'warning', title: '🧊 FREEZER OVERSTOCK', desc: `Rata-rata penjualan ${forecast.dimsumAvg} pcs/hari. Freezer diprediksi baru habis ${forecast.dimsumDays} hari lagi. Tahan Produksi!` });

    return { 
        netProfitTotal, todayNetProfit, totalGrossSales, channelArr, branchArr, kpiEngine,
        cashReadyTotal, pendingCash, hutangAyamAktif, totalAssetInventory,
        forecast, alerts, automationTasks
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, masterBranches, dateFrom, dateTo]);
}
