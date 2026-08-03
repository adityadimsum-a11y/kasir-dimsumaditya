import React, { useMemo } from 'react';
import { 
  TrendingUp, Wallet, Package, Users, AlertCircle, BarChart3, 
  ShieldCheck, Landmark, Globe, ArrowRightLeft, CreditCard,
  Building2, Banknote, Activity, Factory 
} from 'lucide-react';
// 🔥 FIX BUG: formatDate DITAMBAHKAN DI SINI!
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ 
  orders = [], purchases = [], expenses = [], 
  cashflowTransactions = [], inventoryCostLayers = [], 
  supplierLedger = [], piutangPayments = [],
  setActiveTab, user 
}) {
  const todayStr = getTodayStr();

  // =========================================================================
  // 🧠 ENGINE ANALITIK MAKRO (HELICOPTER VIEW SULTAN)
  // =========================================================================
  const macroStats = useMemo(() => {
    // 1. KAS RIIL (UANG DI TANGAN/BANK)
    let totalCashIn = 0;
    let totalCashOut = 0;
    (cashflowTransactions || []).forEach(c => {
      if (!c.isDeleted) {
        if (c.type === 'IN' || c.transaction_type === 'INFLOW' || c.type === 'CASH_IN') totalCashIn += Number(c.amount || 0);
        if (c.type === 'OUT' || c.transaction_type === 'OUTFLOW' || c.type === 'CASH_OUT') totalCashOut += Number(c.amount || 0);
      }
    });
    const kasLiquid = totalCashIn - totalCashOut;

    // 2. PIUTANG (UANG BOS YANG NYANGKUT DI AGEN)
    let totalTagihanKotor = 0;
    let totalTagihanDibayar = 0;
    const piutangMap = {};
    
    (orders || []).forEach(o => {
      if (!o.isDeleted) {
        piutangMap[o.id] = { total: Number(o.total_amount || o.total || 0), paid: Number(o.amount_paid || o.paidAmount || 0) };
      }
    });
    (piutangPayments || []).forEach(p => {
      if (!p.isDeleted && piutangMap[p.orderId]) {
        piutangMap[p.orderId].paid += Number(p.amount || 0);
      }
    });

    Object.values(piutangMap).forEach(p => {
      totalTagihanKotor += p.total;
      totalTagihanDibayar += p.paid;
    });
    const totalPiutangAgen = Math.max(0, totalTagihanKotor - totalTagihanDibayar);

    // 3. HUTANG (KEWAJIBAN BOS KE SUPPLIER PUSAT & PEMALANG)
    let totalHutangAyam = 0;
    (supplierLedger || []).forEach(l => { 
      if (!l.isDeleted) {
        if (l.transaction_type === 'PURCHASE') totalHutangAyam += Number(l.amount || 0);
        if (l.transaction_type === 'PAYMENT') totalHutangAyam -= Number(l.amount || 0);
      }
    });

    let hutangLainnya = 0;
    (purchases || []).forEach(p => {
      if (!p.isDeleted) {
        const htg = Number(p.total_amount || p.amount || 0) - Number(p.paid_amount || 0);
        if (htg > 0 && String(p.payment_method).toUpperCase() !== 'CASH') hutangLainnya += htg;
      }
    });
    const totalHutangGlobal = Math.max(0, totalHutangAyam + hutangLainnya);

    // 4. VALUASI ASET GUDANG (HARTA MATI)
    let valuasiGudangPusat = 0;
    let valuasiGudangPemalang = 0;
    let stokDimsumGlobal = 0;

    (inventoryCostLayers || []).forEach(l => {
      if (!l.isDeleted && l.status === 'ACTIVE') {
        const nilai = Number(l.qty_remaining || 0) * Number(l.unit_cost || 0);
        if (l.branch_id === 'TANGERANG_PUSAT' || l.branch_id === 'PUSAT') {
          valuasiGudangPusat += nilai;
        } else {
          valuasiGudangPemalang += nilai;
        }
        if (String(l.item_name).toUpperCase().includes('DIMSUM')) {
          stokDimsumGlobal += Number(l.qty_remaining || 0);
        }
      }
    });
    const totalValuasiAset = valuasiGudangPusat + valuasiGudangPemalang;

    // 5. KEKAYAAN BERSIH REAL-TIME
    // Rumus Sultan: (Uang Tunai + Piutang Agen + Nilai Barang di Gudang) - Hutang Supplier
    const netWorth = (kasLiquid + totalPiutangAgen + totalValuasiAset) - totalHutangGlobal;

    return { 
      kasLiquid, totalPiutangAgen, totalHutangGlobal, 
      valuasiGudangPusat, valuasiGudangPemalang, totalValuasiAset, 
      stokDimsumGlobal, netWorth 
    };
  }, [orders, purchases, expenses, cashflowTransactions, inventoryCostLayers, supplierLedger, piutangPayments]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HERO BANNER GLOBAL HQ RADAR (FLUID GRADIENT) */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden rounded-3xl shadow-xl border border-slate-800">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 w-full md:w-2/3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="text-blue-400" size={24} /> 
            <h2 className="text-xl font-black text-white tracking-tight">Global HQ Command Center</h2>
          </div>
          <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-lg">
            Ringkasan eksekutif kekayaan bersih pabrik. Memantau rasio uang kas, beban hutang logistik, tagihan agen, dan total valuasi seluruh gudang freezer secara real-time.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1.5 shadow-sm"><ShieldCheck size={12}/> Server Aktif</span>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">{formatDate(todayStr)}</span>
          </div>
        </div>

        {/* VALUASI KEKAYAAN BERSIH */}
        <div className="relative z-10 w-full md:w-auto shrink-0 bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/60 p-6 rounded-2xl shadow-lg backdrop-blur-sm group hover:border-slate-600 transition-colors">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Landmark size={12}/> Estimasi Kekayaan Bersih Pabrik</div>
          <div className={`text-3xl lg:text-4xl font-black tracking-tighter ${macroStats.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatRupiah(macroStats.netWorth)}
          </div>
          <div className="text-[9px] font-medium text-slate-500 mt-2 leading-tight max-w-[220px]">
            *(Kas Dompet + Piutang + Nilai Barang di Gudang) - Hutang Supplier Berjalan*
          </div>
        </div>
      </div>

      {/* 📊 MATRIKS KEUANGAN & LIKUIDITAS (THE BIG FOUR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KAS RIIL */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Banknote size={56} className="text-emerald-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wallet size={14} className="text-emerald-500"/> Total Uang Dompet (Kas Riil)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.kasLiquid)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Saldo riil gabungan Laci Kasir & Rekening Bank.</div>
        </div>

        {/* PIUTANG AGEN */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ArrowRightLeft size={56} className="text-blue-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-blue-500"/> Uang di Luar (Piutang Agen)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.totalPiutangAgen)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Tagihan nota perusahaan yang belum dibayar agen.</div>
        </div>

        {/* HUTANG SUPPLIER */}
        <div className="bg-rose-50/30 p-5 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle size={56} className="text-rose-600"/></div>
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CreditCard size={14}/> Kewajiban Berjalan (Hutang)</div>
          <div className="text-2xl font-black text-rose-700 tracking-tight">{formatRupiah(macroStats.totalHutangGlobal)}</div>
          <div className="text-[9px] font-bold text-rose-500/70 mt-2">Tagihan supplier ayam & plastik yang wajib dilunasi.</div>
        </div>

        {/* VALUASI BARANG FISIK */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={56} className="text-amber-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={14} className="text-amber-500"/> Harta Mati Gudang (Valuasi)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.totalValuasiAset)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Modal mandek berwujud barang mentah/matang di freezer.</div>
        </div>
      </div>

      {/* 🏭 STATUS KAPASITAS GUDANG & PRODUKSI LINTAS CABANG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RADAR GUDANG PUSAT TANGERANG */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Building2 size={18} className="text-blue-600"/>
            <h3 className="font-black text-slate-800 text-sm">Radar Valuasi HPP: Tangerang Pusat</h3>
          </div>
          <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 mb-0.5">Nilai Modal Barang Tersimpan</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.valuasiGudangPusat)}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">Status Lokasi Node</div>
              <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-blue-200 tracking-wider">MARKAS UTAMA</span>
            </div>
          </div>
        </div>

        {/* RADAR GUDANG PRODUKSI PEMALANG */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Factory size={18} className="text-amber-600"/>
            <h3 className="font-black text-slate-800 text-sm">Radar Valuasi HPP: Produksi Pemalang</h3>
          </div>
          <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 mb-0.5">Nilai Modal Barang Tersimpan</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.valuasiGudangPemalang)}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">Kapasitas Dimsum Global (Semua Lokasi)</div>
              <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-[11px] font-black border border-amber-200">{formatNumber(macroStats.stokDimsumGlobal)} Pcs</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
