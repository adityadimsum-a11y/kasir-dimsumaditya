import { useMemo } from 'react';
import { getLocalYMD } from '../utils/helpers';

export default function useDashboardBranch({ 
  orders, pemalangReports, piutangPayments, stokData, 
  dateFrom, dateTo, chartView 
}) {
  const stokAktual = useMemo(() => {
    const calc = {};
    (stokData || []).forEach(s => {
      const nama = String(s?.itemName||'').toUpperCase();
      if(!calc[nama]) calc[nama] = { masuk: 0, keluar: 0, terpakai: 0, sisa: 0, satuan: s.satuan || 'PCS' };
      if(s.type === 'MASUK') calc[nama].masuk += Number(s.qty) || 0;
      else if(s.type === 'KELUAR') calc[nama].keluar += Number(s.qty) || 0;
      else if(s.type === 'TERPAKAI') calc[nama].terpakai += Number(s.qty) || 0;
      calc[nama].sisa = calc[nama].masuk - calc[nama].keluar - calc[nama].terpakai;
    });
    return calc;
  }, [stokData]);

  const rekap = useMemo(() => {
    const isDateInRange = (dateStr) => { const ymd = getLocalYMD(dateStr); if(!ymd) return false; return ymd >= dateFrom && ymd <= dateTo; };
    const filteredOrders = (orders || []).filter(o => isDateInRange(o?.date) && o?.category === 'Pemalang');
    const filteredReports = (pemalangReports || []).filter(p => isDateInRange(p?.date));

    let totalPenjualanKotor = 0, setoranKePusat = 0, totalPorsi = 0, totalPcs = 0, totalPiutangBaru = 0; 
    const breakdownPorsi = {}; const customerMap = {}; const chartDataMap = {}; 

    filteredOrders.forEach(order => {
      if(!order?.id) return;
      const qtyNum = Number(order.qty) || 0; const totalNum = Number(order.total) || 0;
      totalPcs += qtyNum; const porsiOrder = (qtyNum / 4); totalPorsi += porsiOrder; totalPenjualanKotor += totalNum;
      
      if(order.category) breakdownPorsi[order.category] = (breakdownPorsi[order.category] || 0) + porsiOrder;
      const custName = String(order.customer || '').toUpperCase();
      if(!customerMap[custName]) customerMap[custName] = { name: custName, qty: 0, porsi: 0, total: 0, frequency: 0 };
      customerMap[custName].qty += qtyNum; customerMap[custName].porsi += porsiOrder; customerMap[custName].total += totalNum; customerMap[custName].frequency += 1;

      let chartKey = ''; const orderDate = new Date(order.date);
      if(!isNaN(orderDate.getTime())) {
          if(chartView === 'daily') chartKey = orderDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); 
          else if (chartView === 'monthly') chartKey = orderDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }); 
          else chartKey = String(orderDate.getFullYear()); 
      } else chartKey = String(order.date).split('T')[0];
      chartDataMap[chartKey] = (chartDataMap[chartKey] || 0) + totalNum;
    });
    
    const orderGroups = {};
    const branchOrdersAll = (orders || []).filter(o => o?.category === 'Pemalang');
    const branchOrderIds = branchOrdersAll.map(o => o.id);

    branchOrdersAll.forEach(o => { if(!o?.id) return; if(!orderGroups[o.id]) orderGroups[o.id] = { total:0, paid: Number(o.paidAmount)||0, items: [], paymentMethod: o.paymentMethod, date: o.date, customer: o.customer, id: o.id }; orderGroups[o.id].total += Number(o.total)||0; orderGroups[o.id].items.push(`${o.qty} Pcs`); });
    
    const branchPayments = (piutangPayments || []).filter(p => branchOrderIds.includes(p.orderId));
    const allPaymentsChronological = [...branchPayments].filter(p => getLocalYMD(p?.date) <= dateTo).sort((a,b) => new Date(a.date) - new Date(b.date));
    
    const orderSisaTracker = {};
    branchOrdersAll.forEach(o => { orderSisaTracker[o.id] = (Number(o.total)||0) - (Number(o.paidAmount)||0); });
    
    const paymentSisaMap = {};
    allPaymentsChronological.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        if (orderSisaTracker[pay.orderId] !== undefined) {
            orderSisaTracker[pay.orderId] -= amt;
            paymentSisaMap[pay.id] = orderSisaTracker[pay.orderId];
        }
    });

    const listRiwayatPiutang = allPaymentsChronological
        .filter(p => isDateInRange(p?.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(pay => {
            const relData = branchOrdersAll.find(o => o.id === pay.orderId);
            let qtyStr = "-";
            if (relData) {
                const totalQty = (orderGroups[relData.id]?.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                qtyStr = `${totalQty} Pcs / ${totalQty/4} Prs`;
            }
            const sisaAkhir = paymentSisaMap[pay.id] || 0;
            return { 
                ...pay, 
                payId: pay.id, 
                customer: relData ? relData.customer : '-', 
                tglInvoice: relData?.date || '-',
                qtyDesc: qtyStr,
                sisaTagihan: sisaAkhir,
                statusNota: sisaAkhir <= 0 ? 'LUNAS' : 'BELUM LUNAS'
            };
        });

    const listPiutangBerjalan = Object.values(orderGroups).map(grp => { const cicilan = branchPayments.filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.total - grp.paid - cicilan }; }).filter(o => o.sisaHutang > 0);
    totalPiutangBaru = listPiutangBerjalan.reduce((sum, item) => sum + (item.sisaHutang || 0), 0);

    filteredReports.forEach(p => { setoranKePusat += (Number(p?.nominal) || 0); });
    const finalChartData = Object.keys(chartDataMap).map(key => ({ label: key, value: chartDataMap[key] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const groupedTransaksiCabang = Object.values(filteredOrders.reduce((acc, o) => {
        if(!o?.id) return acc;
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], totalTagihan: 0, dp: Number(o.paidAmount)||0, paymentMethod: o.paymentMethod };
        acc[o.id].items.push(`${o.qty} Pcs`);
        acc[o.id].totalTagihan += Number(o.total)||0;
        return acc;
    }, {})).map(grp => {
        const cicilan = branchPayments.filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const terbayar = grp.dp + cicilan;
        const sisa = grp.totalTagihan - terbayar;
        return { ...grp, totalTerbayar: terbayar, sisaTagihan: sisa, status: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS' };
    });

    return { totalPenjualanKotor, setoranKePusat, totalPorsi, totalPcs, totalPiutangBaru, breakdownPorsi, topCustomersList, finalChartData, listOrders: groupedTransaksiCabang, listReports: filteredReports, listRiwayatPiutang, listPiutangBerjalan };
  }, [orders, pemalangReports, piutangPayments, dateFrom, dateTo, chartView]);

  return { stokAktual, rekap };
}
