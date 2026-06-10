import React, { useMemo } from 'react';
import { Building2, Wallet, Coins, AlertTriangle, TrendingUp, Package, Activity, Cpu } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ orders = [], orders_data, purchases = [], purchases_data, productionBatches = [], production_batches, expenses = [], expenses_data, user }) {
  const todayStr = getTodayStr();

  // --- 1. SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // --- 2. ENGINE KALKULASI RADAR ---
  const metrics = useMemo(() => {
    let totalKas = 0; let totalPiutang = 0; let totalHutang = 0;
    let ayamMasukKg = 0; let ayamKeluarKg = 0;
    let frozenMasukPcs = 0; let frozenKeluarPcs = 0;
    let omzet7Hari = 0;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Hitung Penjualan (Omzet, Piutang, Kas, Dimsum Keluar)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const is7Days = new Date(o.date) >= sevenDaysAgo;
      if (is7Days) omzet7Hari += Number(o.total_amount || 0);

      totalKas += Number(o.amount_paid || 0);
      totalPiutang += (Number(o.total_amount || 0) - Number(o.amount_paid || 0));
      
      if (o.delivery_method !== 'PRE_ORDER' || o.status === 'SELESAI') {
        frozenKeluarPcs += Number(o.qty || 0);
      }
    });

    // Hitung Belanja (Hutang Supplier, Kas Keluar, Ayam Masuk)
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      totalKas -= Number(p.amount_paid || 0);
      totalHutang += (Number(p.total_amount || 0) - Number(p.amount_paid || 0));
      if (p.category === 'BAHAN_BAKU') {
        ayamMasukKg += Number(p.qty_kg || 0);
      }
    });

    // Hitung Produksi (Ayam Keluar, Frozen Masuk)
    realProd.filter(p => !p.isDeleted).forEach(p => {
      ayamKeluarKg += Number(p.total_ayam_kg || 0);
      frozenMasukPcs += Number(p.total_yield_pcs || 0);
    });

    // Hitung Pengeluaran Lain-lain
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      totalKas -= Number(e.amount || 0);
    });

    const sisaAyam = Math.max(0, ayamMasukKg - ayamKeluarKg);
    const sisaFrozen = frozenMasukPcs - frozenKeluarPcs;

    // Valuasi Aset HPP (Ayam 37.500/kg, Frozen 1.125/pcs)
    const valuasiAset = (sisaAyam * 37500) + (sisaFrozen * 1125);

    return { totalKas, totalPiutang, totalHutang, sisaAyam, sisaFrozen, valuasiAset, omzet7Hari };
  }, [realOrders, realPurchases, realProd, realExpenses]);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      
      {/* HEADER COMMAND CENTER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><Building2 size={200} className="-mt-10 -mr-10"/></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 backdrop-blur-sm"><Cpu size={24} className="text-blue-400"/></div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white drop-shadow-md">Command Center</h2>
            <p className="text-xs font-bold text-slate-400 tracking-wider">DIMSUM ADITYA ENTERPRISE — {formatDate(todayStr)}</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-left md:text-right relative z-10">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-sm">Total Valuasi Aset Gudang (HPP)</div>
          <div className="text-3xl font-black text-white drop-shadow-lg">{formatRupiah(metrics.valuasiAset)}</div>
        </div>
      </div>

      {/* 3 KARTU KEUANGAN UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <Wallet className="absolute -right-4 -bottom-4 text-slate-50 group-hover:text-emerald-50 transition-colors" size={100} />
          <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Wallet size={12}/> Kas Bersih (Global)</div>
          <div className="text-2xl font-black text-slate-800 mt-2">{formatRupiah(metrics.totalKas)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-1">Dana tunai dan saldo bank yang siap dicairkan.</div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <Coins className="absolute -right-4 -bottom-4 text-amber-50 group-hover:text-amber-100 transition-colors" size={100} />
          <div className="text-[10px] font-black text-amber-500 uppercase flex items-center gap-2"><TrendingUp size={12}/> Piutang Mengambang</div>
          <div className="text-2xl font-black text-amber-600 mt-2">{formatRupiah(metrics.totalPiutang)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-1">Piutang Pelanggan Lokal + Saldo tertahan di GoFood/Shopee.</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
          <AlertTriangle className="absolute -right-4 -bottom-4 text-rose-50 group-hover:text-rose-100 transition-colors" size={100} />
          <div className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2"><AlertTriangle size={12}/> Kewajiban Hutang Supplier</div>
          <div className="text-2xl font-black text-rose-600 mt-2">{formatRupiah(metrics.totalHutang)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-1">Total tagihan belanja ayam/bahan baku yang belum dilunasi.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI RECOMMENDATION (AUTO PROCUREMENT) */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2"><Activity size={14} className="text-blue-500"/> Sistem Rekomendasi AI (Task Queue)</h3>
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${metrics.sisaAyam <= 30 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {metrics.sisaAyam <= 30 ? '1 Tugas Menunggu' : 'Status Aman'}
              </span>
            </div>
            
            {metrics.sisaAyam <= 30 ? (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">Urgent</span>
                    <span className="font-black text-sm text-slate-800 uppercase">Auto-Procurement: Jadwalkan Turun Ayam (1.020 KG)</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-600">Sisa ayam gudang {formatNumber(metrics.sisaAyam)} KG. Siapkan PO 1 Ton untuk dikirim segera. Est Dana: Rp 38.250.000.</div>
                </div>
                <button className="bg-white border border-slate-200 text-slate-800 font-black text-[10px] uppercase px-3 py-2 rounded-lg shadow-sm hover:bg-slate-50 shrink-0 ml-4">Buat PO Belanja</button>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 font-bold text-xs bg-slate-50 rounded-xl border border-dashed">
                Stok Ayam Aman. Tidak ada rekomendasi darurat dari sistem.
              </div>
            )}
          </div>

          {/* TREN OMZET */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h3 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-emerald-500"/> Tren Omzet Global (7 Hari Terakhir)</h3>
            <div className="h-40 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed text-slate-400 font-bold text-xs flex-col">
              <div className="text-2xl font-black text-emerald-600 mb-1">{formatRupiah(metrics.omzet7Hari)}</div>
              <div>Akumulasi Omzet 7 Hari Kebelakang</div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: GUDANG FISIK */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-5 text-white">
            <h3 className="font-black text-xs uppercase text-slate-300 flex items-center gap-2 mb-5"><Package size={14} className="text-blue-400"/> Fisik Gudang &amp; Freezer Pusat</h3>
            
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Daging Ayam Mentah</div>
              <div className="text-3xl font-black text-rose-400 mt-1">{formatNumber(metrics.sisaAyam)} <span className="text-sm">KG</span></div>
              <div className="mt-2 text-[9px] font-bold text-rose-300 bg-rose-500/10 px-2 py-1 rounded inline-block border border-rose-500/20">
                Setara {formatNumber(metrics.sisaAyam / 30)} Batch Adukan
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Dimsum Frozen</div>
              <div className="text-3xl font-black text-blue-400 mt-1">{formatNumber(metrics.sisaFrozen)} <span className="text-sm">PCS</span></div>
              <div className="mt-2 text-[9px] font-bold text-blue-300 bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20">
                Setara {formatNumber(metrics.sisaFrozen / 20)} Mika
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
