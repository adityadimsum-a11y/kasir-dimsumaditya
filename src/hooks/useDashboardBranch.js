import { useMemo } from 'react';
import { getLocalYMD } from '../utils/helpers'; // 🔥 JALUR IMPORT DIKUNCI SESUAI STRUKTUR UTILS ENTE

export default function useDashboardBranch(dbData, dateFrom, dateTo) {
  return useMemo(() => {
    // 🎛️ Bongkar data mentah dari state terpusat App.jsx
    const { 
      orders = [], 
      pemalangReports = [], 
      piutangPayments = [], 
      stokData = [] 
    } = dbData || {};

    // 📏 Parameter Konversi Sakral Cabang Pemalang
    const MASTER_AYAM_KG = 30; 
    const MASTER_PCS = 1000; 
    const KG_PER_KANTONG = 10;

    // Fungsi pencocokan rentang tanggal operasional harian
    const isPeriod = (d) => {
      const ymd = getLocalYMD(d);
      return ymd >= dateFrom && ymd <= dateTo;
    };
    
    // =========================================================
    // 💰 1. MATEMATIKA KEUANGAN & RATIO SETORAN PEMALANG
    // =========================================================
    const branchOrdersAll = (orders || []).filter(o => o?.category === 'Pemalang');
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o?.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => isPeriod(r?.date));
    
    const totalPenjualanKotor = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.total || o.total_amount || 0)), 0);
    const totalPcs = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.qty || 0)), 0);
    const setoranKePusat = branchReportsPeriod.reduce((sum, r) => sum + (Number(r.nominal || r.amount || 0)), 0);
    
    // Tracing Piutang / Bon Gantung Agen lokal Pemalang (Yang barangnya sudah diambil supir)
    const piutangBerjalan = branchOrdersAll.map(o => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const baseTotal = Number(o.total || o.total_amount || 0);
        const basePaid = Number(o.amount_paid || o.paidAmount || 0);
        return { 
          ...o, 
          sisaTagihan: baseTotal - basePaid - cicilan, 
          statusProduksi: o.statusProduksi || 'Menunggu Produksi' 
        };
    }).filter(o => o.sisaTagihan > 0 && o.statusProduksi === 'Sudah Diambil');
    
    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    let totalTerbayarPeriode = 0;
    const customerMap = {};
    const groupedOrders = {};
    
    branchOrdersPeriod.forEach(o => {
        const cicilanData = (piutangPayments || []).filter(p => p.orderId === o.id);
        const cicilan = cicilanData.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const baseTotal = Number(o.total || o.total_amount || 0);
        const basePaid = Number(o.amount_paid || o.paidAmount || 0);
        const terbayar = basePaid + cicilan;
        const sisa = baseTotal - terbayar;
        
        totalTerbayarPeriode += terbayar;

        const cName = String(o.customer || o.customer_name || 'UMUM').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += Number(o.qty || 0);
        customerMap[cName].porsi += (Number(o.qty || 0) / 4);
        customerMap[cName].total += baseTotal;
        customerMap[cName].frequency += 1;

        let status = 'BELUM BAYAR';
        if (sisa <= 0) status = 'LUNAS';
        else if (o.statusProduksi === 'Sudah Diambil') status = 'PIUTANG';
        else if (terbayar > 0) status = 'DP';

        let allPayments = [];
        try { 
          if(o.paymentMethod || o.payment_method) {
            allPayments = JSON.parse(o.paymentMethod || o.payment_method); 
          }
        } catch(e) { 
          if(basePaid > 0) allPayments = [{ method: o.paymentMethod || o.payment_method, amount: basePaid }]; 
        }
        allPayments.push(...cicilanData.map(c => ({ method: c.paymentMethod, amount: c.amount })));

        if(!groupedOrders[o.id]) {
          groupedOrders[o.id] = { ...o, items: [`${o.qty || 0} Pcs`], totalTagihan: baseTotal, totalTerbayar: terbayar, sisaTagihan: sisa, status, allPayments };
        } else { 
          groupedOrders[o.id].items.push(`${o.qty || 0} Pcs`); 
          groupedOrders[o.id].totalTagihan += baseTotal; 
        }
    });

    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    // =========================================================
    // 📦 2. PENGHITUNGAN LOGISTIK & REAL-TIME STOK LIVE ADUKAN
    // =========================================================
    const mutasiAyamAll = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty || 0), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty || 0), 0);
    
    // Kalkulasi stok sisa kilogram ayam di gudang dapur Pemalang
    const sisaAyam = mutasiAyamAll - (prodPemalangAll * MASTER_AYAM_KG);
    
    const terjualPcsAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.qty || 0), 0);
    
    // Kalkulasi sisa kapasitas unit freezer live Pemalang
    const sisaFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    const adukanHariIni = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty || 0), 0);
    
    const ops = {
        sisaAyam, 
        sisaAyamKtg: sisaAyam / KG_PER_KANTONG,
        sisaFreezer, 
        adukanHariIni, 
        ayamTerpakaiHariIni: adukanHariIni * MASTER_AYAM_KG, 
        dimsumMasukHariIni: adukanHariIni * MASTER_PCS
    };

    return {
        totalPenjualanKotor, 
        totalPcs, 
        setoranKePusat, 
        totalPiutangBaru, 
        totalTerbayarPeriode,
        listOrders: Object.values(groupedOrders),
        listPiutangBerjalan: piutangBerjalan,
        listReports: branchReportsPeriod,
        topCustomersList, 
        ops
    };
  }, [dbData, dateFrom, dateTo]);
}
