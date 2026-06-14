import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, ShoppingCart, Wallet, Package, 
  Users, Layers, Award, AlertCircle, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, DollarSign, Activity, Filter, Clock
} from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ 
  orders = [], orders_data,
  expenses = [], expenses_data,
  masterCustomers = [], master_customers,
  masterProducts = [], master_products,
  masterBranches = [], master_branches,
  branch_settlements = [],
  setActiveTab, user 
}) {
  const todayStr = getTodayStr();
  
  // --- STATE FILTER RENTANG WAKTU ---
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default ke awal bulan berjalan
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayStr);
  const [selectedBranch, setSelectedBranch] = useState('ALL_BRANCH');

  // --- SINKRONISASI DATABASE (SINGLE SOURCE OF TRUTH) ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  const activeBranches = useMemo(() => realBranches.filter(b => !b.isDeleted), [realBranches]);

  // --- CORE ANALYTICS ENGINE ---
  const analytics = useMemo(() => {
    const isInPeriod = (dateVal) => {
      if (!dateVal) return false;
      const cleanDate = dateVal.substring(0, 10);
      return cleanDate >= dateFrom && cleanDate <= dateTo;
    };

    const isInBranch = (bId) => {
      if (selectedBranch === 'ALL_BRANCH') return true;
      return String(bId).toUpperCase() === selectedBranch.toUpperCase();
    };

    // 1. METRIK PENJUALAN & TRANSAKSI
    let totalSalesPeriod = 0;
    let totalSalesToday = 0;
    let transactionCount = 0;
    let todayTransactionCount = 0;

    // 2. KUE OMSET PLATFORM (CRM CATEGORY)
    const platformRevenue = {
      OFFLINE: 0, GOFOOD: 0, GRABFOOD: 0, SHOPEEFOOD: 0, RESELLER_AGEN: 0, MARKETPLACE_LAIN: 0
    };

    // 3. DETAIL ITEM / MENU LEADERBOARD
    const itemSalesMap = {};

    // Proses data penjualan (Orders)
    realOrders.forEach(o => {
      if (o.isDeleted) return;
      const oDate = o.date ? o.date.substring(0, 10) : '';
      const isToday = oDate === todayStr;

      // Filter global cabang dan periode
      if (!isInBranch(o.branch_id)) return;

      if (isToday) {
        totalSalesToday += Number(o.total_amount || 0);
        todayTransactionCount++;
      }

      if (isInPeriod(o.date)) {
        totalSalesPeriod += Number(o.total_amount || 0);
        transactionCount++;

        // Rekap Channel Platform
        const channel = String(o.sales_channel || 'OFFLINE').toUpperCase();
        if (platformRevenue[channel] !== undefined) {
          platformRevenue[channel] += Number(o.total_amount || 0);
        } else {
          platformRevenue.OFFLINE += Number(o.total_amount || 0);
        }

        // Pembedahan Isi Keranjang Jualan (Detail Menu Analytics)
        const items = safeJsonParse(o.items, []);
        items.forEach(item => {
          const key = item.id || item.name;
          if (!itemSalesMap[key]) {
            itemSalesMap[key] = { id: item.id, name: item.name, qty: 0, revenue: 0 };
          }
          // Hitung konversi porsi otomatis jika mengandung kata porsi
          const isPorsi = String(item.name).toUpperCase().includes('PORSI');
          const multiplier = isPorsi ? 4 : 1;
          const cleanQty = Number(item.qty || 0) * multiplier;

          itemSalesMap[key].qty += cleanQty;
          itemSalesMap[key].revenue += Number(item.price || 0) * Number(item.qty || 0);
        });
      }
    });

    // Urutkan Menu Terlaris vs Kurang Laku
    const sortedMenus = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty);
    const bestSellers = sortedMenus.slice(0, 5);
    const slowMoving = [...sortedMenus].reverse().slice(0, 5);

    // 4. RADAR KEUANGAN MAKRO (CASHFLOW & UTANG PIUTANG)
    let cashIn = 0;
    let cashOut = 0;
    let totalPiutang = 0;
    let totalHutang = 0;
    let totalKasbonKaryawan = 0;

    // Hitung Kasbon dari expenses kategori KASBON yang belum lunas (dikompilasi dari pengeluaran)
    realExpenses.forEach(e => {
      if (e.isDeleted) return;
      if (!isInBranch(e.branch_id)) return;

      const amt = Number(e.amount || 0);
      
      // Klasifikasi Biaya Kas Keluar
      if (isInPeriod(e.date)) {
        cashOut += amt;
      }

      if (e.category === 'KASBON') {
        totalKasbonKaryawan += amt; // Sisa hutang kasbon dihitung global
      }
      if (e.status === 'BELUM_LUNAS' || e.status === 'PENDING') {
        totalHutang += amt; // Hutang ke supplier luar
      }
    });

    // Ambil pemasukan tunai/transfer dari sales yang masuk periode
    realOrders.forEach(o => {
      if (o.isDeleted || !isInBranch(o.branch_id) || !isInPeriod(o.date)) return;
      cashIn += Number(o.amount_paid || 0);
      
      if (o.status === 'BELUM_LUNAS') {
        totalPiutang += (Number(o.total_amount || 0) - Number(o.amount_paid || 0));
      }
    });

    const cashBalance = cashIn - cashOut;
    const avgTransaction = transactionCount > 0 ? Math.floor(totalSalesPeriod / transactionCount) : 0;

    // Susun data presentase kue platform online
    const platformList = Object.keys(platformRevenue).map(key => ({
      name: key === 'RESELLER_AGEN' ? 'Reseller / Agen' : key === 'MARKETPLACE_LAIN' ? 'Marketplace' : key.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      value: platformRevenue[key],
      percentage: totalSalesPeriod > 0 ? ((platformRevenue[key] / totalSalesPeriod) * 100).toFixed(1) : 0
    })).sort((a,b) => b.value - a.value);

    return {
      totalSalesToday, totalSalesPeriod, transactionCount, avgTransaction, todayTransactionCount,
      platformList, bestSellers, slowMoving, cashIn, cashOut, cashBalance, totalPiutang, totalHutang, totalKasbonKaryawan
    };
  }, [realOrders, realExpenses, dateFrom, dateTo, selectedBranch, todayStr]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* CONTROL CENTER PANEL - FILTER MULTI OUTLET & PERIODE */}
      <div className="card-holo p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-xl"><Activity size={20}/></div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 normal-case">Pusat kendali operasional finansial (HQ)</h2>
            <p className="text-[10px] font-medium text-slate-400 normal-case">Konsolidasi data tunggal real-time seluruh laci resto, pabrik, dan logistik nasional.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Dropdown Multi-Branch */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Layers size={14} className="text-slate-400 mr-2"/>
            <select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer">
              <option value="ALL_BRANCH">🌍 Semua cabang / Jaringan gabungan</option>
              <option value="TANGERANG_PUSAT">🍊 Tangerang Pusat (HQ Pabrik)</option>
              {activeBranches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs">
            <Filter size={14} className="text-slate-400 mr-2"/>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
            <span className="text-slate-300 mx-2 font-medium">-</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
          </div>
        </div>
      </div>

      {/* RANGKUMAN INDIKATOR FINANSIAL UTAMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-holo p-5 border-l-4 border-l-blue-500 bg-white">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400">Penjualan hari ini (EOD)</span>
            <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-extrabold">{analytics.todayTransactionCount} Nota</span>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(analytics.totalSalesToday)}</div>
        </div>

        <div className="card-holo p-5 border-l-4 border-l-indigo-500 bg-white">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400">Omset penjualan periode</span>
            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-extrabold">{analytics.transactionCount} Transaksi</span>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(analytics.totalSalesPeriod)}</div>
        </div>

        <div className="card-holo p-5 border-l-4 border-l-emerald-500 bg-white">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400">Arus uang masuk (Net cash-in)</span>
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5"><Clock size={10}/> Ter-audit</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">{formatRupiah(analytics.cashIn)}</div>
        </div>

        <div className="card-holo p-5 border-l-4 border-l-purple-500 bg-white">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400">Rata-rata belanja nota</span>
            <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-extrabold">Basket size</span>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(analytics.avgTransaction)}</div>
        </div>
      </div>

      {/* AREA GRAFIK PLATFORM & LEADERBOARD DETAIL ITEM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI (5 KOLOM): KUE OMSET PLATFORM (CRM DATA) */}
        <div className="lg:col-span-5 card-holo flex flex-col overflow-hidden bg-white">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-red-500"/> Kontribusi revenue per platform penjualan
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center space-y-3.5">
            {analytics.platformList.every(p => p.value === 0) ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">Belum ada transaksi di periode ini.</div>
            ) : (
              analytics.platformList.map((platform, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700">{platform.name}</span>
                    <span className="text-slate-500">{formatRupiah(platform.value)} <span className="text-red-600 font-black ml-1">({platform.percentage}%)</span></span>
                  </div>
                  {/* PROGRESS BAR FLAT */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full rounded-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-emerald-500' : idx === 3 ? 'bg-orange-500' : 'bg-slate-400'}`} 
                      style={{ width: `${platform.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KANTONG KANAN (7 KOLOM): LEADERBOARD DETAIL MENU TERJUAL */}
        <div className="lg:col-span-7 card-holo flex flex-col overflow-hidden bg-white">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-xs text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Award size={16} className="text-amber-500"/> Peringkat detail item / menu paling laku</span>
            <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-bold">Hitungan Pcs</span>
          </div>
          <div className="p-2 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] text-slate-400 uppercase border-b bg-white">
                <tr>
                  <th className="px-4 py-2 font-bold">Nama menu / Varian</th>
                  <th className="px-4 py-2 text-center font-bold">Volume terjual</th>
                  <th className="px-4 py-2 text-right font-bold">Uang dihasilkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {analytics.bestSellers.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-12 text-slate-400 font-medium">Belum ada rincian produk keluar.</td></tr>
                ) : (
                  analytics.bestSellers.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-800 normal-case font-extrabold">{item.name}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">{formatNumber(item.qty)} Pcs</span></td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-extrabold">{formatRupiah(item.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* BRANKAS NERACA KEUANGAN MAKRO UTANG PIUTANG KASBON */}
      <div className="card-holo overflow-hidden bg-white">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
          <Wallet size={16} className="text-indigo-600"/> Buku kontrol sisa komitmen keuangan nasional
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-100 text-center bg-white">
          <div className="p-5 hover:bg-slate-50/50 transition-colors">
            <div className="text-[9px] font-bold text-slate-400 mb-1">Total pengeluaran (Cash-out)</div>
            <div className="text-xl font-extrabold text-red-500 tracking-tight">-{formatRupiah(analytics.cashOut)}</div>
          </div>
          <div className="p-5 hover:bg-slate-50/50 transition-colors">
            <div className="text-[9px] font-bold text-slate-400 mb-1">Total piutang dagang agen</div>
            <div className="text-xl font-extrabold text-orange-500 tracking-tight">{formatRupiah(analytics.totalPiutang)}</div>
          </div>
          <div className="p-5 hover:bg-slate-50/50 transition-colors">
            <div className="text-[9px] font-bold text-slate-400 mb-1">Total hutang supplier bahan</div>
            <div className="text-xl font-extrabold text-slate-700 tracking-tight">{formatRupiah(analytics.totalHutang)}</div>
          </div>
          <div className="p-5 hover:bg-slate-50/50 transition-colors bg-slate-50/20">
            <div className="text-[9px] font-bold text-slate-400 mb-1">Total kasbon aktif karyawan</div>
            <div className="text-xl font-extrabold text-indigo-600 tracking-tight">{formatRupiah(analytics.totalKasbonKaryawan)}</div>
          </div>
        </div>
      </div>

      {/* WARNING MONITORING PERSSEDIAAN KRITIS */}
      <div className="card-holo p-4 border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="text-orange-500 shrink-0" size={20}/>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 normal-case">Sistem audit pengawasan terintegrasi aktif</h4>
            <p className="text-[10px] font-medium text-slate-400 normal-case">Semua grafik di atas terikat otomatis dengan tabel Google Sheets utama tanpa manipulasi.</p>
          </div>
        </div>
        <button type="button" onClick={() => setActiveTab('master_customer')} className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-bold normal-case shadow-xs transition-colors text-center">
          Buka data master customer →
        </button>
      </div>

    </div>
  );
}
