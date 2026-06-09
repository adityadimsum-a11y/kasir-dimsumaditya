import React, { useMemo } from 'react';
import { Store, Receipt, Package, AlertCircle, FileText, Wallet, ShoppingBag, Layers, Pizza } from 'lucide-react';
import { formatRp, formatDate, getTodayStr } from '../../utils/helpers';

export default function TabDashboardBranch({ orders, stockMovements, expenses, purchases, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'CIBINONG';
  const branchName = user?.branch_name || currentBranch;
  const curMonth = todayStr.substring(0, 7);

  // 1. ENGINE HITUNG STOK FREEZER & GUDANG RESTO LOKAL
  const outletStock = useMemo(() => {
      const stock = {};
      (stockMovements || []).forEach(m => {
          if (m.isDeleted || String(m.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
          const item = m.item_name.toUpperCase();
          if (!stock[item]) stock[item] = 0;

          if (['PRODUCTION_RESULT', 'SALE_RETURN', 'INVENTORY_IN', 'DISTRIBUTION_RECEIPT'].includes(m.movement_type) || (m.to_location && m.to_location.includes('FREEZER')) || (m.to_location && m.to_location.includes('GUDANG'))) {
              stock[item] += Number(m.qty) || 0;
          } else if (['SALE', 'WASTE', 'INVENTORY_OUT', 'DISTRIBUTION_USAGE'].includes(m.movement_type) || (m.from_location && m.from_location.includes('FREEZER')) || (m.from_location && m.from_location.includes('GUDANG'))) {
              stock[item] -= Number(m.qty) || 0;
          }
      });
      return stock;
  }, [stockMovements, currentBranch]);

  // 2. METRIK UTAMA & RADAR SALURAN PENJUALAN TERBESAR
  const data = useMemo(() => {
    const myOrders = (orders || []).filter(o => !o.isDeleted && String(o.branch_id).toUpperCase() === currentBranch.toUpperCase());
    const sortedOrders = myOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const todayOrders = myOrders.filter(o => o.date === todayStr);
    const omsetHariIni = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Hitung Radar Channel Omzet Hari Ini
    let offlineRevenue = 0;
    let gofoodRevenue = 0;
    let shopeefoodRevenue = 0;
    let grabfoodRevenue = 0;
    let lainnyaRevenue = 0;

    todayOrders.forEach(o => {
        const cat = o.sales_category;
        const src = String(o.source).toUpperCase();
        const amt = Number(o.total || 0);

        if (cat === 'OFFLINE_RESTO') offlineRevenue += amt;
        else if (src === 'GOFOOD') gofoodRevenue += amt;
        else if (src === 'SHOPEEFOOD') shopeefoodRevenue += amt;
        else if (src === 'GRABFOOD') grabfoodRevenue += amt;
        else lainnyaRevenue += amt;
    });

    // Menentukan Juara Saluran Terbesar Hari Ini
    const channels = [
        { label: 'OFFLINE DI RESTO', value: offlineRevenue },
        { label: 'GOFOOD ONLINE', value: gofoodRevenue },
        { label: 'SHOPEEFOOD ONLINE', value: shopeefoodRevenue },
        { label: 'GRABFOOD ONLINE', value: grabfoodRevenue },
        { label: 'LAINNYA', value: lainnyaRevenue }
    ];
    channels.sort((a,b) => b.value - a.value);
    const channelTerbesar = channels[0].value > 0 ? `${channels[0].label} (${formatRp(channels[0].value)})` : 'BELUM ADA TRANSAKSI';

    const myExpenses = (expenses || []).filter(e => !e.isDeleted);
    
    return {
        sortedOrders,
        omsetHariIni,
        channelTerbesar,
        offlineRevenue,
        gofoodRevenue,
        shopeefoodRevenue,
        grabfoodRevenue,
        lainnyaRevenue,
        totalGajiBulanIni: myExpenses.filter(e => (e.category === 'GAJI_KARYAWAN' || e.category === 'PAYROLL') && e.date.startsWith(curMonth) && String(e.branch_id).toUpperCase() === currentBranch.toUpperCase()).reduce((sum, e) => sum + Number(e.amount), 0),
        totalKasbonBulanIni: myExpenses.filter(e => (e.category === 'KASBON' || e.category === 'KASBON_KARYAWAN') && e.date.startsWith(curMonth) && String(e.branch_id).toUpperCase() === currentBranch.toUpperCase()).reduce((sum, e) => sum + Number(e.amount), 0)
    };
  }, [orders, expenses, currentBranch, todayStr, curMonth]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER HERO (WARNA AMBER RESTO) */}
      <div className="bg-slate-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wide">{branchName}</h2>
            <p className="text-amber-400 font-bold text-xs uppercase tracking-widest mt-1">Terminal Operasional Resto Hub — {todayStr}</p>
        </div>
        <div className="bg-amber-500 px-6 py-3.5 rounded-2xl text-slate-950 font-black shadow-lg text-lg uppercase tracking-wide mt-4 md:mt-0">
            OMSET HARI INI: {formatRp(data.omsetHariIni)}
        </div>
      </div>

      {/* RADAR SALURAN OMSET TERBESAR HARI INI (BARU - UPGRADE BIAR GA KERING) */}
      <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Pizza size={120}/></div>
          <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Radar Saluran Omset Terbesar Hari Ini</h3>
          </div>
          <div className="text-xl font-black text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl w-max mb-6">
              JUARA SALES: {data.channelTerbesar}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border"><div className="text-[9px] font-black text-slate-400 uppercase">Makan di Tempat</div><div className="text-base font-black text-slate-800 mt-1">{formatRp(data.offlineRevenue)}</div></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-emerald-100"><div className="text-[9px] font-black text-emerald-600 uppercase">GoFood</div><div className="text-base font-black text-slate-800 mt-1">{formatRp(data.gofoodRevenue)}</div></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-orange-100"><div className="text-[9px] font-black text-orange-600 uppercase">ShopeeFood</div><div className="text-base font-black text-slate-800 mt-1">{formatRp(data.shopeefoodRevenue)}</div></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-red-100"><div className="text-[9px] font-black text-red-600 uppercase">GrabFood</div><div className="text-base font-black text-slate-800 mt-1">{formatRp(data.grabfoodRevenue)}</div></div>
              <div className="bg-slate-50 p-4 rounded-xl border"><div className="text-[9px] font-black text-slate-400 uppercase">Lainnya</div><div className="text-base font-black text-slate-800 mt-1">{formatRp(data.lainnyaRevenue)}</div></div>
          </div>
      </div>

      {/* MONITOR STOK FISIK FREEZER RESTO (POINT UTAMA REQUEST) */}
      <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-3">
              <Package size={18} className="text-amber-500"/>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Real-Time Monitor Gudang & Freezer Resto</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col justify-between">
                  <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Bahan Inti (Suplai Pusat)</div>
                  <div className="text-3xl font-black my-2">{(outletStock['DIMSUM'] || 0).toLocaleString('id-ID')} <span className="text-sm text-slate-400">Pcs</span></div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Dimsum Frozen Core</p>
              </div>
              {Object.keys(outletStock).map(key => {
                  if (key === 'DIMSUM') return null;
                  return (
                      <div key={key} className="p-4 bg-slate-50 border rounded-2xl flex flex-col justify-between">
                          <div className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Menu Resto Lokal</div>
                          <div className="text-3xl font-black text-slate-800 my-2">{(outletStock[key] || 0).toLocaleString('id-ID')} <span className="text-sm text-slate-400">Pcs</span></div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{key}</p>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* OPERASIONAL SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-blue-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Beban Penggajian Resto (Bulan Ini)</div>
            <div className="text-xl font-black text-blue-600">{formatRp(data.totalGajiBulanIni)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Kasbon Staf Aktif (Bulan Ini)</div>
            <div className="text-xl font-black text-orange-600">{formatRp(data.totalKasbonBulanIni)}</div>
        </div>
      </div>

      {/* DETAIL PENJUALAN TERBARU */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 uppercase text-sm flex items-center gap-2"><Receipt size={16}/> Histori Antrean Nota Kasir</h4>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                      <tr>
                          <th className="px-6 py-4">Waktu</th>
                          <th className="px-6 py-4">ID Nota</th>
                          <th className="px-6 py-4">Pelanggan/Meja</th>
                          <th className="px-6 py-4">Item Menu</th>
                          <th className="px-6 py-4 text-center">Volume</th>
                          <th className="px-6 py-4 text-right">Total Net</th>
                          <th className="px-6 py-4 text-center">Saluran</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {data.sortedOrders.length === 0 ? (
                          <tr><td colSpan="7" className="text-center py-10 text-slate-400">Belum ada struk penjualan keluar hari ini.</td></tr>
                      ) : (
                          data.sortedOrders.map(o => (
                              <tr key={o.id} className="hover:bg-slate-50 transition">
                                  <td className="px-6 py-4 font-bold text-slate-700">{formatDate(o.date)}</td>
                                  <td className="px-6 py-4 font-mono font-bold text-slate-400 text-[10px]">{o.id}</td>
                                  <td className="px-6 py-4 uppercase font-black text-slate-800">{o.customer_name}</td>
                                  <td className="px-6 py-4 text-slate-600 uppercase font-black text-xs">{o.itemName || 'DIMSUM'}</td>
                                  <td className="px-6 py-4 text-center font-bold text-blue-600">{Number(o.qty).toLocaleString('id-ID')} Pcs</td>
                                  <td className="px-6 py-4 text-right font-black text-slate-900">{formatRp(o.total)}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className="px-2 py-1 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-800">
                                          {o.source}
                                      </span>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      
    </div>
  );
}
