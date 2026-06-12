import React, { useMemo } from 'react';
import { Store, Receipt, Package, AlertCircle, FileText, Wallet, ShoppingBag, Layers, Pizza, Timer, Users, Banknote } from 'lucide-react';
import { formatRp, formatDate, getTodayStr, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboardBranch({ orders = [], orders_data, stockMovements = [], expenses = [], expenses_data, purchases = [], purchases_data, user }) {
  const todayStr = getTodayStr();
  
  // 🔥 KONEKSI KABEL CABANG INDUK SINKRON TANGERANG PUSAT
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const branchName = user?.branch_name || currentBranch.replace('_', ' ');
  const curMonth = todayStr.substring(0, 7);

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // 1. ENGINE HITUNG STOK FISIK FREEZER RESTO HUB LOKAL
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

  // 2. METRIK UTAMA & RADAR SALURAN PENJUALAN TERBESAR CABANG (LIVE SINKRON POS)
  const data = useMemo(() => {
    const myOrders = realOrders.filter(o => !o.isDeleted && String(o.branch_id).toUpperCase() === currentBranch.toUpperCase());
    const sortedOrders = myOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter Khusus Hari Ini untuk Radar Banner Atas
    const todayOrders = myOrders.filter(o => o.date && o.date.substring(0, 10) === todayStr.substring(0, 10));
    
    // 🔥 KOREKSI VARIABEL: SINKRON KE total_amount PENJUALAN KASIR
    const omsetHariIni = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    let offlineRevenue = 0;
    let gofoodRevenue = 0;
    let shopeefoodRevenue = 0;
    let grabfoodRevenue = 0;
    let lainnyaRevenue = 0;

    todayOrders.forEach(o => {
        const channel = String(o.sales_channel || 'OFFLINE').toUpperCase();
        const amt = Number(o.total_amount || 0);

        if (channel.includes('WALKIN') || channel.includes('OFFLINE') || channel.includes('ECERAN')) offlineRevenue += amt;
        else if (channel.includes('GOFOOD')) gofoodRevenue += amt;
        else if (channel.includes('SHOPEEFOOD')) shopeefoodRevenue += amt;
        else if (channel.includes('GRABFOOD')) grabfoodRevenue += amt;
        else lainnyaRevenue += amt;
    });

    const channels = [
        { label: 'BELI LANGSUNG DI TOKO', value: offlineRevenue },
        { label: 'APLIKASI GOFOOD', value: gofoodRevenue },
        { label: 'APLIKASI SHOPEEFOOD', value: shopeefoodRevenue },
        { label: 'APLIKASI GRABFOOD', value: grabfoodRevenue },
        { label: 'SALURAN LAINNYA', value: lainnyaRevenue }
    ];
    channels.sort((a,b) => b.value - a.value);
    const channelTerbesar = channels[0].value > 0 ? `${channels[0].label} (${formatRupiah(channels[0].value)})` : 'BELUM ADA TRANSAKSI MASUK';

    const myExpenses = realExpenses.filter(e => !e.isDeleted);
    
    return {
        sortedOrders,
        omsetHariIni,
        channelTerbesar,
        offlineRevenue,
        gofoodRevenue,
        shopeefoodRevenue,
        grabfoodRevenue,
        lainnyaRevenue,
        totalGajiBulanIni: myExpenses.filter(e => (e.category === 'GAJI' || e.category === 'PAYROLL') && e.date.startsWith(curMonth) && String(e.branch_id).toUpperCase() === currentBranch.toUpperCase()).reduce((sum, e) => sum + Number(e.amount || 0), 0),
        totalKasbonBulanIni: myExpenses.filter(e => (e.category === 'KASBON' || e.category === 'LAINNYA') && e.description?.includes('KASBON') && e.date.startsWith(curMonth) && String(e.branch_id).toUpperCase() === currentBranch.toUpperCase()).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    };
  }, [realOrders, realExpenses, currentBranch, todayStr, curMonth]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800">
      
      {/* HEADER HERO CABANG */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl border border-slate-800 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">{branchName}</h2>
            <p className="text-amber-400 font-bold text-[10px] uppercase tracking-widest mt-1">Terminal Pusat Kendali Operasional Cabang Lokal</p>
        </div>
        <div className="bg-amber-500 px-5 py-3 rounded-2xl text-slate-950 font-black shadow-lg text-base uppercase tracking-wider mt-4 md:mt-0">
            TOTAL OMSET HARI INI: {formatRupiah(data.omsetHariIni)}
        </div>
      </div>

      {/* RADAR SALURAN OMSET TERBESAR HARI INI */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Pizza size={120}/></div>
          <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Radar Live Saluran Jualan Terlaris Cabang</h3>
          </div>
          <div className="text-sm font-black text-rose-700 bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl w-max mb-6 uppercase tracking-wide shadow-inner">
              JUARA SALES HARI INI: {data.channelTerbesar}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border shadow-inner"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Toko / Walk-In</div><div className="text-sm font-black text-slate-800 mt-1">{formatRupiah(data.offlineRevenue)}</div></div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-emerald-100"><div className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">GoFood Online</div><div className="text-sm font-black text-slate-800 mt-1">{formatRupiah(data.gofoodRevenue)}</div></div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-orange-100"><div className="text-[9px] font-black text-orange-600 uppercase tracking-wider">ShopeeFood Online</div><div className="text-sm font-black text-slate-800 mt-1">{formatRupiah(data.shopeefoodRevenue)}</div></div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-red-100"><div className="text-[9px] font-black text-red-600 uppercase tracking-wider">GrabFood Online</div><div className="text-sm font-black text-slate-800 mt-1">{formatRupiah(data.grabfoodRevenue)}</div></div>
              <div className="bg-slate-50 p-3.5 rounded-xl border"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Saluran Lainnya</div><div className="text-sm font-black text-slate-800 mt-1">{formatRupiah(data.lainnyaRevenue)}</div></div>
          </div>
      </div>

      {/* MONITOR STOK FISIK FREEZER RESTO */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-3">
              <Package size={18} className="text-amber-500"/>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Real-Time Monitor Isi Freezer &amp; Gudang Cabang</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-col justify-between shadow-md">
                  <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Bahan Inti (Drop Suplai Pusat)</div>
                  <div className="text-3xl font-black my-2">{formatNumber(outletStock['DIMSUM'] || outletStock['DIMSUM_FROZEN'] || 0)} <span className="text-xs text-slate-400">Pcs</span></div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stok Dimsum Mentah Induk</p>
              </div>
              {Object.keys(outletStock).map(key => {
                  if (key === 'DIMSUM' || key === 'DIMSUM_FROZEN') return null;
                  return (
                      <div key={key} className="p-4 bg-slate-50 border rounded-2xl flex flex-col justify-between shadow-inner">
                          <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Logistik Pendukung</div>
                          <div className="text-2xl font-black text-slate-800 my-1.5">{formatNumber(outletStock[key] || 0)} <span className="text-xs text-slate-400">Unit</span></div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{key.replace('_', ' ')}</p>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* OPERASIONAL SUMMARY CABANG LOKAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 flex items-center justify-between">
            <div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beban Penggajian Cabang (Bulan Ini)</div>
               <div className="text-xl font-black text-blue-600 mt-1">{formatRupiah(data.totalGajiBulanIni)}</div>
            </div>
            <Users size={24} className="text-blue-200"/>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500 flex items-center justify-between">
            <div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kasbon Staf Aktif Cabang (Bulan Ini)</div>
               <div className="text-xl font-black text-orange-600 mt-1">{formatRupiah(data.totalKasbonBulanIni)}</div>
            </div>
            <Banknote size={24} className="text-orange-200"/>
        </div>
      </div>

      {/* DETAIL PENJUALAN TERBARU */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Receipt size={16} className="text-blue-500"/> Jurnal Histori Antrean Nota Kasir Cabang</h4>
            <span className="text-[9px] font-black text-slate-500 bg-white px-2.5 py-1 rounded-md border shadow-sm">VOLUME: {data.sortedOrders.length} NOTA</span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white border-b text-[10px] uppercase text-slate-400">
                      <tr>
                          <th className="px-6 py-4 font-black">Waktu Nota</th>
                          <th className="px-6 py-4 font-black">ID Nota</th>
                          <th className="px-6 py-4 font-black">Identitas Pelanggan</th>
                          <th className="px-6 py-4 font-black">Menu Dibeli (Keranjang)</th>
                          <th className="px-6 py-4 text-center font-black">Volume</th>
                          <th className="px-6 py-4 text-right font-black">Total Net Omset</th>
                          <th className="px-6 py-4 text-center font-black">Saluran</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-xs">
                      {data.sortedOrders.length === 0 ? (
                          <tr><td colSpan="7" className="text-center py-16 text-slate-400 uppercase tracking-widest font-black bg-slate-50/50">Belum ada struk penjualan keluar untuk cabang ini harian.</td></tr>
                      ) : (
                          data.sortedOrders.map(o => {
                              // 🔥 UNTUK MEMBONGKAR MULTI ITEM KERANJANG KASIR POS BIAR TIDAK KOSONG BLANK
                              const itemsArr = safeJsonParse(o.items, []);
                              let displayMenuName = o.itemName || 'DIMSUM OLAHAN CORE';
                              if (itemsArr.length === 1) displayMenuName = itemsArr[0].name;
                              else if (itemsArr.length > 1) displayMenuName = `${itemsArr[0].name} (+${itemsArr.length - 1} Menu Lain)`;

                              let totalPcsLog = 0;
                              itemsArr.forEach(i => totalPcsLog += Number(i.qty || 0));
                              if (totalPcsLog === 0) totalPcsLog = Number(o.qty || 0);

                              return (
                                  <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatDate(o.date)}</td>
                                      <td className="px-6 py-4 font-mono text-slate-400 text-[10px] whitespace-nowrap">{o.id}</td>
                                      <td className="px-6 py-4 uppercase font-black text-slate-800 whitespace-nowrap">{o.customer_name}</td>
                                      <td className="px-6 py-4 text-slate-600 uppercase font-black text-xs min-w-[180px]">{displayMenuName}</td>
                                      <td className="px-6 py-4 text-center font-black text-blue-600 bg-blue-50/30 rounded-lg whitespace-nowrap">{formatNumber(totalPcsLog)} PCS</td>
                                      <td className="px-4 py-4 text-right font-black text-slate-900 whitespace-nowrap">{formatRupiah(o.total_amount || o.total)}</td>
                                      <td className="px-6 py-4 text-center whitespace-nowrap">
                                          <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
                                              {(o.sales_channel || o.source || 'OFFLINE').replace('_', ' ')}
                                          </span>
                                      </td>
                                  </tr>
                              )
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      
    </div>
  );
}
