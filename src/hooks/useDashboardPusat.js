import { useMemo } from 'react';
import { getLocalYMD, getTodayStr } from '../utils/helpers';

export default function useDashboardPusat(dbData) {
  return useMemo(() => {
    // Destructuring internal agar aman dari error parameter panjang di React Compiler
    const {
      orders = [], expenses = [], purchases = [], piutangPayments = [], 
      supplierLedger = [], cashflowTransactions = [], marketplaceSettlement = [], 
      inventoryCostLayers = [], stockMovements = [], masterBranches = [], master_customers = []
    } = dbData || {};

    const todayStr = getTodayStr();
    const todayObj = new Date(todayStr);

    const getDaysDifference = (d1, d2) => {
      const diffTime = Math.abs(new Date(d1) - new Date(d2));
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(todayObj.getDate() - 7);
    const limitSevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(todayObj.getDate() - 14);
    const limitFourteenDaysStr = fourteenDaysAgo.toISOString().split('T')[0];

    // --- GLOBAL CASH & WALLET MONITORING ---
    let inCash = 0, outCash = 0, pendingMarketplace = 0, hutangAyamAktif = 0;
    let totalCairLemburKaryawan = 0; 
    
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
        
        if((c.type === 'OUT' || c.transaction_type === 'OUTFLOW') && c.category === 'UANG LEMBUR & BONUS') {
          totalCairLemburKaryawan += Number(c.amount || 0);
        }
    });

    const cashReadyTotal = inCash - outCash;

    // --- KENDALI EVALUASI PIUTANG AGEN ---
    const customerPiutangMap = {};
    const groupOrders = {};

    (master_customers || []).forEach(cust => {
      customerPiutangMap[cust.customer_name.toUpperCase()] = {
        customer_id: cust.id, customer_name: cust.customer_name.toUpperCase(),
        phone: cust.phone || '-', address: cust.address || '-', notes_crm: cust.notes || '-',
        total_bon_gantung: 0, tanggal_bon_terlama: null, last_order_date: null,
        qty_order_minggu_ini: 0, qty_order_minggu_lalu: 0, total_belanja_akumulasi: 0,
        frequency_order: 0, nota_details: []
      };
    });

    (orders || []).forEach(o => {
        if(o.isDeleted) return;
        const oId = o.id;
        const cName = String(o.customer_name || o.customer || 'UMUM').toUpperCase();

        if(!groupOrders[oId]) {
          groupOrders[oId] = { 
            id: oId, date: o.date, customer: cName, tagihan: 0, 
            bayar: Number(o.amount_paid || o.paidAmount || 0), 
            method: o.payment_method || o.paymentMethod, status: o.status 
          };
        }
        groupOrders[oId].tagihan += Number(o.total_amount || o.total || 0);

        if (customerPiutangMap[cName]) {
          const qtyOrder = Number(o.qty || 0);
          customerPiutangMap[cName].total_belanja_akumulasi += Number(o.total_amount || o.total || 0);
          customerPiutangMap[cName].frequency_order += 1;
          
          if (!customerPiutangMap[cName].last_order_date || new Date(o.date) > new Date(customerPiutangMap[cName].last_order_date)) {
            customerPiutangMap[cName].last_order_date = o.date;
          }

          const orderDateYMD = getLocalYMD(o.date);
          if (orderDateYMD >= limitSevenDaysStr && orderDateYMD <= todayStr) {
            customerPiutangMap[cName].qty_order_minggu_ini += qtyOrder;
          } else if (orderDateYMD >= limitFourteenDaysStr && orderDateYMD < limitSevenDaysStr) {
            customerPiutangMap[cName].qty_order_minggu_lalu += qtyOrder;
          }
        }
    });

    (piutangPayments || []).forEach(p => {
        if(!p.isDeleted && groupOrders[p.orderId]) {
          groupOrders[p.orderId].bayar += Number(p.amount || p.amount_paid || 0);
        }
    });

    let totalPiutangPelanggan = 0;
    Object.values(groupOrders).forEach(go => {
        const sisaHutang = go.tagihan - go.bayar;
        if(sisaHutang > 0 && (go.method === 'PIUTANG' || go.method === 'TEMPO' || go.status === 'BELUM_LUNAS')) {
            totalPiutangPelanggan += sisaHutang;
            const cName = go.customer;

            if (customerPiutangMap[cName]) {
              customerPiutangMap[cName].total_bon_gantung += sisaHutang;
              customerPiutangMap[cName].nota_details.push({
                invoice_id: go.id, date: go.date, total_tagihan: go.tagihan,
                sudah_dibayar: go.bayar, sisa_hutang: sisaHutang, metode_asal: go.method
              });

              if (!customerPiutangMap[cName].tanggal_bon_terlama || new Date(go.date) < new Date(customerPiutangMap[cName].tanggal_bon_terlama)) {
                customerPiutangMap[cName].tanggal_bon_terlama = go.date;
              }
            }
        }
    });

    const listMadingPiutangAktif = Object.values(customerPiutangMap)
      .map(cust => {
        let harianAbsen = cust.last_order_date ? getDaysDifference(todayStr, cust.last_order_date) : 999;
        let statusNotifMerah = harianAbsen > 7; 
        
        let trenFluktuasi = 'STABIL';
        let selisihPcs = cust.qty_order_minggu_ini - cust.qty_order_minggu_lalu;
        if (selisihPcs > 0) trenFluktuasi = 'NAIK';
        if (selisihPcs < 0) trenFluktuasi = 'TURUN';

        return {
          ...cust, hari_absen: harianAbsen, is_notif_merah: statusNotifMerah,
          tren_fluktuasi: trenFluktuasi, selisih_pcs_mingguan: Math.abs(selisihPcs)
        };
      })
      .filter(c => c.total_bon_gantung > 0 || c.frequency_order > 0)
      .sort((a, b) => b.total_bon_gantung - a.total_bon_gantung);

    // --- AUTOMATIC RATIO SPLITTER 5 AMPLOP SAKRAL ---
    let totalOmsetHariIni = (orders || []).reduce((sum, o) => {
      if(!o.isDeleted && o.date === todayStr) return sum + (Number(o.total_amount || o.total || 0));
      return sum;
    }, 0);

    const amplop1_bahanBaku = totalOmsetHariIni * 0.55;
    const amplop2_operasional = totalOmsetHariIni * 0.20;
    const amplop3_jagaJaga = totalOmsetHariIni * 0.10;
    const amplop4_profitMurni = totalOmsetHariIni * 0.10; 
    const amplop5_totalKesejahteraan = totalOmsetHariIni * 0.05; 
    
    const porsiThrAgenPabrik = amplop5_totalKesejahteraan * 0.60;
    const porsiThrKaryawanDapur = amplop5_totalKesejahteraan * 0.40;

    // --- VALUASI STOK GUDANG ---
    let ayamGudangQty = 0, totalStokDimsumPcs = 0, totalValuasiGudang = 0;
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.status !== 'ACTIVE') return;
      const qty = Number(l.qty_remaining || 0);
      const cost = Number(l.unit_cost || 0);
      totalValuasiGudang += (qty * cost);
      if (String(l.item_name).toUpperCase() === 'AYAM') ayamGudangQty += qty;
      else if (String(l.item_name).toUpperCase().includes('DIMSUM')) totalStokDimsumPcs += qty;
    });

    // --- LEADERBOARD LINTAS CABANG ---
    const branchSales = {};
    (masterBranches || []).forEach(br => {
        branchSales[br.branch_id] = { branch_id: br.branch_id, name: br.branch_name || br.branch_id, type: br.branch_type, omzetHariIni: 0, omzetBulanIni: 0 };
    });

    const curMonth = todayStr.substring(0, 7);
    (orders || []).forEach(o => {
        if(o.isDeleted) return;
        const brId = o.branch_id;
        const netSales = Number(o.total_amount || o.total || 0);
        if(branchSales[brId]) {
            if(o.date === todayStr) branchSales[brId].omzetHariIni += netSales;
            if(String(o.date).startsWith(curMonth)) branchSales[brId].omzetBulanIni += netSales;
        }
    });

    const leaderboardArr = Object.values(branchSales).sort((a,b) => b.omzetBulanIni - a.omzetBulanIni);

    // --- AUTO TASK PROCUREMENT ---
    let ayamUsed30d = 0;
    (stockMovements || []).forEach(m => {
        if(m.isDeleted) return;
        const qty = Number(m.qty) || 0;
        const dateObj = getLocalYMD(m.date);
        const thirtyAgo = new Date(); thirtyAgo.setDate(todayObj.getDate() - 30);
        const limitDateStr = thirtyAgo.toISOString().split('T')[0];
        if (m.item_name === 'AYAM' && m.movement_type === 'PRODUCTION_USAGE' && dateObj >= limitDateStr) {
            ayamUsed30d += qty;
        }
    });

    const avgAyamPerDay = Math.max((ayamUsed30d / 30), 1);
    const ayamDaysRemaining = Math.max(0, ayamGudangQty / avgAyamPerDay);
    const operationTasks = [];

    if (ayamDaysRemaining <= 4) {
        const taskId = 'TASK-PURCHASE-' + todayStr;
        const targetAyam = 1020; 
        const estCost = targetAyam * 37500;
        operationTasks.push({ 
            id: taskId, type: 'PURCHASE', priority: ayamDaysRemaining <= 2 ? 'CRITICAL' : 'HIGH',
            title: `Jadwalkan Turun Ayam SCM (1.020 KG)`, 
            desc: `Sisa gudang ${ayamGudangQty.toLocaleString('id-ID')} KG (Tahan ${ayamDaysRemaining.toFixed(1)} hari). Dana Est: Rp ${estCost.toLocaleString('id-ID')}`, 
            actionLabel: 'Buat PO Belanja Ayam'
        });
    }

    // --- GRAPH TREND 7 HARI ---
    const trendDataMap = {};
    for(let i=6; i>=0; i--) {
        const d = new Date(todayObj); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        trendDataMap[ds] = 0;
    }
    (orders || []).forEach(o => {
        if(!o.isDeleted && trendDataMap[o.date] !== undefined) {
            trendDataMap[o.date] += Number(o.total_amount || o.total || 0);
        }
    });
    const trendData = Object.keys(trendDataMap).sort().map(k => ({ label: k.substring(5), value: trendDataMap[k] }));

    return { 
        cashReadyTotal, hutangAyamAktif, totalPiutangPelanggan, pendingMarketplace,
        ayamGudangQty, totalStokDimsumPcs, totalValuasiGudang, ayamDaysRemaining,
        operationTasks, leaderboardArr, trendData, totalOmsetHariIni,
        amplopKeuangan: {
          bahanBaku: amplop1_bahanBaku, operasional: amplop2_operasional, jagaJaga: amplop3_jagaJaga, profitMurni: amplop4_profitMurni,
          totalKesejahteraanGlobal: amplop5_totalKesejahteraan, subThrAgen: porsiThrAgenPabrik, subThrKaryawan: porsiThrKaryawanDapur,
          realtimePengeluaranLemburHariIni: totalCairLemburKaryawan
        },
        madingPiutangPelanggan: listMadingPiutangAktif
    };
  }, [dbData]);
}
