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

    // PERHITUNGAN KEUANGAN KAS
    let kasMasukCash = 0, kasMasukTF = 0, kasKeluarCash = 0, kasKeluarTF = 0;
    
    const groupedOrdersCum = {};
    cumOrdersPusat.forEach(o => { if(!o?.id) return; if(!groupedOrdersCum[o.id]) groupedOrdersCum[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 }; });
    Object.values(groupedOrdersCum).forEach(o => { if(o.method === 'Cash / Tunai') kasMasukCash += o.paid; else kasMasukTF += o.paid; });

    const groupedPurCum = {};
    cumPurchases.forEach(p => { if(!p?.id) return; if(!groupedPurCum[p.id]) groupedPurCum[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 }; });
    Object.values(groupedPurCum).forEach(p => { if(p.method === 'Cash / Tunai' || p.method === 'Cash') kasKeluarCash += p.paid; else kasKeluarTF += p.paid; });

    cumExpenses.forEach(e => { const t = Number(e.total) || 0; if (e.type === 'IN') { if (e.paymentMethod === 'Cash' || e.paymentMethod === 'Cash / Tunai') kasMasukCash += t; else kasMasukTF += t; } else { if (e.paymentMethod === 'Cash' || e.paymentMethod === 'Cash / Tunai') { kasKeluarCash += t; } else { kasKeluarTF += t; } } });

    cumPayments.forEach(pay => { const amt = Number(pay.amount) || 0; const isMembayarHutangBeli = String(pay?.orderId || '').startsWith('BUY-'); if(isMembayarHutangBeli) { if (pay.paymentMethod === 'Cash' || pay.paymentMethod === 'Cash / Tunai') kasKeluarCash += amt; else kasKeluarTF += amt; } else { if (pay.paymentMethod === 'Cash' || pay.paymentMethod === 'Cash / Tunai') kasMasukCash += amt; else kasMasukTF += amt; } });

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
    const orderGroupsForPeriod = {}; periodOrdersPusat.forEach(o => { if(!o?.id) return; if(!orderGroupsForPeriod[o.id]) orderGroupsForPeriod[o.id] = { paid: Number(o.paidAmount)||0, method: o.paymentMethod }; });
    Object.values(orderGroupsForPeriod).forEach(g => { if(g.method === 'Cash / Tunai' || g.method === 'Cash') inCashPeriode += g.paid; else inTfPeriode += g.paid; }); 
    const purGroupsForPeriod = {}; periodPurchases.forEach(p => { if(!p?.id) return; if(!purGroupsForPeriod[p.id]) purGroupsForPeriod[p.id] = { paid: Number(p.paidAmount)||0, method: p.paymentMethod }; });
    Object.values(purGroupsForPeriod).forEach(g => { if(g.method === 'Cash / Tunai' || g.method === 'Cash') outCashPeriode += g.paid; else outTfPeriode += g.paid; });
    periodExpenses.forEach(e => { const t = Number(e.total) || 0; if (e.type === 'IN') { if (e.paymentMethod === 'Cash' || e.paymentMethod === 'Cash / Tunai') inCashPeriode += t; else inTfPeriode += t; } else { if (e.paymentMethod === 'Cash' || e.paymentMethod === 'Cash / Tunai') outCashPeriode += t; else outTfPeriode += t; } });
    listPembayaranSemua.forEach(pay => { const amt = Number(pay.amount) || 0; if(pay.tipe === 'HUTANG') { if (pay.paymentMethod === 'Cash' || pay.paymentMethod === 'Cash / Tunai') outCashPeriode += amt; else outTfPeriode += amt; } else { if (pay.paymentMethod === 'Cash' || pay.paymentMethod === 'Cash / Tunai') inCashPeriode += amt; else inTfPeriode += amt; } });
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

        return { ...grp, totalTerbayar: terbayar, sisaTagihan: sisa, status: status };
    });

    const ops = {}; // Logic dihandle di TabStok

    return { saldoCash, saldoTF, saldoAkhir, inCashPeriode, inTfPeriode, outCashPeriode, outTfPeriode, setorPemalangPeriode, totalPenjualanKotor, totalPorsi, totalPcs, breakdownPorsi, totalPiutangBaru, totalHutangBaru, topCustomersList, finalChartData, listPiutangBerjalan, listHutangBerjalan, listTransaksiDetail: groupedTransaksiPusat, listPembelianDetail: periodPurchases, listExpenses: periodExpenses, listPemalang: cumPemalangReports.filter(p => isPeriod(p.date)), listPembayaranSemua, listRiwayatPiutang, listRiwayatHutang, ops };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo, chartView]);
}
