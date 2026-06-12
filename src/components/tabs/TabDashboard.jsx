import React, { useMemo } from 'react';
import { Building2, Wallet, Coins, AlertTriangle, TrendingUp, Package, Activity, Cpu } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ orders = [], orders_data, purchases = [], purchases_data, productionBatches = [], production_batches, expenses = [], expenses_data, masterRules = [], user }) {
  const todayStr = getTodayStr();

  // --- 1. SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // --- CORES ATURAN KONVERSI MASTER ADITYA ---
  const rules = useMemo(() => {
    if (masterRules && masterRules.length > 0) {
      return {
        timbangan_mentah: Number(masterRules[0].timbangan_mentah || 10),
        resep_adukan: Number(masterRules[0].resep_adukan || 30),
        target_yield: Number(masterRules[0].target_yield || 1000),
        mika_frozen: Number(masterRules[0].mika_frozen || 50)
      };
    }
    return { timbangan_mentah: 10, resep_adukan: 30, target_yield: 1000, mika_frozen: 50 };
  }, [masterRules]);

  // --- 2. ENGINE KALKULASI RADAR PUSAT ---
  const metrics = useMemo(() => {
    let totalKas = 0; let totalPiutang = 0; let totalHutang = 0;
    let ayamMasukKg = 0; let ayamKeluarKg = 0;
    let frozenMasukPcs = 0; let frozenKeluarPcs = 0;
    let omzet7Hari = 0;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Hitung Uang Masuk & Dimsum Keluar Freezer dari POS Kasir
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const is7Days = new Date(o.date) >= sevenDaysAgo;
      if (is7Days) omzet7Hari += Number(o.total_amount || 0);

      totalKas += Number(o.amount_paid || 0);
      totalPiutang += (Number(o.total_amount || 0) - Number(o.amount_paid || 0));
      
      let totalPcs = 0;
      const itemsArr = safeJsonParse(o.items, []);
      itemsArr.forEach(item => totalPcs += Number(item.qty || 0));
      if (totalPcs === 0) totalPcs = Number(o.qty || 0);

      if (o.delivery_method !== 'PRE_ORDER' || o.status === 'SELESAI') {
        frozenKeluarPcs += totalPcs;
      }
    });

    // Hitung Aliran Hutang Belanja Logistik
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      totalKas -= Number(p.amount_paid || 0);
      totalHutang += (Number(p.total_amount || 0) - Number(p.amount_paid || 0));
      if (p.category === 'BAHAN_BAKU') {
        ayamMasukKg += Number(p.qty_kg || 0);
      }
    });

    // Hitung Laporan Keluar Masuk Barang Dapur Produksi
    realProd.filter(p => !p.isDeleted).forEach(p => {
      ayamKeluarKg += Number(p.total_ayam_kg || 0);
      frozenMasukPcs += Number(p.total_yield_pcs || 0);
    });

    // Hitung Pengeluaran Kas Operasional Manual
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      totalKas -= Number(e.amount || 0);
    });

    const sisaAyam = Math.max(0, ayamMasukKg - ayamKeluarKg);
    const sisaFrozen = Math.max(0, frozenMasukPcs - frozenKeluarPcs);

    // Valuasi Modal Aset Fisik Gudang (Ayam Patokan Rp 37.500/kg, Dimsum Jadi Rp 1.125/pcs)
    const valuasiAset = (sisaAyam * 37500) + (sisaFrozen * 1125);

    // 🔥 ADJUSTMENT ALARM DARURAT: MENYALA JIKA AYAM DIBAWAH KUOTA PRODUKSI AKHIR 1 HARI (340 KG)
    const batasAyamKritis = 340; 
    const isAyamKritis = sisaAyam <= batasAyamKritis;

    return { totalKas, totalPiutang, totalHutang, sisaAyam, sisaFrozen, valuasiAset, omzet7Hari, isAyamKritis };
  }, [realOrders, realPurchases, realProd, realExpenses]);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500 text-slate-800">
      
      {/* HEADER COMMAND CENTER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><Building2 size={200} className="-mt-10 -mr-10"/></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 backdrop-blur-sm"><Cpu size={24} className="text-blue-400"/></div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white drop-shadow-md">Command Center Utama</h2>
            <p className="text-xs font-bold text-slate-400 tracking-wider">MONITOR OPERASIONAL PUSAT — {formatDate(todayStr)}</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-left md:text-right relative z-10">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-sm">Total Nilai Modal Uang Aset Gudang (HPP)</div>
          <div className="text-3xl font-black text-white drop-shadow-lg">{formatRupiah(metrics.valuasiAset)}</div>
        </div>
      </div>

      {/* 3 KARTU KEUANGAN UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 mb-1"><Wallet size={12} className="text-emerald-500"/> Sisa Uang Kas Bersih (Global)</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{formatRupiah(metrics.totalKas)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Total dana tunai dan saldo bank yang siap dipakai.</div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="text-[10px] font-black text-amber-500 uppercase flex items-center gap-2 mb-1"><TrendingUp size={12}/> Total Piutang Mengambang Klien</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{formatRupiah(metrics.totalPiutang)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Uang nota belum lunas dari mitra agen / reseller.</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
          <div className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2 mb-1"><AlertTriangle size={12}/> Sisa Hutang ke Supplier Ayam</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{formatRupiah(metrics.totalHutang)}</div>
          <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Kewajiban tagihan bon gantung yang belum ditransfer.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* SINKRONISASI ALARM JADWAL TURUN AYAM (AUTO PROCUREMENT) */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2"><Activity size={14} className="text-blue-500"/> Sistem Pengingat Belanja Otomatis</h3>
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${metrics.isAyamKritis ? 'bg-rose-100 text-rose-600 animate-pulse border border-rose-200' : 'bg-emerald-100 text-emerald-600'}`}>
                {metrics.isAyamKritis ? 'Wajib Order Hari Ini!' : 'Stok Ayam Aman'}
              </span>
            </div>
            
            {metrics.isAyamKritis ? (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest animate-bounce">Darurat</span>
                    <span className="font-black text-sm text-slate-800 uppercase tracking-wide">Peringatan: Jadwalkan Drop Ayam Baru ke Supplier Nana!</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase">
                    Sisa daging ayam mentah di freezer gudang menipis di bawah batas aman, sisa {formatNumber(metrics.sisaAyam)} KG! Segera kirim PO drop 1.020 KG berikutnya. Est Biaya: Rp 38.250.000.
                  </div>
                </div>
                <button className="w-full sm:w-auto bg-rose-600 border border-rose-700 text-white font-black text-[10px] uppercase px-4 py-3 rounded-lg shadow-md hover:bg-rose-700 shrink-0 transition-transform active:scale-95">Buat Nota Belanja</button>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 font-bold text-xs bg-slate-50 rounded-xl border border-dashed uppercase tracking-wider">
                Stok Bahan Baku Utama Melimpah. Belum memerlukan drop ayam baru.
              </div>
            )}
          </div>

          {/* TREN OMZET */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h3 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-emerald-500"/> Total Pendapatan Kotor (7 Hari Terakhir)</h3>
            <div className="h-32 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed text-slate-400 font-bold text-xs flex-col">
              <div className="text-2xl font-black text-emerald-600 mb-1 tracking-tight">{formatRupiah(metrics.omzet7Hari)}</div>
              <div className="uppercase tracking-widest text-[9px] font-black text-slate-400">Total akumulasi uang masuk kasir seminggu terakhir</div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: MONITOR KONDISI FISIK GUDANG REALTIME */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-5 text-white">
            <h3 className="font-black text-xs uppercase text-slate-300 flex items-center gap-2 mb-5"><Package size={14} className="text-blue-400"/> Kondisi Fisik Gudang Pusat</h3>
            
            {/* STOK AYAM DALAM KANTONG */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Daging Ayam Mentah Fillet</div>
              <div className="text-3xl font-black text-rose-400 mt-1 tracking-tight">{formatNumber(metrics.sisaAyam)} <span className="text-sm font-medium">KG</span></div>
              <div className="mt-2 text-[9px] font-black text-rose-300 bg-rose-500/10 px-2 py-1 rounded inline-block border border-rose-500/20 uppercase tracking-wider">
                Setara {formatNumber(metrics.sisaAyam / rules.resep_adukan)} Adukan Dapur | ± {formatNumber(metrics.sisaAyam / rules.timbangan_mentah)} Kantong
              </div>
            </div>

            {/* STOK DIMSUM DALAM MIKA */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Dimsum Frozen Di Freezer</div>
              <div className="text-3xl font-black text-blue-400 mt-1 tracking-tight">{formatNumber(metrics.sisaFrozen)} <span className="text-sm font-medium">PCS</span></div>
              {/* 🔥 REVISI MATEMATIKA: PEMBAGI DIKUNCI MATI KE 50 PCS PER 1 MIKA (SINKRON!) */}
              <div className="mt-2 text-[9px] font-black text-blue-300 bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20 uppercase tracking-wider">
                Setara {formatNumber(metrics.sisaFrozen / rules.mika_frozen)} Mika Fisik Kotak
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
