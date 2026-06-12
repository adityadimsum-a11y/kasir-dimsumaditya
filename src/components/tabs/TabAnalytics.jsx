import React, { useMemo } from 'react';
import { TrendingUp, MapPin, ShoppingBag, DollarSign, Activity, Package, Percent } from 'lucide-react';
import { formatRp, getTodayStr, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// 🔥 KUNCI MATI HPP DASAR SESUAI BLUEPRINT CORE ADITYA (ANTI-BOCOR)
const INTI_HPP_PER_PCS = 1125; 

export default function TabAnalytics({ orders = [], orders_data, masterBranches = [], master_branches, discrepancyLogs = [], discrepancy_logs_data }) {
  const todayStr = getTodayStr();

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);
  const realDiscrepancy = useMemo(() => discrepancy_logs_data || discrepancyLogs || [], [discrepancy_logs_data, discrepancyLogs]);

  const analytics = useMemo(() => {
    // Ambil rentang waktu pembatas 30 hari terakhir
    const today = new Date();
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    const branchPerf = {};
    const marketplacePerf = {};
    const productVelocity = { 'DIMSUM FROZEN': 0, 'DIMSUM MATANG': 0, 'LAINNYA': 0 };

    // Daftarkan seluruh cabang aktif dari Spreadsheet
    const activeBranchesList = realBranches.filter(b => !b.isDeleted);
    activeBranchesList.forEach(b => {
      branchPerf[b.branch_id] = { name: b.branch_name, id: b.branch_id, type: b.branch_type, revenue: 0, hpp: 0, margin: 0, trxCount: 0, wasteLoss: 0 };
    });

    // Fallback jika Master Cabang kosong biar tidak crash
    if (Object.keys(branchPerf).length === 0) {
      branchPerf['TANGERANG_PUSAT'] = { name: 'Tangerang Pusat', id: 'TANGERANG_PUSAT', type: 'HQ_FACTORY', revenue: 0, hpp: 0, margin: 0, trxCount: 0, wasteLoss: 0 };
    }

    // 1. 🔥 OLAH DATA PENJUALAN POS KASIR (KABEL DISESUAIKAN KE STRUKTUR ASLI)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const orderDateStr = o.date ? o.date.substring(0, 10) : '';
      if (orderDateStr && orderDateStr < str30Days) return;

      const bId = String(o.branch_id || 'TANGERANG_PUSAT').toUpperCase();
      const channel = String(o.sales_channel || 'OFFLINE').toUpperCase();
      const gross = Number(o.total_amount || 0); // Koreksi properti total uang jualan
      
      // Hitung total pcs riil dari dalam array items
      let totalPcs = 0;
      const itemsArr = safeJsonParse(o.items, []);
      itemsArr.forEach(item => {
        totalPcs += Number(item.qty || 0);
        
        // Product Velocity Tracker
        const itemName = String(item.name || '').toUpperCase();
        if (itemName.includes('FROZEN')) productVelocity['DIMSUM FROZEN'] += Number(item.qty || 0);
        else if (itemName.includes('MATANG') || itemName.includes('RESTO')) productVelocity['DIMSUM MATANG'] += Number(item.qty || 0);
        else productVelocity['LAINNYA'] += Number(item.qty || 0);
      });
      if (totalPcs === 0) totalPcs = Number(o.qty || 0);

      // Ambil nilai HPP Sakral Rp 1.125 dari manifest core
      const hppBahanAyam = totalPcs * INTI_HPP_PER_PCS;
      const netProfitReal = gross - hppBahanAyam;

      // Masukkan ke Matrix Cabang
      if (branchPerf[bId]) {
        branchPerf[bId].revenue += gross;
        branchPerf[bId].hpp += hppBahanAyam;
        branchPerf[bId].margin += netProfitReal;
        branchPerf[bId].trxCount += 1;
      }

      // Masukkan ke Matrix Marketplace / Jalur Online
      if (channel !== 'OFFLINE' && channel !== 'CASH' && channel !== 'WALKIN') {
        if (!marketplacePerf[channel]) marketplacePerf[channel] = { channel, revenue: 0, margin: 0, qty: 0 };
        marketplacePerf[channel].revenue += gross;
        marketplacePerf[channel].margin += netProfitReal;
        marketplacePerf[channel].qty += totalPcs;
      }
    });

    // 2. 🔥 OLAH DATA CORES WASTE PENYUSUTAN STOK PER CABANG
    realDiscrepancy.filter(d => !d.isDeleted).forEach(d => {
      const logDateStr = d.date ? d.date.substring(0, 10) : '';
      if (logDateStr && logDateStr < str30Days) return;

      const bId = String(d.branch_id || 'TANGERANG_PUSAT').toUpperCase();
      
      // Cari nilai HPP barang yang basi hancur di lapangan
      const qtySusut = Number(d.qty_discrepancy || d.qty || 0);
      let costPerUnit = INTI_HPP_PER_PCS; // Default dimsum pcs Rp 1.125
      if (String(d.item_id).toUpperCase().includes('AYAM') || String(d.item_name).toUpperCase().includes('AYAM')) {
        costPerUnit = 37500; // Rp 37.500 / Kg jika yang basi daging ayam mentah[cite: 1]
      }
      
      const totalRugiDuit = qtySusut * costPerUnit;

      if (branchPerf[bId]) {
        branchPerf[bId].wasteLoss += totalRugiDuit;
        branchPerf[bId].margin -= totalRugiDuit; // Kerugian opname langsung memotong margin bersih cabang
      }
    });

    return {
      branchList: Object.values(branchPerf).sort((a,b) => b.margin - a.margin),
      marketplaceList: Object.values(marketplacePerf).sort((a,b) => b.revenue - a.revenue),
      productVelocity
    };
  }, [realOrders, realBranches, realDiscrepancy, todayStr]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* ACTION TOP HEADER */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 flex justify-between items-center shadow-xl">
        <div>
           <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><Activity size={18}/> Executive Reporting &amp; Analytics Dashboard</h3>
           <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Konsolidasi otomatis performa laba kotor, HPP, serta kebocoran kas 30 hari terakhir[cite: 1]</p>
        </div>
        <button type="button" onClick={() => window.print()} className="bg-emerald-500 text-slate-900 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-emerald-600 transition-transform active:scale-95">CETAK LAPORAN REKAP</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* BRANCH PERFORMANCE MATRIX LIST */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
            <MapPin size={20} className="text-blue-600"/>
            <div>
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Branch Health Matrix (Simpul Cabang)</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Peringkat performa laba murni cabang setelah dikurangi penyusutan stok</p>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3 font-black">Identitas Node Cabang</th>
                  <th className="px-4 py-3 text-right font-black">Omzet (30H)</th>
                  <th className="px-4 py-3 text-right font-black">Waste Basi/Loss</th>
                  <th className="px-4 py-3 text-right font-black">Cuan Margin Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {analytics.branchList.map(b => {
                  const isRugi = b.margin < 0;
                  return (
                    <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="uppercase text-slate-800 font-black text-xs">{b.name}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{b.id} | {b.trxCount} Transaksi</div>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-slate-600">{formatRupiah(b.revenue)}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-rose-600">-{formatRupiah(b.wasteLoss)}</td>
                      <td className={`px-4 py-4 text-right whitespace-nowrap text-sm ${isRugi ? 'text-rose-600 bg-rose-50 rounded-xl' : 'text-emerald-600 font-black'}`}>{formatRupiah(b.margin)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MARKETPLACE & SALES CHANNEL PERFORMANCE */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
            <ShoppingBag size={20} className="text-orange-600"/>
            <div>
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Marketplace &amp; Online Channel</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Aliran omzet per platform merchant e-commerce</p>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3 font-black">Sales Platform</th>
                  <th className="px-4 py-3 text-center font-black">Volume</th>
                  <th className="px-4 py-3 text-right font-black">Gross Sales</th>
                  <th className="px-4 py-3 text-right font-black">Est Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {analytics.marketplaceList.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-12 text-slate-400 uppercase font-black tracking-widest">Belum ada sirkulasi data penjualan online.</td></tr>
                ) : (
                  analytics.marketplaceList.map(m => (
                    <tr key={m.channel} className="hover:bg-orange-50/20 transition-colors">
                      <td className="px-4 py-4 uppercase text-slate-800 font-black">{m.channel.replace('_', ' ')}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-blue-600 bg-blue-50/30 rounded-lg">{formatNumber(m.qty)} PCS</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-slate-600">{formatRupiah(m.revenue)}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-emerald-600 font-black">{formatRupiah(m.margin)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* INVENTORY VELOCITY CONTROL RADAR CARD */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-b from-white to-slate-50/50">
        <div>
          <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-purple-600"/> Kecepatan Perputaran Produk / Product Velocity (30 Hari)
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Indikator live kuantitas produk yang berhasil diserap oleh pasar ekosistem agen</p>
        </div>
        <div className="flex gap-6 text-right bg-white p-3 rounded-2xl border shadow-inner">
          <div className="pr-6 border-r border-slate-100">
             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Varian Dimsum Frozen</div>
             <div className="text-xl font-black text-slate-800 tracking-tight">{formatNumber(analytics.productVelocity['DIMSUM FROZEN'])} <span className="text-xs text-slate-400 font-medium">Pcs</span></div>
          </div>
          <div className="pr-6 border-r border-slate-100">
             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Varian Dimsum Matang / Resto</div>
             <div className="text-xl font-black text-slate-800 tracking-tight">{formatNumber(analytics.productVelocity['DIMSUM MATANG'])} <span className="text-xs text-slate-400 font-medium">Pcs</span></div>
          </div>
          <div>
             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Varian Lainnya</div>
             <div className="text-xl font-black text-slate-500 tracking-tight">{formatNumber(analytics.productVelocity['LAINNYA'] || 0)} <span className="text-xs text-slate-400 font-medium">Pcs</span></div>
          </div>
        </div>
      </div>

    </div>
  );
}
