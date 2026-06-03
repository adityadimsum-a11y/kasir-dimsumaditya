import React, { useState, useMemo } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, TrendingUp, ArrowRightLeft, Users, ShoppingCart, AlertCircle, Clock, Package } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatRp, formatDate } from '../../utils/helpers';
import SimpleSVGLineChart from '../ui/SimpleSVGLineChart';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90">{title}</h3><div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div></div>
    <div className="text-2xl font-bold tracking-tight">{formatRp(amount)}</div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, setPrintData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const rekap = useMemo(() => {
    const isCumulative = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) <= dateTo;
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const cumOrdersPusat = (orders || []).filter(o => isCumulative(o?.date) && o?.category !== 'Pemalang');
    const cumPurchases = (purchases || []).filter(p => isCumulative(p?.date));
    const cumExpenses = (expenses || []).filter(e => isCumulative(e?.date));
    const cumPayments = (piutangPayments || []).filter(p => isCumulative(p?.date));
    const cumPemalangReports = (pemalangReports || []).filter(p => isCumulative(p?.date));

    let kasMasukCash = 0, kasMasukTF = 0, kasKeluarCash = 0, kasKeluarTF = 0;
    
    const groupedOrdersCum = {};
    cumOrdersPusat.forEach(o => { if(!o?.id) return; if(!groupedOrdersCum[o.id]) groupedOrdersCum[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 }; });
    Object.values(groupedOrdersCum).forEach(o => { if(o.method === 'Cash') kasMasukCash += o.paid; else if(o.method === 'Transfer') kasMasukTF += o.paid; });

    const groupedPurCum = {};
    cumPurchases.forEach(p => { if(!p?.id) return; if(!groupedPurCum[p.id]) groupedPurCum[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 }; });
    Object.values(groupedPurCum).forEach(p => { if(p.method === 'Cash') kasKeluarCash += p.paid; else if(p.method === 'Transfer') kasKeluarTF += p.paid; });

    cumExpenses.forEach(e => { const t = Number(e.total) || 0; if (e.type === 'IN') { if (e.paymentMethod === 'Cash') kasMasukCash += t; else kasMasukTF += t; } else { if (e.paymentMethod === 'Cash') { kasKeluarCash += t; } else { kasKeluarTF += t; } } });

    cumPayments.forEach(pay => { const amt = Number(pay.amount) || 0; const isMembayarHutangBeli = String(pay?.orderId || '').startsWith('BUY-'); if(isMembayarHutangBeli) { if (pay.paymentMethod === 'Cash') kasKeluarCash += amt; else kasKeluarTF += amt; } else { if (pay.paymentMethod === 'Cash') kasMasukCash += amt; else kasMasukTF += amt; } });

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

    const groupOrdersAll = {}; (orders || []).filter(o => o?.category !== 'Pemalang').forEach(o => { if(!o?.id) return; if(!groupOrdersAll[o.id]) groupOrdersAll[o.id] = { ...o, items: [], totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0 }; groupOrdersAll[o.id].items.push(`${o.qty} Pcs`); groupOrdersAll[o.id].totalTagihan += Number(o.total)||0; });
    const groupPurAll = {}; (purchases || []).forEach(p => { if(!p?.id) return; if(!groupPurAll[p.id]) groupPurAll[p.id] = { ...p, items: [], totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0 }; groupPurAll[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`); groupPurAll[p.id].totalTagihan += Number(p.total)||0; });

    const listPiutangBerjalan = Object.values(groupOrdersAll).map(grp => { const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan }; }).filter(o => o.sisaHutang > 0);
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
    Object.values(orderGroupsForPeriod).forEach(g => { if(g.method === 'Cash') inCashPeriode += g.paid; else if(g.method === 'Transfer') inTfPeriode += g.paid; }); 
    const purGroupsForPeriod = {}; periodPurchases.forEach(p => { if(!p?.id) return; if(!purGroupsForPeriod[p.id]) purGroupsForPeriod[p.id] = { paid: Number(p.paidAmount)||0, method: p.paymentMethod }; });
    Object.values(purGroupsForPeriod).forEach(g => { if(g.method === 'Cash') outCashPeriode += g.paid; else if(g.method === 'Transfer') outTfPeriode += g.paid; });
    periodExpenses.forEach(e => { const t = Number(e.total) || 0; if (e.type === 'IN') { if (e.paymentMethod === 'Cash') inCashPeriode += t; else inTfPeriode += t; } else { if (e.paymentMethod === 'Cash') outCashPeriode += t; else outTfPeriode += t; } });
    listPembayaranSemua.forEach(pay => { const amt = Number(pay.amount) || 0; if(pay.tipe === 'HUTANG') { if (pay.paymentMethod === 'Cash') outCashPeriode += amt; else outTfPeriode += amt; } else { if (pay.paymentMethod === 'Cash') inCashPeriode += amt; else inTfPeriode += amt; } });
    let setorPemalangPeriode = 0; cumPemalangReports.filter(p => isPeriod(p?.date)).forEach(p => { setorPemalangPeriode += (Number(p?.nominal) || 0); }); inTfPeriode += setorPemalangPeriode;

    const groupedTransaksiPusat = Object.values(periodOrdersPusat.reduce((acc, o) => { 
        if(!o?.id) return acc; 
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], totalTagihan: 0, dp: Number(o.paidAmount)||0, paymentMethod: o.paymentMethod }; 
        acc[o.id].items.push(`${o.qty} Pcs`); 
        acc[o.id].totalTagihan += Number(o.total)||0; 
        return acc; 
    }, {})).map(grp => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const terbayar = grp.dp + cicilan;
        const sisa = grp.totalTagihan - terbayar;
        return { ...grp, totalTerbayar: terbayar, sisaTagihan: sisa, status: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS' };
    });

    return { saldoCash, saldoTF, saldoAkhir, inCashPeriode, inTfPeriode, outCashPeriode, outTfPeriode, setorPemalangPeriode, totalPenjualanKotor, totalPorsi, totalPcs, breakdownPorsi, totalPiutangBaru, totalHutangBaru, topCustomersList, finalChartData, listPiutangBerjalan, listHutangBerjalan, listTransaksiDetail: groupedTransaksiPusat, listPembelianDetail: periodPurchases, listExpenses: periodExpenses, listPemalang: cumPemalangReports.filter(p => isPeriod(p.date)), listPembayaranSemua, listRiwayatPiutang, listRiwayatHutang };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, dateFrom, dateTo, chartView]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Laporan & Cetak</h3><div className="flex gap-2"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg" /><span className="text-slate-400 self-center">s/d</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg" /></div></div>
          <button onClick={() => setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 text-sm font-medium"><Printer size={16} /> Cetak Rekap Pusat</button>
      </div>

      <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Saldo Berjalan (Akumulasi Aktif)</h2>
          <p className="text-xs text-slate-500 mb-4">*Dihitung otomatis terus-menerus (continue) sampai dengan {formatDate(dateTo)}.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" /><StatCard title="Saldo Tunai (CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" /><StatCard title="Saldo Rekening (TF)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" /></div>
      </div>

      {/* ========================================================================= */}
      {/* BAGIAN BARU: DAFTAR PEMBELIAN BAHAN BAKU & KAS PEGANGAN ADMIN DI DASHBOARD UI */}
      {/* ========================================================================= */}
      
      <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-700"><ShoppingCart size={20}/> Transaksi Pembelian Bahan Baku</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-indigo-50 border-b border-indigo-100">
                      <tr><th className="px-3 py-2 text-indigo-800">Tgl & Inv</th><th className="px-3 py-2 text-indigo-800">Supplier</th><th className="px-3 py-2 text-indigo-800">Barang & Qty</th><th className="px-3 py-2 text-center text-indigo-800">Via</th><th className="px-3 py-2 text-right text-indigo-800">Total</th><th className="px-3 py-2 text-right text-indigo-800">Terbayar</th><th className="px-3 py-2 text-right text-indigo-800">Sisa</th><th className="px-3 py-2 text-center text-indigo-800">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap?.listPembelianDetail || rekap.listPembelianDetail.length === 0) ? (
                          <tr><td colSpan="8" className="text-center py-6 text-slate-400">Tidak ada data pembelian di periode ini.</td></tr>
                      ) : (
                          rekap.listPembelianDetail.map((c, i) => {
                              const sisa = Number(c?.total || 0) - Number(c?.paidAmount || 0);
                              const status = sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS';
                              return (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(c?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{c?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{c?.supplier || '-'}</td>
                                  <td className="px-3 py-2 text-xs uppercase">{c?.itemName || '-'} ({c?.qty || 0} {c?.satuan || '-'})</td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{c?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatRp(c?.total)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatRp(c?.paidAmount)}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">{formatRp(sisa)}</td>
                                  <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{status}</span>
                                  </td>
                              </tr>
                          )})
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Wallet size={20}/> Riwayat Kas Pegangan Admin (Pengeluaran Lainnya)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                      <tr><th className="px-3 py-2 text-slate-800">Tgl & Ref</th><th className="px-3 py-2 text-slate-800">Penerima</th><th className="px-3 py-2 text-slate-800">Kategori & Keterangan</th><th className="px-3 py-2 text-center text-slate-800">Via</th><th className="px-3 py-2 text-right text-slate-800">Nominal</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap?.listExpenses || rekap.listExpenses.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada data pengeluaran kas di periode ini.</td></tr>
                      ) : (
                          rekap.listExpenses.map((o, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{o?.recipient || '-'}</td>
                                  <td className="px-3 py-2"><div className="font-bold text-slate-800 uppercase">{o?.category || '-'}</div><div className="text-xs text-slate-600">{o?.description || '-'}</div></td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{o?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">-{formatRp(o?.total)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      {/* ========================================================================= */}

      {(rekap.listPiutangBerjalan.length > 0 || rekap.listHutangBerjalan.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-700"><AlertCircle size={20}/> Daftar Piutang Berjalan (Belum Lunas)</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-orange-50 border-b border-orange-100">
                              <tr><th className="px-3 py-2 text-orange-800">Tgl & Inv</th><th className="px-3 py-2 text-orange-800">Pelanggan</th><th className="px-3 py-2 text-right text-orange-800">Sisa Tagihan</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {rekap.listPiutangBerjalan.map((p, i) => {
                                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                                  return (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-400 font-mono">{p.id}</div></td>
                                      <td className="px-3 py-2 font-bold uppercase text-xs">{p.customer}</td>
                                      <td className="px-3 py-2 text-right">
                                          <div className="font-black text-red-600">{formatRp(p.sisaHutang)}</div>
                                          {isNew && <span className="inline-block mt-0.5 text-[9px] font-black text-orange-600 bg-orange-100 px-1 rounded">(PIUTANG BARU)</span>}
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-700"><AlertCircle size={20}/> Daftar Hutang Berjalan (Belum Lunas)</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-red-50 border-b border-red-100">
                              <tr><th className="px-3 py-2 text-red-800">Tgl & Inv</th><th className="px-3 py-2 text-red-800">Supplier</th><th className="px-3 py-2 text-right text-red-800">Sisa Hutang</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {rekap.listHutangBerjalan.map((p, i) => {
                                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                                  return (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-400 font-mono">{p.id}</div></td>
                                      <td className="px-3 py-2 font-bold uppercase text-xs">{p.supplier}</td>
                                      <td className="px-3 py-2 text-right">
                                          <div className="font-black text-red-600">{formatRp(p.sisaHutang)}</div>
                                          {isNew && <span className="inline-block mt-0.5 text-[9px] font-black text-red-600 bg-red-100 px-1 rounded">(HUTANG BARU)</span>}
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-700"><Clock size={20}/> Riwayat Terima Piutang (Pelanggan)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-emerald-50 border-b border-emerald-100">
                        <tr><th className="px-3 py-2 text-emerald-800">Tgl & Ref</th><th className="px-3 py-2 text-emerald-800">Pelanggan</th><th className="px-3 py-2 text-center text-emerald-800">Via</th><th className="px-3 py-2 text-right text-emerald-800">Nominal Masuk</th><th className="px-3 py-2 text-right text-emerald-800">Sisa Tagihan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rekap.listRiwayatPiutang.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada riwayat piutang.</td></tr>}
                        {rekap.listRiwayatPiutang.map((pay, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(pay.date)}</div><div className="text-[10px] text-slate-400 font-mono">{pay.orderId}</div></td>
                                <td className="px-3 py-2 font-bold uppercase text-xs">{pay.customer}</td>
                                <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{pay.paymentMethod}</td>
                                <td className="px-3 py-2 text-right font-black text-emerald-600">+{formatRp(pay.amount)}</td>
                                <td className="px-3 py-2 text-right">
                                    <div className={`font-bold ${pay.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pay.sisaTagihan <= 0 ? 'Rp 0' : formatRp(pay.sisaTagihan)}</div>
                                    <div className={`text-[9px] font-bold ${pay.statusNota === 'LUNAS' ? 'text-emerald-500' : 'text-orange-500'}`}>{pay.statusNota}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-700"><Clock size={20}/> Riwayat Bayar Hutang (Supplier)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-red-50 border-b border-red-100">
                        <tr><th className="px-3 py-2 text-red-800">Tgl & Ref</th><th className="px-3 py-2 text-red-800">Supplier</th><th className="px-3 py-2 text-center text-red-800">Via</th><th className="px-3 py-2 text-right text-red-800">Nominal Keluar</th><th className="px-3 py-2 text-right text-red-800">Sisa Hutang</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rekap.listRiwayatHutang.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada riwayat hutang.</td></tr>}
                        {rekap.listRiwayatHutang.map((pay, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(pay.date)}</div><div className="text-[10px] text-slate-400 font-mono">{pay.orderId}</div></td>
                                <td className="px-3 py-2 font-bold uppercase text-xs">{pay.customer}</td>
                                <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{pay.paymentMethod}</td>
                                <td className="px-3 py-2 text-right font-black text-red-600">-{formatRp(pay.amount)}</td>
                                <td className="px-3 py-2 text-right">
                                    <div className={`font-bold ${pay.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pay.sisaTagihan <= 0 ? 'Rp 0' : formatRp(pay.sisaTagihan)}</div>
                                    <div className={`text-[9px] font-bold ${pay.statusNota === 'LUNAS' ? 'text-emerald-500' : 'text-orange-500'}`}>{pay.statusNota}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div><h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-blue-800"><ArrowRightLeft size={20}/> Arus Uang Masuk & Keluar</h3><p className="text-xs text-slate-500 mb-4 border-b pb-2">Khusus periode {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100"><div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Masuk (Cash)</div><div className="text-lg font-black text-emerald-600">+{formatRp(rekap.inCashPeriode)}</div></div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100"><div className="text-[10px] font-bold text-indigo-700 uppercase mb-1">Total Masuk (Transfer)</div><div className="text-lg font-black text-indigo-600">+{formatRp(rekap.inTfPeriode)}</div><div className="text-[9px] text-indigo-500 mt-1">Termasuk TF Cabang: {formatRp(rekap.setorPemalangPeriode)}</div></div>
                <div className="bg-red-50 p-3 rounded border border-red-100"><div className="text-[10px] font-bold text-red-700 uppercase mb-1">Total Keluar (Cash)</div><div className="text-lg font-black text-red-600">-{formatRp(rekap.outCashPeriode)}</div></div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100"><div className="text-[10px] font-bold text-orange-700 uppercase mb-1">Total Keluar (Transfer)</div><div className="text-lg font-black text-orange-600">-{formatRp(rekap.outTfPeriode)}</div></div>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[340px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas (Periode Ini)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {(!rekap?.topCustomersList || rekap.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>
               ) : (
                   rekap.topCustomersList.map((cust, i) => (<div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div><div><div className="font-bold text-slate-800">{cust.name}</div><div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div></div></div><div className="font-bold text-emerald-600">{formatRp(cust.total)}</div></div>))
               )}
            </div>
        </div>
      </div>
    </div>
  );
}
