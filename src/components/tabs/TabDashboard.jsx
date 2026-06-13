import React, { useMemo } from 'react';
import { 
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, 
  AlertOctagon, ShieldCheck, Database, Layers, Package,
  ArrowRight
} from 'lucide-react';
import { safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ 
  orders = [], orders_data,
  inventoryCostLayers = [], inventory_cost_layers,
  productionBatches = [], production_batches,
  cashflowTransactions = [], cashflow_transactions,
  supplierInvoices = [], supplier_invoices,
  setActiveTab // Di-bypass aman
}) {

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, production_batches]);
  const realCashflow = useMemo(() => cashflow_transactions || cashflowTransactions || [], [cashflow_transactions, cashflowTransactions]);
  const realInvoices = useMemo(() => supplier_invoices || supplierInvoices || [], [supplier_invoices, supplierInvoices]);

  // --- ENGINE KALKULATOR UTAMA ---
  const ringkasan = useMemo(() => {
    let totalKas = 0;
    realCashflow.forEach(c => {
      if (!c.isDeleted) {
        if (c.type === 'IN') totalKas += Number(c.amount || 0);
        if (c.type === 'OUT') totalKas -= Number(c.amount || 0);
      }
    });

    let totalPiutang = 0;
    realOrders.forEach(o => {
      if (!o.isDeleted) {
        const tagihan = Number(o.total_amount || 0);
        const masuk = Number(o.amount_paid || 0);
        if (tagihan > masuk) totalPiutang += (tagihan - masuk);
      }
    });

    let totalHutang = 0;
    realInvoices.forEach(inv => {
      if (!inv.isDeleted && inv.status_payment === 'BELUM_LUNAS') {
        totalHutang += Number(inv.remaining_bill || inv.total_bill || 0);
      }
    });

    let nilaiAsetGudang = 0;
    let sisaAyamKantong = 0;
    realInventory.forEach(inv => {
      if (!inv.isDeleted) {
        nilaiAsetGudang += (Number(inv.qty_remaining || 0) * Number(inv.unit_cost || 0));
        if (inv.category === 'BAHAN_BAKU') sisaAyamKantong += Number(inv.qty_remaining || 0);
      }
    });

    let sisaDimsumPcs = 0;
    realProduction.forEach(b => {
      if (!b.isDeleted) sisaDimsumPcs += Number(b.actual_yield || b.qty || 0);
    });
    realOrders.forEach(o => {
      if (!o.isDeleted) {
        const items = safeJsonParse(o.items, []);
        items.forEach(i => { sisaDimsumPcs -= Number(i.qty || 0); });
      }
    });

    let omzetSeminggu = 0;
    realOrders.forEach(o => {
      if (!o.isDeleted) omzetSeminggu += Number(o.total_amount || 0);
    });

    return {
      totalKas, totalPiutang, totalHutang, nilaiAsetGudang,
      sisaAyamKantong, sisaAyamKg: sisaAyamKantong * 10,
      sisaDimsumPcs, sisaDimsumMika: Math.floor(sisaDimsumPcs / 50),
      omzetSeminggu
    };
  }, [realOrders, realInventory, realProduction, realCashflow, realInvoices]);

  const isAyamKritis = ringkasan.sisaAyamKantong <= 5;

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* BANNER HEAD */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div>
           <h2 className="text-white font-black uppercase tracking-widest text-lg flex items-center gap-2">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
             Dashboard Utama &amp; Keuangan Pabrik
           </h2>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Sistem Pemantauan Terpadu Dimsum Aditya Exp — Real-time &amp; Terkunci</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right min-w-[200px] shadow-inner">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Uang Aset Gudang (HPP)</div>
          <div className="text-xl font-black text-white tracking-tight">{formatRupiah(ringkasan.nilaiAsetGudang)}</div>
        </div>
      </div>

      {/* INDIKATOR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>Uang di Dompet Perusahaan (Kas Bersih)</span>
              <Wallet size={14} className="text-blue-500"/>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{formatRupiah(ringkasan.totalKas)}</div>
          </div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-4 border-t pt-2 border-slate-100">Total dana tunai &amp; saldo bank yang siap dipakai belanja.</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>Total Sisa Bon / Piutang Agen</span>
              <ArrowUpRight size={14} className="text-amber-500"/>
            </div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">{formatRupiah(ringkasan.totalPiutang)}</div>
          </div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-4 border-t pt-2 border-slate-100">Uang nota pesanan lunas sebagian / belum dibayar oleh mitra.</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-rose-400 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>Hutang Belum Bayar ke Supplier</span>
              <ArrowDownRight size={14} className="text-rose-500"/>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">{formatRupiah(ringkasan.totalHutang)}</div>
          </div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-4 border-t pt-2 border-slate-100">Kewajiban tagihan bon belanja daging ayam mentah gantung.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          
          {/* REMINDER PENGINGAT (SAFE LOCK GUARD BYPASS) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><AlertOctagon size={14} className="text-blue-500"/> Sistem Pengingat Belanja Otomatis</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isAyamKritis ? 'bg-rose-100 text-rose-700 animate-pulse border border-rose-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {isAyamKritis ? 'Wajib Order Hari Ini' : 'Stok Aman'}
              </span>
            </div>

            {isAyamKritis ? (
              <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="space-y-1">
                   <h4 className="font-black text-rose-800 uppercase text-xs flex items-center gap-1.5">🚨 PERINGATAN: STOK AYAM FILLET MENIPIS DI BAWAH BATAS AMAN!</h4>
                   <p className="text-[10px] font-bold text-rose-600/90 uppercase leading-relaxed max-w-xl">
                     Sisa daging mentah di freezer tinggal {ringkasan.sisaAyamKantong} Kantong ({ringkasan.sisaAyamKg} Kg). Segera lakukan pemesanan drop ayam baru ke supplier logistik.
                   </p>
                 </div>
                 <button 
                   type="button" 
                   onClick={() => {
                     // 🔥 SAFE RETRIEVAL: JIKA APPMENU NGASIH IJIN MAKA JALAN, JIKA TIDAK MAKA PACING MANUAL BIAR GA BLANK
                     if (typeof setActiveTab === 'function') {
                       setActiveTab('BELANJA');
                     } else {
                       alert("Silakan klik menu 'Belanja Logistik' di panel menu sebelah kiri Bos Sultan!");
                     }
                   }}
                   className="bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest px-4 py-3.5 rounded-xl shadow-lg hover:bg-rose-700 transition flex items-center gap-2 shrink-0 cursor-pointer"
                 >
                   Buat Nota Belanja <ArrowRight size={14}/>
                 </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center gap-3">
                 <ShieldCheck size={24} className="text-emerald-600 shrink-0"/>
                 <div>
                   <h4 className="font-black text-emerald-800 uppercase text-xs">KONDISI GUDANG AMAN TERKENDALI</h4>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5 tracking-wider">Persediaan daging ayam mentah di pabrik masih di atas batas minimum operasional.</p>
                 </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-500"/> Total Omzet Penjualan (7 Hari Terakhir)</div>
             <div className="bg-slate-50 border p-10 rounded-2xl text-center shadow-inner flex flex-col items-center justify-center">
                <div className="text-4xl font-black text-emerald-600 tracking-tight mb-2">{formatRupiah(ringkasan.omzetSeminggu)}</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Akumulasi total nilai nota transaksi kasir seminggu terakhir</div>
             </div>
          </div>
        </div>

        {/* KANTONG GUDANG */}
        <div className="lg:col-span-4 bg-[#151a25] rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="space-y-5">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-3"><Database size={14} className="text-blue-400"/> Kondisi Fisik Gudang Pusat</div>
            
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-inner">
              <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Layers size={10}/> Sisa Daging Ayam Mentah Fillet</div>
              <div className="text-2xl font-black text-white tracking-tight">{formatNumber(ringkasan.sisaAyamKg)} <span className="text-xs text-slate-500 font-bold">KG</span></div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5 pt-1.5 border-t border-slate-800/80">
                Setara: <span className="text-amber-400 font-black">{formatNumber(ringkasan.sisaAyamKantong)} Kantong</span> | ≈ {formatNumber(Math.floor(ringkasan.sisaAyamKg / 30))} Adukan
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-inner">
              <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Package size={10}/> Sisa Dimsum Frozen Di Freezer</div>
              <div className="text-2xl font-black text-white tracking-tight">{formatNumber(ringkasan.sisaDimsumPcs)} <span className="text-xs text-slate-500 font-bold">PCS</span></div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5 pt-1.5 border-t border-slate-800/80">
                Setara: <span className="text-emerald-400 font-black">{formatNumber(ringkasan.sisaDimsumMika)} Mika</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
             <span>Status Sistem: Terkunci</span>
             <span>v2.1 — Sultan Edition</span>
          </div>
        </div>

      </div>
    </div>
  );
}
