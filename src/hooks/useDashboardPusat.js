import { useMemo } from 'react';
import { getLocalYMD, safeSort } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  dateFrom, dateTo, chartView 
}) {
  return useMemo(() => {
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // 1. FILTER DATA PERIODE AKTIF SAJA UNTUK MERINGANKAN RENDER
    const periodOrders = (orders || []).filter(o => o?.category !== 'Pemalang' && isPeriod(o?.date));
    const periodPurchases = (purchases || []).filter(p => isPeriod(p?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));
    const periodPayments = (piutangPayments || []).filter(p => isPeriod(p?.date));
    const periodPemalang = (pemalangReports || []).filter(p => isPeriod(p?.date));

    // 2. ENGINE BUKU BESAR (LEDGER) - KAS & BANK
    let inCash = 0, outCash = 0;
    let inBank = 0, outBank = 0;
    const historyKeuangan = []; // Menyimpan semua pergerakan uang

    const pushLedger = (date, ref, desc, amount, method, type) => {
        const isCash = String(method).toLowerCase().includes('cash');
        if (type === 'IN') {
            if (isCash) inCash += amount; else inBank += amount;
        } else {
            if (isCash) outCash += amount; else outBank += amount;
        }
        historyKeuangan.push({ date, ref, desc, amount, method: isCash ? 'CASH' : 'BANK', type });
    };

    // A. Masukkan DP/Lunas Penjualan ke Ledger
    periodOrders.forEach(o => {
        if (!o?.id || Number(o.paidAmount) <= 0) return;
        try {
            const parsed = JSON.parse(o.paymentMethod);
            parsed.forEach(p => pushLedger(o.date, o.id, `Pendapatan Order ${o.customer}`, Number(p.amount), p.method, 'IN'));
        } catch(e) {
            pushLedger(o.date, o.id, `Pendapatan Order ${o.customer}`, Number(o.paidAmount), o.paymentMethod, 'IN');
        }
    });

    // B. Masukkan DP/Lunas Pembelian ke Ledger
    periodPurchases.forEach(p => {
        if (!p?.id || Number(p.paidAmount) <= 0) return;
        try {
            const parsed = JSON.parse(p.paymentMethod);
            parsed.forEach(x => pushLedger(p.date, p.id, `Pembayaran Supplier ${p.supplier}`, Number(x.amount), x.method, 'OUT'));
        } catch(e) {
            pushLedger(p.date, p.id, `Pembayaran Supplier ${p.supplier}`, Number(p.paidAmount), p.paymentMethod, 'OUT');
        }
    });

    // C. Masukkan Operasional & Kasbon ke Ledger
    periodExpenses.forEach(e => {
        if (!e?.id || Number(e.total) <= 0) return;
        const desc = e.category === 'Kasbon' ? `Kasbon Karyawan: ${e.description}` : `Ops: ${e.category} - ${e.description}`;
        pushLedger(e.date, e.id, desc, Number(e.total), e.paymentMethod, e.type);
    });

    // D. Masukkan Cicilan Hutang/Piutang ke Ledger
    periodPayments.forEach(pay => {
        if (!pay?.id || Number(pay.amount) <= 0) return;
        const isHutang = String(pay.orderId).startsWith('BUY-');
        const desc = isHutang ? `Cicilan Hutang ke ${pay.orderId}` : `Terima Piutang dari ${pay.orderId}`;
        pushLedger(pay.date, pay.id, desc, Number(pay.amount), pay.paymentMethod, isHutang ? 'OUT' : 'IN');
    });

    // E. Masukkan Setoran Cabang ke Bank Ledger
    let setoranCabang = 0;
    periodPemalang.forEach(r => {
        if (Number(r.nominal) > 0) {
            setoranCabang += Number(r.nominal);
            pushLedger(r.date, r.id, `Setoran Cabang Pemalang`, Number(r.nominal), 'Transfer Bank', 'IN');
        }
    });

    historyKeuangan.sort(safeSort);

    // 3. ENGINE REKAP PENJUALAN & PIUTANG
    let totalOmset = 0, totalPcs = 0;
    const piutangBerjalan = [];
    
    const listPenjualan = periodOrders.map(o => {
        totalOmset += Number(o.total) || 0;
        totalPcs += Number(o.qty) || 0;

        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const terbayar = (Number(o.paidAmount) || 0) + cicilan;
        const sisa = (Number(o.total) || 0) - terbayar;
        
        let status = 'BELUM BAYAR';
        if (sisa <= 0) status = 'LUNAS';
        else if (o.statusProduksi === 'Sudah Diambil') { status = 'PIUTANG'; piutangBerjalan.push({ ...o, sisaTagihan: sisa }); }
        else if (terbayar > 0) status = 'DP';

        // Format data detail payment
        let paymentsDetail = [];
        try { paymentsDetail = JSON.parse(o.paymentMethod); } catch(e) { if(o.paidAmount > 0) paymentsDetail = [{ method: o.paymentMethod, amount: o.paidAmount }]; }
        
        return { ...o, sisaTagihan: sisa, totalTerbayar: terbayar, status, paymentsDetail };
    });

    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    // 4. ENGINE MONITORING KASBON KARYAWAN (FITUR BARU)
    const listKasbon = (expenses || []).filter(e => e.category === 'Kasbon' && !e.isDeleted);
    const rekapKasbon = {};
    listKasbon.forEach(k => {
        const nama = String(k.description || 'Tidak Diketahui').toUpperCase();
        if(!rekapKasbon[nama]) rekapKasbon[nama] = 0;
        if(k.type === 'OUT') rekapKasbon[nama] += Number(k.total); // Kasbon keluar
        if(k.type === 'IN') rekapKasbon[nama] -= Number(k.total); // Bayar kasbon (potong gaji)
    });
    const karyawanKasbon = Object.keys(rekapKasbon).map(nama => ({ nama, sisaKasbon: rekapKasbon[nama] })).filter(k => k.sisaKasbon > 0);

    return { 
        inCash, outCash, inBank, outBank, setoranCabang, saldoCash: inCash - outCash, saldoBank: inBank - outBank,
        historyKeuangan,
        totalOmset, totalPcs, totalPiutangBaru, listPenjualan, piutangBerjalan,
        karyawanKasbon,
        periodPurchases, periodExpenses
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo, chartView]);
}
