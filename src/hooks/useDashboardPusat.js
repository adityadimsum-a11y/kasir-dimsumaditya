import { useMemo } from 'react';
import { getLocalYMD } from '../utils/helpers';

export default function useDashboardPusat({ 
  orders, expenses, purchases, piutangPayments, pemalangReports, stokData, 
  dateFrom, dateTo, chartView 
}) {
  return useMemo(() => {
    const isCumulative = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) <= dateTo;
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const cumOrdersPusat = (orders || []).filter(o => isCumulative(o?.date) && o?.category !== 'Pemalang');
    const cumPurchases = (purchases || []).filter(p => isCumulative(p?.date));
    const cumExpenses = (expenses || []).filter(e => isCumulative(e?.date));
    const cumPayments = (piutangPayments || []).filter(p => isCumulative(p?.date));
    const cumPemalangReports = (pemalangReports || []).filter(p => isCumulative(p?.date));

    // HELPER: Ekstrak Cash vs Transfer (Mendukung data JSON Split Payment dan teks lama)
    const processPaymentMethod = (methodStr, fallbackAmount) => {
        let cash = 0, tf = 0;
        try {
            const parsed = JSON.parse(methodStr);
            parsed.forEach(p => {
                if (String(p.method).toLowerCase().includes('cash')) cash += Number(p.amount);
                else tf += Number(p.amount);
            });
        } catch(e) {
            if (String(methodStr).toLowerCase().includes('cash')) cash += fallbackAmount;
            else tf += fallbackAmount;
        }
        return { cash, tf };
    };

    // PERHITUNGAN KEUANGAN KAS
    let kasMasukCash = 0, kasMasukTF = 0, kasKeluarCash = 0, kasKeluarTF = 0;
    
    const groupedOrdersCum = {};
    cumOrdersPusat.forEach(o => { if(!o?.id) return; if(!groupedOrdersCum[o.id]) groupedOrdersCum[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 }; });
    Object.values(groupedOrdersCum).forEach(o => { const pm = processPaymentMethod(o.method, o.paid); kasMasukCash += pm.cash; kasMasukTF += pm.tf; });

    const groupedPurCum = {};
    cumPurchases.forEach(p => { if(!p?.id) return; if(!groupedPurCum[p.id]) groupedPurCum[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 }; });
    Object.values(groupedPurCum).forEach(p => { const pm = processPaymentMethod(p.method, p.paid); kasKeluarCash += pm.cash; kasKeluarTF += pm.tf; });

    cumExpenses.forEach(e => { 
        const t = Number(e.total) || 0; const isCash = String(e.paymentMethod).toLowerCase().includes('cash');
        if (e.type === 'IN') { if (isCash) kasMasukCash += t; else kasMasukTF += t; } 
        else { if (isCash) kasKeluarCash += t; else kasKeluarTF += t; } 
    });

    cumPayments.forEach(pay => { 
        const amt = Number(pay.amount) || 0; const isHutang = String(pay?.orderId || '').startsWith('BUY-'); 
        const isCash = String(pay.paymentMethod).toLowerCase().includes('cash');
        if(isHutang) { if (isCash) kasKeluarCash += amt; else kasKeluarTF += amt; } 
        else { if (isCash) kasMasukCash += amt; else kasMasukTF += amt; } 
    });

    let setoranPemalangTF = 0; cumPemalangReports.forEach(p => { setoranPemalangTF += (Number(p?.nominal) || 0); });
    const saldoCash = kasMasukCash - kasKeluarCash; const saldoTF = (kasMasukTF + setoranPemalangTF) - kasKeluarTF; const saldoAkhir = saldoCash + saldoTF;

    const periodOrdersPusat = cumOrdersPusat.filter(o => isPeriod(o?.date));
    const periodPurchases = cumPurchases.filter(p => isPeriod(p?.date));
    const periodExpenses = cumExpenses.filter(e => isPeriod(e?.date));
    
    let totalPenjualanKotor = 0, totalPorsi = 0, totalPcs = 0, totalPiutangBaru = 0, totalHutangBaru = 0;
    const breakdownPorsi = {}; const chartDataMap = {}; const customerMap = {};

    periodOrdersPusat.forEach(o => {
        if(!o?.id) return;
        const qty = Number(o.qty) || 0; const total = Number(o.total) || 0;
        totalPcs += qty; totalPorsi += (qty / 4); totalPenjualanKotor += total;
        if (o.category) breakdownPorsi[o.category] = (breakdownPorsi[o.category] || 0) + (qty / 4);
        const cName = String(o.customer || '').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += qty; customerMap[cName].porsi += (qty / 4); customerMap[cName].total += total; customerMap[cName].frequency += 1;
        let cKey = chartView === 'daily' ? new Date(o.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : new Date(o.date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        chartDataMap[cKey] = (chartDataMap[cKey] || 0) + total;
    });

    const finalChartData = Object.keys(chartDataMap).map(k => ({ label: k, value: chartDataMap[k] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const groupOrdersAll = {}; (orders || []).filter(o => o?.category !== 'Pemalang').forEach(o => { if(!o?.id) return; if(!groupOrdersAll[o.id]) groupOrdersAll[o.id] = { ...o, items: [], totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0, statusProduksi: o.statusProduksi || 'Menunggu Produksi' }; groupOrdersAll[o.id].items.push(`${o.qty} Pcs`); groupOrdersAll[o.id].totalTagihan += Number(o.total)||0; });
    const groupPurAll = {}; (purchases || []).forEach(p => { if(!p?.id) return; if(!groupPurAll[p.id]) groupPurAll[p.id] = { ...p, items: [], totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0 }; groupPurAll[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`); groupPurAll[p.id].totalTagihan += Number(p.total)||0; });

    // PIUTANG HANYA JIKA "SUDAH DIAMBIL" DAN SISA > 0
    const listPiutangBerjalan = Object.values(groupOrdersAll).map(grp => { const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan }; }).filter(o => o.sisaHutang > 0 && o.statusProduksi === 'Sudah Diambil');
    const listHutangBerjalan = Object.values(groupPurAll).map(grp => { const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan }; }).filter(p => p.sisaHutang > 0);

    totalPiutangBaru = listPiutangBerjalan.reduce((sum, item) => sum + (item.sisaHutang || 0), 0);
    totalHutangBaru = listHutangBerjalan.reduce((sum, item) => sum + (item.sisaHutang || 0), 0);

    const orderSisaTracker = {};
    Object.values(groupOrdersAll).forEach(o => { orderSisaTracker[o.id] = o.totalTagihan - o.totalDibayar; });
    Object.values(groupPurAll).forEach(p => { orderSisaTracker[p.id] = p.totalTagihan - p.totalDibayar; });

    const allPaymentsChronological = [...(piutangPayments || [])]
        .filter(p => getLocalYMD(p?.date) <= dateTo)
        .sort((a,b) => new Date(a.date) - new Date(b.date));

    const paymentSisaMap = {};
    allPaymentsChronological.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        if (orderSisaTracker[pay.orderId] !== undefined) {
            orderSisaTracker[pay.orderId] -= amt;
            paymentSisaMap[pay.id] = orderSisaTracker[pay.orderId];
        }
    });

    const listPembayaranSemua = allPaymentsChronological
        .filter(p => isPeriod(p?.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(pay => {
            const isHutang = String(pay?.orderId || '').startsWith('BUY-');
            const relData = isHutang ? groupPurAll[pay.orderId] : groupOrdersAll[pay.orderId];
            let qtyStr = "-";
            if (relData && !isHutang) {
                const totalQty = (relData.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                qtyStr = `${totalQty} Pcs / ${totalQty/4} Prs`;
            } else if (relData && isHutang) {
                qtyStr = (relData.items || []).join(', ');
            }
            const sisaAkhir = paymentSisaMap[pay.id] || 0;
            return { ...pay, payId: pay.id, customer: relData ? (isHutang ? relData.supplier : relData.customer) : '-', tglInvoice: relData?.date || '-', qtyDesc: qtyStr, sisaTagihan: sisaAkhir, statusNota: sisaAkhir <= 0 ? 'LUNAS' : 'BELUM LUNAS', tipe: isHutang ? 'HUTANG' : 'PIUTANG' };
        });

    const listRiwayatPiutang = listPembayaranSemua.filter(p => p.tipe === 'PIUTANG');
    const listRiwayatHutang = listPembayaranSemua.filter(p => p.tipe === 'HUTANG');

    let inCashPeriode = 0, inTfPeriode = 0, outCashPeriode = 0, outTfPeriode = 0;
    const orderGroupsForPeriod = {}; periodOrdersPusat.forEach(o => { if(!o?.id) return; if(!orderGroupsForPeriod[o.id]) orderGroupsForPeriod[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 }; });
    Object.values(orderGroupsForPeriod).forEach(g => { const pm = processPaymentMethod(g.method, g.paid); inCashPeriode += pm.cash; inTfPeriode += pm.tf; }); 
    
    const purGroupsForPeriod = {}; periodPurchases.forEach(p => { if(!p?.id) return; if(!purGroupsForPeriod[p.id]) purGroupsForPeriod[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 }; });
    Object.values(purGroupsForPeriod).forEach(g => { const pm = processPaymentMethod(g.method, g.paid); outCashPeriode += pm.cash; outTfPeriode += pm.tf; });
    
    periodExpenses.forEach(e => { const t = Number(e.total) || 0; const isCash = String(e.paymentMethod).toLowerCase().includes('cash'); if (e.type === 'IN') { if (isCash) inCashPeriode += t; else inTfPeriode += t; } else { if (isCash) outCashPeriode += t; else outTfPeriode += t; } });
    listPembayaranSemua.forEach(pay => { const amt = Number(pay.amount) || 0; const isCash = String(pay.paymentMethod).toLowerCase().includes('cash'); if(pay.tipe === 'HUTANG') { if (isCash) outCashPeriode += amt; else outTfPeriode += amt; } else { if (isCash) inCashPeriode += amt; else inTfPeriode += amt; } });
    let setorPemalangPeriode = 0; cumPemalangReports.filter(p => isPeriod(p?.date)).forEach(p => { setorPemalangPeriode += (Number(p?.nominal) || 0); }); inTfPeriode += setorPemalangPeriode;

    const groupedTransaksiPusat = Object.values(periodOrdersPusat.reduce((acc, o) => { 
        if(!o?.id) return acc; 
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], totalTagihan: 0, dp: Number(o.paidAmount)||0, paymentMethod: o.paymentMethod, statusProduksi: o.statusProduksi || 'Menunggu Produksi' }; 
        acc[o.id].items.push(`${o.qty} Pcs`); 
        acc[o.id].totalTagihan += Number(o.total)||0; 
        return acc; 
    }, {})).map(grp => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const terbayar = grp.dp + cicilan;
        const sisa = grp.totalTagihan - terbayar;
        
        let status = 'BELUM BAYAR';
        if (sisa <= 0) status = 'LUNAS';
        else if (grp.statusProduksi === 'Sudah Diambil') status = 'PIUTANG';
        else if (terbayar > 0) status = 'DP';

        // Extract detailed payment history for print/display
        let allPayments = [];
        try { allPayments = JSON.parse(grp.paymentMethod); } catch(e) { if(grp.dp > 0) allPayments = [{ method: grp.paymentMethod, amount: grp.dp }]; }
        allPayments.push(...(piutangPayments || []).filter(p => p.orderId === grp.id).map(c => ({ method: c.paymentMethod, amount: c.amount })));

        return { ...grp, totalTerbayar: terbayar, sisaTagihan: sisa, status: status, allPayments };
    });

    const ops = {}; // Logic dihandle di TabStok

    return { saldoCash, saldoTF, saldoAkhir, inCashPeriode, inTfPeriode, outCashPeriode, outTfPeriode, setorPemalangPeriode, totalPenjualanKotor, totalPorsi, totalPcs, breakdownPorsi, totalPiutangBaru, totalHutangBaru, topCustomersList, finalChartData, listPiutangBerjalan, listHutangBerjalan, listTransaksiDetail: groupedTransaksiPusat, listPembelianDetail: periodPurchases, listExpenses: periodExpenses, listPemalang: cumPemalangReports.filter(p => isPeriod(p.date)), listPembayaranSemua, listRiwayatPiutang, listRiwayatHutang, ops };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo, chartView]);
}
