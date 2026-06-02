import React, { useState, useMemo } from 'react';
import { 
  Calendar, Printer, Wallet, Coins, CreditCard, 
  TrendingUp, ArrowRightLeft, Users, ShoppingCart, Truck 
} from 'lucide-react';
import { getTodayStr, getFirstDayOfMonthStr, getLocalYMD, formatRp, formatDate } from '../../utils/helpers';
import SimpleSVGLineChart from '../ui/SimpleSVGLineChart';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4">
      <h3 className="font-medium text-sm opacity-90">{title}</h3>
      <div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div>
    </div>
    <div className="text-2xl font-bold tracking-tight">{formatRp(amount)}</div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, setPrintData }) {
  const todayStr = getTodayStr();
  // FILTER DEFAULT SEKARANG DIAMBIL DARI TANGGAL 1 BULAN INI
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const rekap = useMemo(() => {
    const isCumulative = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) <= dateTo;
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    const cumOrdersPusat = (orders || []).filter(o => isCumulative(o.date) && o.category !== 'Pemalang');
    const cumPurchases = (purchases || []).filter(p => isCumulative(p.date));
    const cumExpenses = (expenses || []).filter(e => isCumulative(e.date));
    const cumPayments = (piutangPayments || []).filter(p => isCumulative(p.date));
    const cumPemalangReports = (pemalangReports || []).filter(p => isCumulative(p.date));

    let kasMasukCash = 0, kasMasukTF = 0, kasKeluarCash = 0, kasKeluarTF = 0;
    let totalBebanTunai = 0, totalClosingTunai = 0;

    const groupedOrdersCum = {};
    cumOrdersPusat.forEach(o => {
        if(!o?.id) return;
        if(!groupedOrdersCum[o.id]) groupedOrdersCum[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 };
    });
    Object.values(groupedOrdersCum).forEach(o => {
        if(o.method === 'Cash') kasMasukCash += o.paid; else if(o.method === 'Transfer') kasMasukTF += o.paid;
    });

    const groupedPurCum = {};
    cumPurchases.forEach(p => {
        if(!p?.id) return;
        if(!groupedPurCum[p.id]) groupedPurCum[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 };
    });
    Object.values(groupedPurCum).forEach(p => {
        if(p.method === 'Cash') kasKeluarCash += p.paid; else if(p.method === 'Transfer') kasKeluarTF += p.paid;
    });

    cumExpenses.forEach(e => {
        const t = Number(e.total) || 0;
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') kasMasukCash += t; else kasMasukTF += t;
        } else {
            if (e.paymentMethod === 'Cash') {
                kasKeluarCash += t;
                if(e.category === 'Setoran / Closing Kas Harian') totalClosingTunai += t;
                else totalBebanTunai += t;
            } else {
                kasKeluarTF += t;
            }
        }
    });

    cumPayments.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        const isMembayarHutangBeli = String(pay?.orderId || '').startsWith('BUY-');
        if(isMembayarHutangBeli) {
            if (pay.paymentMethod === 'Cash') kasKeluarCash += amt; else kasKeluarTF += amt;
        } else {
            if (pay.paymentMethod === 'Cash') kasMasukCash += amt; else kasMasukTF += amt;
        }
    });

    let setoranPemalangTF = 0;
    cumPemalangReports.forEach(p => { setoranPemalangTF += (Number(p?.nominal) || 0); });

    const saldoCash = kasMasukCash - kasKeluarCash;
    const saldoTF = (kasMasukTF + setoranPemalangTF) - kasKeluarTF;
    const saldoAkhir = saldoCash + saldoTF;

    // METRIK PERIODE FILTER
    const periodOrdersPusat = cumOrdersPusat.filter(o => isPeriod(o.date));
    const periodPurchases = cumPurchases.filter(p => isPeriod(p.date));
    const periodExpenses = cumExpenses.filter(e => isPeriod(e.date));
    
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

    const orderGroups = {};
    periodOrdersPusat.forEach(o => {
        if(!o?.id) return;
        if(!orderGroups[o.id]) orderGroups[o.id] = { total:0, paid: Number(o.paidAmount)||0, method: o.paymentMethod };
        orderGroups[o.id].total += Number(o.total)||0;
    });
    Object.values(orderGroups).forEach(g => { if(g.total - g.paid > 0) totalPiutangBaru += (g.total - g.paid); });

    const purGroups = {};
    periodPurchases.forEach(p => {
        if(!p?.id) return;
        if(!purGroups[p.id]) purGroups[p.id] = { total:0, paid: Number(p.paidAmount)||0, method: p.paymentMethod };
        purGroups[p.id].total += Number(p.total)||0;
    });
    Object.values(purGroups).forEach(g => { if(g.total - g.paid > 0) totalHutangBaru += (g.total - g.paid); });

    const finalChartData = Object.keys(chartDataMap).map(k => ({ label: k, value: chartDataMap[k] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const groupOrdersAll = {};
    (orders || []).filter(o => o?.category !== 'Pemalang').forEach(o => {
        if(!o?.id) return;
        if(!groupOrdersAll[o.id]) groupOrdersAll[o.id] = { ...o, items: [], totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0 };
        groupOrdersAll[o.id].items.push(`${o.qty} Pcs`);
        groupOrdersAll[o.id].totalTagihan += Number(o.total)||0;
    });
    const listPiutangBerjalan = Object.values(groupOrdersAll).map(grp => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
    }).filter(o => o.sisaHutang > 0);

    const groupPurAll = {};
    (purchases || []).forEach(p => {
        if(!p?.id) return;
        if(!groupPurAll[p.id]) groupPurAll[p.id] = { ...p, items: [], totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0 };
        groupPurAll[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
        groupPurAll[p.id].totalTagihan += Number(p.total)||0;
    });
    const listHutangBerjalan = Object.values(groupPurAll).map(grp => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
    }).filter(p => p.sisaHutang > 0);

    const listPembayaranSemua = (cumPayments || []).filter(p => isPeriod(p.date)).map(pay => {
        const isHutang = String(pay?.orderId || '').startsWith('BUY-');
        const relData = isHutang ? groupPurAll[pay.orderId] : groupOrdersAll[pay.orderId];
        const cicilan = (piutangPayments || []).filter(p=>p.orderId===pay.orderId).reduce((s,p)=>s+(Number(p.amount)||0), 0);
        const sisa = (Number(relData?.totalTagihan)||0) - (Number(relData?.totalDibayar)||0) - cicilan;
        return { ...pay, customer: relData ? (isHutang ? relData.supplier : relData.customer) : '-', statusNota: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS', tipe: isHutang ? 'HUTANG' : 'PIUTANG' };
    });

    let inCashPeriode = 0, inTfPeriode = 0, outCashPeriode = 0, outTfPeriode = 0;
    Object.values(orderGroups).forEach(g => { if(g.method === 'Cash') inCashPeriode += g.paid; else if(g.method === 'Transfer') inTfPeriode += g.paid; });
    Object.values(purGroups).forEach(g => { if(g.method === 'Cash') outCashPeriode += g.paid; else if(g.method === 'Transfer') outTfPeriode += g.paid; });

    periodExpenses.forEach(e => {
        const t = Number(e.total) || 0;
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') inCashPeriode += t; else inTfPeriode += t;
        } else {
            if (e.paymentMethod === 'Cash') outCashPeriode += t; else outTfPeriode += t;
        }
    });
    listPembayaranSemua.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        if(pay.tipe === 'HUTANG') {
            if (pay.paymentMethod === 'Cash') outCashPeriode += amt; else outTfPeriode += amt;
        } else {
            if (pay.paymentMethod === 'Cash') inCashPeriode += amt; else inTfPeriode += amt;
        }
    });

    let setorPemalangPeriode = 0;
    cumPemalangReports.filter(p => isPeriod(p.date)).forEach(p => { setorPemalangPeriode += (Number(p?.nominal) || 0); });
    inTfPeriode += setorPemalangPeriode;

    const groupedTransaksiPusat = Object.values(periodOrdersPusat.reduce((acc, o) => {
        if(!o?.id) return acc;
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], total: 0 };
        acc[o.id].items.push(`${o.qty} Pcs`);
        acc[o.id].total += Number(o.total)||0;
        return acc;
    }, {}));

    return {
        saldoCash, saldoTF, saldoAkhir, totalBebanTunai, totalClosingTunai,
        inCashPeriode, inTfPeriode, outCashPeriode, outTfPeriode, setorPemalangPeriode,
        totalPenjualanKotor, totalPorsi, totalPcs, breakdownPorsi, totalPiutangBaru, totalHutangBaru,
        topCustomersList, finalChartData, listPiutangBerjalan, listHutangBerjalan,
        listTransaksiDetail: groupedTransaksiPusat, listPembelianDetail: periodPurchases, 
        listExpenses: periodExpenses, listPemalang: cumPemalangReports.filter(p => isPeriod(p.date)), listPembayaranSemua
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, dateFrom, dateTo, chartView]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Laporan & Cetak</h3>
              <div className="flex gap-2">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
                  <span className="text-slate-400 self-center">s/d</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
              </div>
          </div>
          <button onClick={() => setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 text-sm font-medium">
              <Printer size={16} /> Cetak Rekap Pusat
          </button>
      </div>

      <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Saldo Berjalan (Akumulasi Aktif)</h2>
          <p className="text-xs text-slate-500 mb-4">*Dihitung otomatis terus-menerus (continue) sampai dengan {formatDate(dateTo)}.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Saldo Tunai (CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Saldo Rekening (TF)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><TrendingUp size={20} className="text-red-500"/> Metrik Pergerakan Omset</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button onClick={()=>setChartView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='daily'?'bg-white shadow text-red-600':'text-slate-500'}`}>Harian</button>
               <button onClick={()=>setChartView('monthly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='monthly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Bulanan</button>
            </div>
         </div>
         <div className="w-full h-56 mt-4 relative min-w-[500px]">
             {rekap.finalChartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 border border-dashed rounded-xl">Belum ada data di periode ini.</div>
             ) : (
                <SimpleSVGLineChart data={rekap.finalChartData} />
             )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-emerald-800"><ArrowRightLeft size={20}/> Arus Uang Masuk & Keluar</h3>
            <p className="text-xs text-slate-500 mb-4 border-b pb-2">Khusus periode {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Masuk (Cash)</div>
                    <div className="text-lg font-black text-emerald-600">+{formatRp(rekap.inCashPeriode)}</div>
                </div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase mb-1">Total Masuk (Transfer)</div>
                    <div className="text-lg font-black text-indigo-600">+{formatRp(rekap.inTfPeriode)}</div>
                    <div className="text-[9px] text-indigo-500 mt-1">Termasuk TF Cabang: {formatRp(rekap.setorPemalangPeriode)}</div>
                </div>
                <div className="bg-red-50 p-3 rounded border border-red-100">
                    <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Total Keluar (Cash)</div>
                    <div className="text-lg font-black text-red-600">-{formatRp(rekap.outCashPeriode)}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100">
                    <div className="text-[10px] font-bold text-orange-700 uppercase mb-1">Total Keluar (Transfer)</div>
                    <div className="text-lg font-black text-orange-600">-{formatRp(rekap.outTfPeriode)}</div>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[340px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas (Periode Ini)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {rekap.topCustomersList.map((cust, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>
                           #{i+1}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800">{cust.name}</div>
                           <div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div>
                        </div>
                     </div>
                     <div className="font-bold text-emerald-600">{formatRp(cust.total)}</div>
                  </div>
               ))}
               {rekap.topCustomersList.length === 0 && <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg mb-4 flex gap-2"><ShoppingCart size={20} className="text-slate-500"/> Penjualan Pusat (Periode Ini)</h3>
                <div className="mb-4">
                    <span className="text-4xl font-bold text-emerald-600">{formatRp(rekap.totalPenjualanKotor)}</span>
                    <div className="text-xs text-slate-400 mt-1">Total Porsi Terjual: {rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</div>
                </div>
                <div className="space-y-2 overflow-y-auto pr-2 mb-4">
                    {Object.entries(rekap.breakdownPorsi).sort((a,b) => b[1] - a[1]).map(([kategori, porsi]) => (
                    <div key={kategori} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium w-24">{kategori}</span>
                        <div className="flex items-center gap-2 flex-1 ml-2">
                            <div className="h-2 bg-red-100 flex-1 rounded-full overflow-hidden">
                                <div className="h-full bg-red-600 rounded-full" style={{ width: `${rekap.totalPorsi > 0 ? (porsi / rekap.totalPorsi) * 100 : 0}%` }}></div>
                            </div>
                            <span className="font-bold w-8 text-right">{porsi}</span>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-700 font-medium text-sm">Piutang Baru (Pusat)</span>
                <span className="font-bold text-red-800">{formatRp(rekap.totalPiutangBaru)}</span>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg mb-4 flex gap-2"><Truck size={20} className="text-slate-500"/> Pembelian Bahan (Periode Ini)</h3>
                <div className="mb-4">
                    <span className="text-4xl font-bold text-orange-600">{formatRp(rekap.listPembelianDetail.reduce((a,b) => a + Number(b.total), 0))}</span>
                    <div className="text-xs text-slate-400 mt-1">Total Transaksi Pembelian: {[...new Set(rekap.listPembelianDetail.map(x=>x?.id))].length} Trx</div>
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-orange-50 rounded border border-orange-100">
                <span className="text-orange-800 font-medium text-sm">Hutang Baru (Supplier)</span>
                <span className="font-bold text-orange-900">{formatRp(rekap.totalHutangBaru)}</span>
            </div>
        </div>

      </div>
    </div>
  );
}
