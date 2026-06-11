import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, ArrowDownToLine, ArrowUpRight, Award, Store, ShoppingBag, Calendar, Percent, RefreshCw, BarChart3, PieChart } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabBusinessRadar({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  masterBranches = [], master_branches, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE PERIODE ANALITIK ---
  const [timeRange, setTimeRange] = useState('7_DAYS'); // 7_DAYS atau 30_DAYS

  // --- SINKRONISASI DATABASE cloud ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  // Pemetaan Cabang untuk Label Grafik
  const branchMap = useMemo(() => {
    const mapping = { TANGERANG_PUSAT: 'Tangerang Pusat', PUSAT: 'Tangerang Pusat' };
    rawBranches.forEach(b => { if (b.branch_id) mapping[b.branch_id] = b.branch_name; });
    return mapping;
  }, [rawBranches]);

  // --- COMPILER ALGORITMA RADAR VISUAL ---
  const radarMetrics = useMemo(() => {
    const limitDate = new Date();
    const daysToCount = timeRange === '7_DAYS' ? 7 : 30;
    limitDate.setDate(limitDate.getDate() - daysToCount);

    // 1. DATASET A: Tren Omzet Harian (Line Graph Dataset)
    const trendMap = {};
    for (let i = daysToCount - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      trendMap[key] = { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), omzet: 0, beban: 0 };
    }

    // 2. DATASET B: Share Omzet Per Cabang (Donut Chart Dataset)
    const branchShare = { TANGERANG_PUSAT: 0, CIBINONG: 0, PRODUKSI_PEMALANG: 0 };
    
    // 3. DATASET C: Ranking Channel Terlaris (Horizontal Progress Dataset)
    const channelRank = { ECERAN: 0, MITRA: 0, RESERLLER: 0, MITRA_AGEN: 0, RESELLER: 0, SHOPEE: 0, TOKOPEDIA: 0, TIKTOK: 0 };

    let totalOmzet = 0;
    let totalBeban = 0;

    // --- PROSES LOOP DATA ORDERS (OMZET) ---
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const orderDateStr = o.date.substring(0, 10);
      const d = new Date(o.date);
      if (d >= limitDate) {
        const amt = Number(o.total_amount || 0);
        totalOmzet += amt;

        // Injeksi ke Dataset Tren Harian
        if (trendMap[orderDateStr]) trendMap[orderDateStr].omzet += amt;

        // Injeksi ke Dataset Share Cabang
        const bKey = o.branch_id === 'PUSAT' ? 'TANGERANG_PUSAT' : o.branch_id;
        if (branchShare[bKey] !== undefined) branchShare[bKey] += amt;
        else branchShare[bKey] = amt;

        // Injeksi ke Dataset Channel Terlaris
        const cKey = o.sales_channel?.toUpperCase() || 'ECERAN';
        if (channelRank[cKey] !== undefined) channelRank[cKey] += amt;
        else channelRank[cKey] = amt;
      }
    });

    // --- PROSES LOOP DATA BEBAN ---
    // Nota Belanja Supplier
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      const pDateStr = p.date.substring(0, 10);
      if (new Date(p.date) >= limitDate) {
        const amt = Number(p.total_amount || p.amount || 0);
        totalBeban += amt;
        if (trendMap[pDateStr]) trendMap[pDateStr].beban += amt;
      }
    });
    // Biaya Pengeluaran Tambahan
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      const eDateStr = e.date.substring(0, 10);
      if (new Date(e.date) >= limitDate) {
        const amt = Number(e.amount || 0);
        totalBeban += amt;
        if (trendMap[eDateStr]) trendMap[eDateStr].beban += amt;
      }
    });
    // Arus Kas Keluar Manual
    realCashflow.filter(c => !c.isDeleted && c.type === 'OUT').forEach(c => {
      const cDateStr = c.date.substring(0, 10);
      if (new Date(c.date) >= limitDate) {
        const amt = Number(c.amount || 0);
        totalBeban += amt;
        if (trendMap[cDateStr]) trendMap[cDateStr].beban += amt;
      }
    });

    // Kalkulasi Koordinat SVG Line Chart secara Presisi
    const trendArray = Object.values(trendMap);
    const maxOmzetValue = Math.max(...trendArray.map(t => Math.max(t.omzet, t.beban)), 100000);

    return {
      totalOmzet,
      totalBeban,
      netProfit: totalOmzet - totalBeban,
      trendArray,
      maxOmzetValue,
      branchShare,
      channelRank: Object.entries(channelRank).sort((a,b)=>b[1]-a[1]).slice(0,4) // Ambil Top 4 Terlaris
    };
  }, [realOrders, realPurchases, realExpenses, realCashflow, timeRange]);

  // --- ENGINE KOORDINAT GRAPHIC SVG LINE (DYNAMICS PLOTTING) ---
  const svgCoordinates = useMemo(() => {
    const width = 500;
    const height = 180;
    const points = radarMetrics.trendArray;
    const maxVal = radarMetrics.maxOmzetValue;

    if (points.length === 0) return { omzetPath: '', bebanPath: '' };

    const stepX = width / (points.length - 1 || 1);
    
    let omzetPath = '';
    let bebanPath = '';

    points.forEach((p, idx) => {
      const x = idx * stepX;
      // Balik koordinat Y karena titik 0 SVG dimulai dari pojok atas langit-langit
      const yOmzet = height - ((p.omzet / maxVal) * (height - 20));
      const yBeban = height - ((p.beban / maxVal) * (height - 20));

      if (idx === 0) {
        omzetPath = `M ${x} ${yOmzet}`;
        bebanPath = `M ${x} ${yBeban}`;
      } else {
        omzetPath += ` L ${x} ${yOmzet}`;
        bebanPath += ` L ${x} ${yBeban}`;
      }
    });

    return { omzetPath, bebanPath };
  }, [radarMetrics]);

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* HEADER CONTROL DASHBOARD */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-500 animate-pulse"/> Radar Bisnis &amp; Visual Analitik
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Kamar kendali visual eksekutif. Memantau grafik pertumbuhan usaha secara interaktif.</p>
        </div>

        {/* CONTROLLER SAKLAR FILTER WAKTU */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border shadow-inner">
          <button onClick={() => setTimeRange('7_DAYS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${timeRange === '7_DAYS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>7 Hari Terakhir</button>
          <button onClick={() => setTimeRange('30_DAYS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${timeRange === '30_DAYS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>30 Hari Terakhir</button>
        </div>
      </div>

      {/* TIGA KARTU INDIKATOR UTAMA FINANSIAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-300 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowDownToLine size={12} className="text-emerald-500"/> Aliran Omzet Masuk</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalOmzet)}</div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-2xl border border-emerald-100 group-hover:scale-105 transition-transform"><TrendingUp size={24}/></div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-rose-300 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowUpRight size={12} className="text-rose-500"/> Total Pengeluaran</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalBeban)}</div>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl border border-rose-100 group-hover:scale-105 transition-transform"><ArrowUpRight size={24}/></div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between relative overflow-hidden transition-transform hover:scale-[1.01]">
          <div className="z-10">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Award size={12}/> Estimasi Laba Bersih</div>
            <div className="text-3xl font-black tracking-tight mt-1">{formatRupiah(radarMetrics.netProfit)}</div>
          </div>
          <div className="bg-emerald-500 text-slate-900 p-3.5 rounded-2xl border border-emerald-400 z-10"><Award size={24}/></div>
        </div>
      </div>

      {/* ROW SEBELAH ATAS: GRAFIK TREN GARIS HUB (PURE SVG HIGH PERFORMANCE) */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-6"><BarChart3 size={16} className="text-blue-500"/> Grafik Komparasi Omzet vs Beban Pabrik harian</h3>
        
        {/* AREA RENDERING SVG LINE */}
        <div className="w-full h-48 bg-slate-50 border rounded-2xl relative p-2 overflow-hidden shadow-inner">
          <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
            {/* Grid Line Pembantu Belakang */}
            <line x1="0" y1="45" x2="500" y2="45" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
            <line x1="0" y1="90" x2="500" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
            <line x1="0" y1="135" x2="500" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
            
            {/* Jalur Line Omzet (Hijau) */}
            <path d={svgCoordinates.omzetPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Jalur Line Beban (Merah) */}
            <path d={svgCoordinates.bebanPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* Legend Teks Pojok Atas Kanan */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur border px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-4 shadow-sm z-10">
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 rounded-full"></span> Uang Masuk</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 rounded-full"></span> Uang Keluar</div>
          </div>
        </div>

        {/* Label sumbu X Tanggal Berjalan (Batas Ringkas Cuma Ambil Titik Awal, Tengah, Akhir Biaya Ringan) */}
        <div className="flex justify-between items-center text-[9px] font-black text-slate-400 mt-3 px-1 uppercase tracking-widest">
          <span>{radarMetrics.trendArray[0]?.label || 'Awal'}</span>
          <span>{radarMetrics.trendArray[Math.floor(radarMetrics.trendArray.length / 2)]?.label || 'Tengah'}</span>
          <span>{radarMetrics.trendArray[radarMetrics.trendArray.length - 1]?.label || 'Hari Ini'}</span>
        </div>
      </div>

      {/* ROW SEBELAH BAWAH: METRIK KOMPOSISI SHARE CABANG & CHANNEL TERLARIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* PANEL KIRI: SHARE OMZET PER CABANG (DIAGRAM LINGKARAN PURE PROGRESS BAR) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-6"><PieChart size={16} className="text-emerald-500"/> Kontribusi Omzet Per Cabang</h3>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {Object.entries(radarMetrics.branchShare).map(([bId, val]) => {
              const persentase = radarMetrics.totalOmzet > 0 ? (val / radarMetrics.totalOmzet) * 100 : 0;
              return (
                <div key={bId} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-wide">
                    <span className="text-slate-700 flex items-center gap-1.5"><Store size={12} className="text-slate-400"/> {branchMap[bId] || bId.replace('_',' ')}</span>
                    <span className="text-slate-900">{formatRupiah(val)} <span className="text-[10px] text-blue-600 font-black bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 ml-1">{persentase.toFixed(1)}%</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner border border-slate-200/40">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500" style={{ width: `${persentase}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL KANAN: TOP 4 SALES CHANNELS / KATEGORI TERLARIS (HORIZONTAL RANKING) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-6"><ShoppingBag size={16} className="text-orange-500"/> Rumpun Kategori Agen Terlaris</h3>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {radarMetrics.channelRank.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">Tidak ada transaksi jualan terdeteksi.</div>
            ) : (
              radarMetrics.channelRank.map(([channelId, val], idx) => {
                const maxChannelVal = radarMetrics.channelRank[0] ? radarMetrics.channelRank[0][1] : 100000;
                const ratioBar = maxChannelVal > 0 ? (val / maxChannelVal) * 100 : 0;
                
                return (
                  <div key={channelId} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wide">
                      <span className="text-slate-700 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-orange-50 text-orange-600 font-black text-[9px] flex items-center justify-center border border-orange-200 shadow-sm">#{idx+1}</span>
                        {channelId.replace('_',' ')}
                      </span>
                      <span className="text-slate-800">{formatRupiah(val)}</span>
                    </div>
                    <div className="w-full bg-slate-50 h-2 rounded-xl overflow-hidden border border-slate-200/50">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500" style={{ width: `${ratioBar}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
