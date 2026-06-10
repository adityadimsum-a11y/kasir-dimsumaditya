import React, { useMemo } from 'react';
import { Target, Activity, Zap, Package, Wallet, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';
import { getTodayStr } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabBusinessRadar({ orders = [], orders_data, purchases = [], purchases_data, productionBatches = [], production_batches }) {
  
  // 1. TARIK SEMUA DATA DARI DATABASE PABRIK
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);

  // 2. MESIN PERAMAL (AI PREDICTION ENGINE)
  const radarData = useMemo(() => {
    let ayamGudang = 0;
    let frozenGudang = 0;
    let totalTerjual7Hari = 0;
    let totalUang7Hari = 0;

    const hariIni = new Date();
    const tujuhHariLalu = new Date();
    tujuhHariLalu.setDate(hariIni.getDate() - 7);

    // Hitung Sisa Ayam
    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU').forEach(p => ayamGudang += Number(p.qty_kg || 0));
    realProd.filter(p => !p.isDeleted).forEach(p => ayamGudang -= Number(p.total_ayam_kg || 0));

    // Hitung Sisa Frozen & Jualan 7 Hari Terakhir
    realProd.filter(p => !p.isDeleted).forEach(p => frozenGudang += Number(p.total_yield_pcs || 0));
    
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const qty = Number(o.qty || 0);
      if (o.delivery_method !== 'PRE_ORDER' || o.status === 'SELESAI') {
        frozenGudang -= qty;
      }
      // Rekap 7 Hari untuk bahan prediksi
      if (new Date(o.date) >= tujuhHariLalu) {
        totalTerjual7Hari += qty;
        totalUang7Hari += Number(o.total_amount || 0);
      }
    });

    ayamGudang = Math.max(0, ayamGudang);
    frozenGudang = Math.max(0, frozenGudang);

    // --- RUMUS PREDIKSI MASA DEPAN ---
    // Rata-rata sehari laku berapa Pcs dan dapat uang berapa?
    const rataRataPcsSehari = totalTerjual7Hari / 7;
    const rataRataUangSehari = totalUang7Hari / 7;

    // Prediksi Uang Masuk
    const tebakan7Hari = rataRataUangSehari * 7;
    const tebakan14Hari = rataRataUangSehari * 14;
    const tebakan30Hari = rataRataUangSehari * 30;

    // Prediksi Sisa Waktu Stok Habis (Runway)
    // Ayam: 30kg ayam = 1000 pcs frozen. Jadi 1kg ayam = 33.3 pcs frozen
    const ayamJadiFrozenPcs = ayamGudang * 33.33; 
    let umurAyamHari = rataRataPcsSehari > 0 ? ayamJadiFrozenPcs / rataRataPcsSehari : 999;
    let umurFrozenHari = rataRataPcsSehari > 0 ? frozenGudang / rataRataPcsSehari : 999;

    return {
      tebakan7Hari, tebakan14Hari, tebakan30Hari,
      umurAyamHari: Math.round(umurAyamHari),
      umurFrozenHari: Math.round(umurFrozenHari),
      rataRataPcsSehari: Math.round(rataRataPcsSehari)
    };

  }, [realOrders, realPurchases, realProd]);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      
      {/* KEPALA RADAR */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6 text-white flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-cyan-500/20 p-4 rounded-full border border-cyan-500/30">
            <Target size={28} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase">Radar Bisnis & Mesin Peramal</h2>
            <p className="text-xs text-slate-400 font-bold mt-1">Sistem membaca data jualan minggu lalu untuk menebak nasib pabrik ke depan.</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 rounded-full text-[10px] font-black text-cyan-400 tracking-widest uppercase flex items-center gap-2 relative z-10">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> Radar Aktif
        </div>
      </div>

      {/* ALARM PENGINGAT OTOMATIS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <AlertTriangle size={16} className="text-amber-500"/> Alarm Pengingat Otomatis
        </h3>
        
        <div className="space-y-3">
          {radarData.umurAyamHari <= 3 ? (
            <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><AlertTriangle size={20}/></div>
              <div>
                <h4 className="font-black text-sm text-rose-700 uppercase">AWAS! Ayam Segera Habis</h4>
                <p className="text-xs text-rose-600/80 font-bold mt-1">Sisa ayam di gudang diprediksi ludes dalam {radarData.umurAyamHari} hari lagi. Segera telepon supplier!</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="p-2 bg-slate-200 rounded-lg text-slate-500"><CheckCircle2 size={20}/></div>
              <div>
                <h4 className="font-black text-sm text-slate-600 uppercase">Stok Ayam Terkendali</h4>
                <p className="text-xs text-slate-500 font-bold mt-1">Nafas stok ayam masih panjang ({radarData.umurAyamHari} hari). Pabrik aman beroperasi.</p>
              </div>
            </div>
          )}

          {radarData.umurFrozenHari > 14 ? (
            <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Package size={20}/></div>
              <div>
                <h4 className="font-black text-sm text-amber-700 uppercase">Indikasi Frozen Menumpuk</h4>
                <p className="text-xs text-amber-600/80 font-bold mt-1">Jualan lagi lambat. Stok beku di freezer butuh waktu {radarData.umurFrozenHari} hari buat habis. Genjot tim sales!</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PREDIKSI UANG MASUK */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <Wallet size={16}/> Prediksi Uang Masuk (Omzet)
          </h3>
          <div className="space-y-5">
            <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-3">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tebakan 7 Hari Ke Depan</div>
                <div className="text-xl font-black text-slate-800">{formatRupiah(radarData.tebakan7Hari)}</div>
              </div>
            </div>
            <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-3">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tebakan 14 Hari Ke Depan</div>
                <div className="text-xl font-black text-slate-800">{formatRupiah(radarData.tebakan14Hari)}</div>
              </div>
            </div>
            <div className="flex justify-between items-end bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div>
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Tebakan 1 Bulan Penuh</div>
                <div className="text-2xl font-black text-emerald-700">{formatRupiah(radarData.tebakan30Hari)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* SISA UMUR STOK GUDANG */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <CalendarClock size={16}/> Sisa Waktu Stok Habis
          </h3>
          
          <div className="grid grid-cols-2 gap-4 h-[calc(100%-3rem)]">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-center items-center text-center hover:border-orange-300 transition-colors">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ayam Mentah Ludes Dalam</div>
              <div className="text-4xl font-black text-slate-800">
                {radarData.umurAyamHari === 999 ? '∞' : radarData.umurAyamHari}
              </div>
              <div className="text-xs font-bold text-slate-400 mt-1">Hari Lagi</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-center items-center text-center hover:border-blue-300 transition-colors">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Dimsum Frozen Ludes Dalam</div>
              <div className="text-4xl font-black text-blue-600">
                {radarData.umurFrozenHari === 999 ? '∞' : radarData.umurFrozenHari}
              </div>
              <div className="text-xs font-bold text-slate-400 mt-1">Hari Lagi</div>
            </div>
          </div>
          
          <div className="mt-4 text-center text-[10px] font-bold text-slate-400">
            *Dihitung berdasarkan rata-rata jualan Bro seminggu terakhir ({formatNumber(radarData.rataRataPcsSehari)} Pcs/hari).
          </div>
        </div>

      </div>
    </div>
  );
}
