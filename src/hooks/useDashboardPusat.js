import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, formatRp } from '../utils/helpers';

export default function useDashboardPusat({
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData,
  supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
  stockMovements, discrepancyLogs, financialClosings, masterBranches, systemTasks
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const todayObj = new Date(todayStr);

    // ==========================================
    // 1. FINANCIAL RADAR (CASH, AR, AP)
    // ==========================================
    let inCash = 0, outCash = 0, pendingMarketplace = 0, hutangAyamAktif = 0;
    let totalPiutangPelanggan = 0;

    (marketplaceSettlement || []).forEach(m => { if (m.status === 'PENDING' && !m.isDeleted) pendingMarketplace += (Number(m.net) || 0); });
    (supplierLedger || []).forEach(l => { 
        if(l.isDeleted) return;
        const amt = Number(l.amount) || 0; 
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt; 
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt; 
    });
    (cashflowTransactions || []).forEach(c => { 
        if(c.isDeleted) return;
        if(c.transaction_type === 'INFLOW' || c.type === 'CASH_IN') inCash += Number(c.amount); 
        if(c.transaction_type === 'OUTFLOW' || c.type === 'CASH_OUT') outCash += Number(c.amount); 
    });
    
    // Piutang Pelanggan logic
    const groupOrders = {};
    (orders || []).forEach(o => {
        if(o.isDeleted) return;
        if(!groupOrders[o.id]) groupOrders[o.id] = { tagihan: 0, bayar: Number(o.paidAmount)||0, method: o.paymentMethod, status: o.statusProduksi };
        groupOrders[o.id].tagihan += Number(o.total)||0;
    });
    (piutangPayments || []).forEach(p => {
        if(groupOrders[p.orderId]) groupOrders[p.orderId].bayar += Number(p.amount);
    });
    Object.values(groupOrders).forEach(go => {
        const sisa = go.tagihan - go.bayar;
        if(sisa > 0 && (go.method === 'PIUTANG' || go.status === 'Sudah Diambil')) totalPiutangPelanggan += sisa;
    });

    const cashReadyTotal = inCash - outCash;

    // ==========================================
    // 2. INVENTORY VALUATION & VOLUME
    // ==========================================
    let ayamGudangQty = 0, totalStokDimsumPcs = 0;
    let totalValuasiGudang = 0;
    
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.status !== 'ACTIVE') return;
      const qty = Number(l.qty_remaining || 0);
      const cost = Number(l.unit_cost || 0);
      
      totalValuasiGudang += (qty * cost);

      if (String(l.item_name).toUpperCase() === 'AYAM') ayamGudangQty += qty;
      else if (String(l.item_name).toUpperCase().includes('DIMSUM')) totalStokDimsumPcs += qty;
    });

    // ==========================================
    // 3. VELOCITY, LEADERBOARD, & AI TASKS
    // ==========================================
    let ayamUsed30d = 0;
    const branchStocks = {};
    const branchSales = {};

    (masterBranches || []).forEach(br => {
        branchStocks[br.branch_id] = { frozen: 0, sold30d: 0 };
        if(br.branch_type !== 'HQ_FACTORY') {
            branchSales[br.branch_id] = { name: br.branch_name || br.branch_id, omzetHariIni: 0, omzetBulanIni: 0 };
        }
    });

    (stockMovements || []).forEach(m => {
        if(m.isDeleted) return;
        const qty = Number(m.qty) || 0;
        const brId = m.branch_id;
        
        const dateObj = getLocalYMD(m.date);
        const thirtyAgo = new Date(); thirtyAgo.setDate(new Date().getDate() - 30);
        const limitDateStr = thirtyAgo.toISOString().split('T')[0];
        
        if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE' && dateObj >= limitDateStr) {
            ayamUsed30d += qty;
        }
        
        if (String(m.item_name).includes('DIMSUM')) {
            if(m.to_location && m.to_location.includes('FREEZER') && brId && branchStocks[brId]) branchStocks[brId].frozen += qty;
            if(m.from_location && m.from_location.includes('FREEZER') && brId && branchStocks[brId]) branchStocks[brId].frozen -= qty;
            
            if (m.movement_type === 'SALE' && dateObj >= limitDateStr) {
                if(brId && branchStocks[brId]) branchStocks[brId].sold30d += qty;
            }
        }
    });

    const curMonth = todayStr.substring(0, 7);
    (orders || []).forEach(o => {
        if(o.isDeleted) return;
        const brId = o.branch_id;
        const netSales = (Number(o.total)||0) - (Number(o.fee_amount)||0) - (Number(o.marketplace_promo)||0);
        if(branchSales[brId]) {
            if(o.date === todayStr) branchSales[brId].omzetHariIni += netSales;
            if(String(o.date).startsWith(curMonth)) branchSales[brId].omzetBulanIni += netSales;
        }
    });

    const leaderboardArr = Object.values(branchSales).sort((a,b) => b.omzetBulanIni - a.omzetBulanIni);

    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1);
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);

    // AI TASK QUEUE (Rekomendasi Operasional)
    const operationTasks = [];
    const executedTaskIds = (systemTasks || []).map(t => t.id);

    // RULE: 1020 KG Ayam per Turun (Berdasarkan insight user)
    if (ayamDaysRemaining <= 4) {
        const taskId = 'TASK-PURCHASE-' + todayStr;
        if (!executedTaskIds.includes(taskId)) {
            const targetAyam = 1020; 
            const estCost = targetAyam * 38000; // Asumsi harga pasar, bisa ditarik dari db jika mau
            const priority = ayamDaysRemaining <= 2 ? 'CRITICAL' : 'HIGH';
            operationTasks.push({ 
                id: taskId, type: 'PURCHASE', priority,
                title: `Auto-Procurement: Jadwalkan Turun Ayam (1.020 KG)`, 
                desc: `Sisa ayam gudang ${ayamGudangQty.toLocaleString('id-ID')} KG (Tahan ${ayamDaysRemaining.toFixed(1)} hari). Siapkan PO 1 Ton untuk dikirim segera. Est Dana: Rp ${formatRp(estCost)}.`, 
                actionLabel: 'Siapkan Dana & Buat PO'
            });
        }
    }

    // RULE: Distribusi Cabang
    (masterBranches || []).forEach(br => {
        if (br.branch_type === 'HQ_FACTORY') return;
        const brData = branchStocks[br.branch_id];
        if (brData) {
            const avgSoldBr = Math.max(brData.sold30d / 30, 1);
            const brDaysRemain = brData.frozen / avgSoldBr;
            if (brDaysRemain <= 3) {
                const taskId = `TASK-DO-${br.branch_id}-${todayStr}`;
                if (!executedTaskIds.includes(taskId)) {
                    const targetKirim = Math.ceil(avgSoldBr * 7); // Standar kirim stok untuk 7 hari
                    operationTasks.push({ 
                        id: taskId, type: 'DISTRIBUTION', priority: brDaysRemain <= 1 ? 'CRITICAL' : 'HIGH',
                        title: `Auto-DO: Kirim Stok ke ${br.branch_name || br.branch_id}`, 
                        desc: `Stok sisa ${brData.frozen} Pcs (Tahan ${brDaysRemain.toFixed(0)} hari). Rekomendasi kirim ${targetKirim.toLocaleString('id-ID')} Pcs.`, 
                        actionLabel: 'Buat Surat Jalan (DO)'
                    });
                }
            }
        }
    });

    operationTasks.sort((a, b) => {
        const w = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
        return w[b.priority] - w[a.priority];
    });

    // ==========================================
    // 4. CHART DATA (Tren Omzet 7 Hari Terakhir)
    // ==========================================
    const trendDataMap = {};
    for(let i=6; i>=0; i--) {
        const d = new Date(todayObj); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        trendDataMap[ds] = 0;
    }
    (orders || []).forEach(o => {
        if(!o.isDeleted && trendDataMap[o.date] !== undefined) {
            trendDataMap[o.date] += (Number(o.total)||0) - (Number(o.fee_amount)||0) - (Number(o.marketplace_promo)||0);
        }
    });
    const trendData = Object.keys(trendDataMap).sort().map(k => ({
        label: k.substring(5), // Ambil MM-DD
        value: trendDataMap[k]
    }));

    return { 
        cashReadyTotal, hutangAyamAktif, totalPiutangPelanggan, pendingMarketplace,
        ayamGudangQty, totalStokDimsumPcs, totalValuasiGudang, ayamDaysRemaining,
        operationTasks, leaderboardArr, trendData
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, discrepancyLogs, financialClosings, masterBranches, systemTasks]);
}
