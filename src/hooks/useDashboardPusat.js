import { useMemo } from 'react';
import { getLocalYMD, getTodayStr, safeSort, formatRp } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  dateFrom, dateTo, chartView 
}) {
  return useMemo(() => {
    const todayStr = getTodayStr();
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // DATA PERIODE AKTIF
    const periodOrders = (orders || []).filter(o => o?.category !== 'Pemalang' && isPeriod(o?.date));
    const periodPurchases = (purchases || []).filter(p => isPeriod(p?.date));
    const periodExpenses = (expenses || []).filter(e => isPeriod(e?.date));
    const periodPayments = (piutangPayments || []).filter(p => isPeriod(p?.date));
    const periodPemalang = (pemalangReports || []).filter(p => isPeriod(p?.date));

    // HELPER TIMESTAMP: Ekstrak Jam atau buat jam konsisten berdasarkan ID
    const getTime = (dateStr, fallbackId) => {
        if (dateStr && dateStr.includes('T')) {
            return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }
        let hash = 0;
        const str = String(fallbackId || 'dimsum');
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const hh = String(8 + (Math.abs(hash) % 10)).padStart(2, '0');
        const mm = String(Math.abs(hash) % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    };

    // 1. ENGINE BUKU BESAR (LEDGER) - KAS & BANK
    let inCash = 0, outCash = 0, inBank = 0, outBank = 0;
    const historyKeuangan = []; 

    const pushLedger = (date, ref, desc, amount, method, type) => {
        const isCash = String(method).toLowerCase().includes('cash') || String(method).toLowerCase().includes('tunai');
        if (type === 'IN') { if (isCash) inCash += amount; else inBank += amount; } 
        else { if (isCash) outCash += amount; else outBank += amount; }
        historyKeuangan.push({ date, ref, desc, amount, method: isCash ? 'CASH' : 'BANK', type });
    };

    periodOrders.forEach(o => {
        if (!o?.id || Number(o.paidAmount) <= 0) return;
        try { const parsed = JSON.parse(o.paymentMethod); parsed.forEach(p => pushLedger(o.date, o.id, `Pendapatan Order ${o.customer}`, Number(p.amount), p.method, 'IN')); } 
        catch(e) { pushLedger(o.date, o.id, `Pendapatan Order ${o.customer}`, Number(o.paidAmount), o.paymentMethod, 'IN'); }
    });

    periodPurchases.forEach(p => {
        if (!p?.id || Number(p.paidAmount) <= 0) return;
        try { const parsed = JSON.parse(p.paymentMethod); parsed.forEach(x => pushLedger(p.date, p.id, `Pembayaran Supplier ${p.supplier}`, Number(x.amount), x.method, 'OUT')); } 
        catch(e) { pushLedger(p.date, p.id, `Pembayaran Supplier ${p.supplier}`, Number(p.paidAmount), p.paymentMethod, 'OUT'); }
    });

    periodExpenses.forEach(e => {
        if (!e?.id || Number(e.total) <= 0) return;
        const desc = e.category === 'Kasbon' ? `Kasbon Karyawan: ${e.description}` : `Ops: ${e.category} - ${e.description}`;
        pushLedger(e.date, e.id, desc, Number(e.total), e.paymentMethod, e.type);
    });

    periodPayments.forEach(pay => {
        if (!pay?.id || Number(pay.amount) <= 0) return;
        const isHutang = String(pay.orderId).startsWith('BUY-');
        const desc = isHutang ? `Cicilan Hutang ke ${pay.orderId}` : `Terima Piutang dari ${pay.orderId}`;
        pushLedger(pay.date, pay.id, desc, Number(pay.amount), pay.paymentMethod, isHutang ? 'OUT' : 'IN');
    });

    let setoranCabang = 0;
    periodPemalang.forEach(r => {
        if (Number(r.nominal) > 0) {
            setoranCabang += Number(r.nominal);
            pushLedger(r.date, r.id, `Setoran Cabang Pemalang`, Number(r.nominal), 'Transfer Bank', 'IN');
        }
    });

    historyKeuangan.sort(safeSort);

    // 2. ENGINE REKAP PIUTANG & HUTANG BERJALAN (DETAIL FULL)
    let totalOmset = 0, totalPcs = 0;
    const piutangBerjalan = [];
    const listPenjualan = periodOrders.map(o => {
        totalOmset += Number(o.total) || 0; totalPcs += Number(o.qty) || 0;
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const terbayar = (Number(o.paidAmount) || 0) + cicilan;
        const sisa = (Number(o.total) || 0) - terbayar;
        
        let status = 'BELUM BAYAR';
        if (sisa <= 0) status = 'LUNAS';
        else if (o.statusProduksi === 'Sudah Diambil') { 
            status = 'PIUTANG'; 
            piutangBerjalan.push({ ...o, sisaTagihan: sisa, time: getTime(o.date, o.id) }); 
        }
        else if (terbayar > 0) status = 'DP';

        let paymentsDetail = [];
        try { paymentsDetail = JSON.parse(o.paymentMethod); } catch(e) { if(o.paidAmount > 0) paymentsDetail = [{ method: o.paymentMethod, amount: o.paidAmount }]; }
        return { ...o, sisaTagihan: sisa, totalTerbayar: terbayar, status, paymentsDetail };
    });

    const hutangBerjalan = [];
    (purchases || []).forEach(p => {
        const cicilan = (piutangPayments || []).filter(pay => pay.orderId === p.id).reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
        const terbayar = (Number(p.paidAmount) || 0) + cicilan;
        const sisa = (Number(p.total) || 0) - terbayar;
        if (sisa > 0) hutangBerjalan.push({ ...p, sisaHutang: sisa, time: getTime(p.date, p.id) });
    });

    // Urutkan List Piutang & Hutang dari terbaru
    piutangBerjalan.sort((a,b) => new Date(b.date) - new Date(a.date));
    hutangBerjalan.sort((a,b) => new Date(b.date) - new Date(a.date));

    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);
    const totalHutangBaru = hutangBerjalan.reduce((sum, p) => sum + p.sisaHutang, 0);

    // 3. ENGINE NOTIFIKASI OPERASIONAL (ALERTS)
    const alerts = [];
    const pendingOrders = (orders || []).filter(o => o.statusProduksi === 'Menunggu Produksi' && o.category !== 'Pemalang');
    if (pendingOrders.length > 0) alerts.push({ id: 'pending-order', type: 'warning', title: 'Order Belum Diproses', desc: `Terdapat ${pendingOrders.length} pesanan pusat yang masih Menunggu Produksi.` });
    
    if (piutangBerjalan.length > 0) alerts.push({ id: 'piutang-alert', type: 'danger', title: 'Piutang Belum Lunas', desc: `Terdapat ${piutangBerjalan.length} invoice pelanggan yang barangnya sudah diambil tapi pembayaran masih kurang.` });
    
    if (hutangBerjalan.length > 0) alerts.push({ id: 'hutang-alert', type: 'danger', title: 'Hutang Jatuh Tempo', desc: `Kewajiban hutang supplier aktif sebesar Rp ${formatRp(totalHutangBaru)} menanti untuk dilunasi.` });
    
    const pemalangHariIni = (pemalangReports || []).find(r => getLocalYMD(r.date) === todayStr);
    if (!pemalangHariIni) alerts.push({ id: 'pemalang-alert', type: 'warning', title: 'Laporan Cabang Kosong', desc: `Cabang Pemalang belum mengirimkan setoran & laporan harian (EOD) hari ini.` });

    // 4. ENGINE ACTIVITY FEED (TIMELINE REALTIME TRANSAKSI)
    let feed = [];
    periodOrders.forEach(o => feed.push({ date: o.date, time: getTime(o.date, o.id), id: o.id, type: 'ORDER', title: 'ORDER MASUK', name: o.customer, desc: `${o.qty} Pcs | Status: ${o.statusProduksi}`, amount: o.total, isPositive: true }));
    periodPurchases.forEach(p => feed.push({ date: p.date, time: getTime(p.date, p.id), id: p.id, type: 'PURCHASE', title: 'PEMBELIAN BAHAN', name: p.supplier, desc: `${p.itemName}`, amount: p.total, isPositive: false }));
    periodPayments.forEach(p => {
        const isHutang = String(p.orderId).startsWith('BUY');
        feed.push({ date: p.date, time: getTime(p.date, p.id), id: p.id, type: 'PAYMENT', title: isHutang ? 'BAYAR HUTANG' : 'PEMBAYARAN MASUK', name: p.paymentMethod || 'Via Kas/Bank', desc: `Invoice: ${p.orderId}`, amount: p.amount, isPositive: !isHutang });
    });
    periodExpenses.forEach(e => feed.push({ date: e.date, time: getTime(e.date, e.id), id: e.id, type: 'EXPENSE', title: e.category === 'Kasbon' ? 'KASBON KARYAWAN' : 'PENGELUARAN KAS', name: e.category, desc: e.description, amount: e.total, isPositive: e.type === 'IN' }));
    
    const periodStok = (stokData || []).filter(s => isPeriod(s.date) && s.type.includes('PRODUKSI'));
    periodStok.forEach(s => feed.push({ date: s.date, time: getTime(s.date, s.id), id: s.id, type: 'PRODUKSI', title: 'PRODUKSI SELESAI', name: 'Dapur Pusat', desc: `${s.qty} Adukan Dieksekusi`, amount: 0, isPositive: true }));

    // Sortir Feed dari yang paling baru (Newest First) & batasi max 25 item agar super ringan
    feed = feed.sort((a,b) => {
        const dateA = new Date(`${String(a.date).split('T')[0]}T${a.time}:00`);
        const dateB = new Date(`${String(b.date).split('T')[0]}T${b.time}:00`);
        return dateB - dateA;
    }).slice(0, 25);

    return { 
        inCash, outCash, inBank, outBank, setoranCabang, saldoCash: inCash - outCash, saldoBank: inBank - outBank,
        historyKeuangan,
        totalOmset, totalPcs, totalPiutangBaru, totalHutangBaru, 
        listPenjualan, piutangBerjalan, hutangBerjalan,
        periodPurchases, periodExpenses,
        alerts, feed
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo, chartView]);
}
