import React, { useState, useMemo } from 'react';
import { Calendar, Printer, ShoppingCart, Package, Wallet, TrendingUp, Users } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatRp, formatDate } from '../../utils/helpers';
import SimpleSVGLineChart from '../ui/SimpleSVGLineChart';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90">{title}</h3><div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div></div>
    <div className="text-2xl font-bold tracking-tight">{formatRp(amount)}</div>
  </div>
);

export default function TabDashboardBranch({ orders, pemalangReports, setPrintData, user, stokData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

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
    filteredOrders.forEach(o => { if(!o?.id) return; if(!orderGroups[o.id]) orderGroups[o.id] = { total:0, paid: Number(o.paidAmount)||0 }; orderGroups[o.id].total += Number(o.total)||0; });
    Object.values(orderGroups).forEach(g => { if(g.total - g.paid > 0) totalPiutangBaru += (g.total - g.paid); });

    filteredReports.forEach(p => { setoranKePusat += (Number(p?.nominal) || 0); });
    const finalChartData = Object.keys(chartDataMap).map(key => ({ label: key, value: chartDataMap[key] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const groupedTransaksiPusat = Object.values(filteredOrders.reduce((acc, o) => {
        if(!o?.id) return acc;
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], totalTagihan: 0, dp: Number(o.paidAmount)||0 };
        acc[o.id].items.push(`${o.qty} Pcs`);
        acc[o.id].totalTagihan += Number(o.total)||0;
        return acc;
    }, {})).map(grp => {
        const terbayar = grp.dp;
        const sisa = grp.totalTagihan - terbayar;
        return { ...grp, totalTerbayar: terbayar, sisaTagihan: sisa, status: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS' };
    });

    return { totalPenjualanKotor, setoranKePusat, totalPorsi, totalPcs, totalPiutangBaru, breakdownPorsi, topCustomersList, finalChartData, listOrders: groupedTransaksiPusat, listReports: filteredReports };
  }, [orders, pemalangReports, dateFrom, dateTo, chartView]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Periode Laporan & Grafik</h3><div className="flex flex-wrap items-center gap-2"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" /><span className="text-slate-400">s/d</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" /></div></div>
          <button onClick={() => setPrintData({ type: 'reportBranch', data: { rekap, dateFrom, dateTo } })} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm w-full md:w-auto justify-center"><Printer size={16} /> Cetak Laporan Cabang</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Omset Cabang" amount={rekap.totalPenjualanKotor} icon={<ShoppingCart />} color="bg-orange-50 text-orange-700 border-orange-200" />
          <div className="p-5 rounded-xl border flex flex-col justify-between bg-white border-slate-200"><div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90 text-slate-600">Total Porsi Terjual</h3><div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Package size={20}/></div></div><div className="text-2xl font-bold tracking-tight text-slate-800">{rekap.totalPorsi} <span className="text-sm font-normal text-slate-500">Porsi ({rekap.totalPcs} Pcs)</span></div></div>
          <StatCard title="Total Setoran Kas ke Pusat" amount={rekap.setoranKePusat} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div><h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-blue-800"><Package size={20} /> Monitoring Sisa Stok Freezer Aktual</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Object.keys(stokAktual).length === 0 && <div className="text-sm text-slate-500 italic col-span-full">Stok kosong atau belum ada pencatatan barang.</div>}
              {Object.entries(stokAktual).map(([nama, data]) => (<div key={nama} className={`p-4 rounded-xl border flex flex-col justify-between ${data.sisa <= 0 ? 'bg-red-50 border-red-200' : 'bg-white border-blue-100 shadow-sm'}`}><div className="text-sm font-bold text-slate-700 mb-2 truncate" title={nama}>{nama}</div><div className={`text-2xl font-black ${data.sisa <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{data.sisa} <span className="text-xs font-medium text-slate-500">{data.satuan}</span></div></div>))}
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
         <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><TrendingUp size={20} className="text-red-500"/> Grafik Penjualan Cabang</h3><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={()=>setChartView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='daily'?'bg-white shadow text-red-600':'text-slate-500'}`}>Harian</button><button onClick={()=>setChartView('monthly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='monthly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Bulanan</button></div></div>
         <div className="w-full h-56 mt-4 relative min-w-[500px]">{rekap.finalChartData.length === 0 ? (<div className="w-full h-full flex items-center justify-center text-slate-400 border border-dashed rounded-xl">Belum ada data di periode ini.</div>) : (<SimpleSVGLineChart data={rekap.finalChartData} />)}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-96">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Top Pelanggan (Cabang Pemalang)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {rekap.topCustomersList.map((cust, i) => (<div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-amber-200 transition"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div><div><div className="font-bold text-slate-800">{cust.name}</div><div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div></div></div><div className="font-bold text-amber-600">{formatRp(cust.total)}</div></div>))}
               {rekap.topCustomersList.length === 0 && <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div><h3 className="font-bold text-lg mb-4 flex gap-2"><ShoppingCart size={20} className="text-slate-500"/> Penjualan Cabang (Periode Ini)</h3><div className="mb-4"><span className="text-4xl font-bold text-emerald-600">{formatRp(rekap.totalPenjualanKotor)}</span><div className="text-xs text-slate-400 mt-1">Total Porsi Terjual: {rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</div></div>
                <div className="space-y-2 overflow-y-auto pr-2 mb-4">
                    {Object.entries(rekap.breakdownPorsi).sort((a,b) => b[1] - a[1]).map(([kategori, porsi]) => (<div key={kategori} className="flex justify-between items-center text-xs"><span className="text-slate-600 font-medium w-24">{kategori}</span><div className="flex items-center gap-2 flex-1 ml-2"><div className="h-2 bg-red-100 flex-1 rounded-full overflow-hidden"><div className="h-full bg-red-600 rounded-full" style={{ width: `${rekap.totalPorsi > 0 ? (porsi / rekap.totalPorsi) * 100 : 0}%` }}></div></div><span className="font-bold w-8 text-right">{porsi}</span></div></div>))}
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-red-50 rounded border border-red-100"><span className="text-red-700 font-medium text-sm">Piutang Baru (Agen Cabang)</span><span className="font-bold text-red-800">{formatRp(rekap.totalPiutangBaru)}</span></div>
        </div>
      </div>
    </div>
  );
}
