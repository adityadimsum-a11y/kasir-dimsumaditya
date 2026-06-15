import React, { useMemo } from 'react';
import { 
  TrendingUp, Wallet, Package, Users, AlertCircle, BarChart3, 
  ShieldCheck, Landmark, Globe, ArrowRightLeft, CreditCard,
  Building2, Banknote, Activity
} from 'lucide-react';
import { getTodayStr } from '../../utils/helpers';

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
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* 🚀 HERO BANNER GLOBAL HQ RADAR */}
      <div className="card-holo p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden bg-slate-900 border-none shadow-xl">
        <div className="absolute left-0 top-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-blue-500"></div>
        
        <div className="relative z-10 w-full md:w-2/3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="text-blue-400" size={24} /> 
            <h2 className="text-xl font-black normal-case text-white tracking-tight">Global HQ Command Center</h2>
          </div>
          <p className="text-[11px] font-medium text-slate-400 normal-case leading-relaxed">
            Ringkasan eksekutif kekayaan bersih pabrik. Memantau rasio uang kas, beban hutang logistik, tagihan agen, dan total valuasi seluruh gudang freezer secara real-time.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1.5 shadow-xs"><ShieldCheck size={12}/> Server Aktif</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">{todayStr}</span>
          </div>
        </div>

        {/* VALUASI KEKAYAAN BERSIH */}
        <div className="relative z-10 w-full md:w-auto shrink-0 bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-inner backdrop-blur-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Landmark size={12}/> Kekayaan Bersih Pabrik</div>
          <div className={`text-3xl lg:text-4xl font-black tracking-tighter ${macroStats.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatRupiah(macroStats.netWorth)}
          </div>
          <div className="text-[9px] font-medium text-slate-500 normal-case mt-1.5 leading-tight max-w-[200px]">
            *(Kas Liquid + Piutang + Valuasi Aset) - Hutang Berjalan*
          </div>
        </div>
      </div>

      {/* 📊 MATRIKS KEUANGAN & LIKUIDITAS (THE BIG FOUR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KAS RIIL */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Banknote size={48} className="text-emerald-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wallet size={12} className="text-emerald-500"/> Kas Liquid (Di Tangan)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.kasLiquid)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Saldo gabungan Laci Kasir & Rekening Bank.</div>
        </div>

        {/* PIUTANG AGEN */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowRightLeft size={48} className="text-blue-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp size={12} className="text-blue-500"/> Piutang Agen (Aset Luar)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.totalPiutangAgen)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Uang perusahaan yang belum dibayar agen.</div>
        </div>

        {/* HUTANG SUPPLIER */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-2xs relative overflow-hidden group border-t-4 border-t-rose-500 bg-rose-50/10">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertCircle size={48} className="text-rose-600"/></div>
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CreditCard size={12}/> Hutang Logistik (Kewajiban)</div>
          <div className="text-2xl font-black text-rose-700 tracking-tight">{formatRupiah(macroStats.totalHutangGlobal)}</div>
          <div className="text-[9px] font-bold text-rose-500/70 mt-2">Tagihan supplier ayam & plastik yang harus dilunasi.</div>
        </div>

        {/* VALUASI BARANG FISIK */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package size={48} className="text-amber-600"/></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={12} className="text-amber-500"/> Valuasi Aset Fisik (HPP)</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(macroStats.totalValuasiAset)}</div>
          <div className="text-[9px] font-bold text-slate-500 mt-2">Nilai modal barang matang & mentah di seluruh gudang.</div>
        </div>
      </div>

      {/* 🏭 STATUS KAPASITAS GUDANG & PRODUKSI LINTAS CABANG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RADAR GUDANG PUSAT TANGERANG */}
        <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Building2 size={16} className="text-blue-600"/>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide">Radar Valuasi: Tangerang Pusat</h3>
          </div>
          <div className="p-5 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-slate-400 normal-case mb-0.5">Nilai HPP Barang Tersimpan</div>
              <div className="text-xl font-black text-slate-800">{formatRupiah(macroStats.valuasiGudangPusat)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 normal-case mb-0.5">Status Lokasi</div>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black border border-blue-100">MARKAS UTAMA</span>
            </div>
          </div>
        </div>

        {/* RADAR GUDANG PRODUKSI PEMALANG */}
        <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Factory size={16} className="text-amber-600"/>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide">Radar Valuasi: Produksi Pemalang</h3>
          </div>
          <div className="p-5 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-slate-400 normal-case mb-0.5">Nilai HPP Barang Tersimpan</div>
              <div className="text-xl font-black text-slate-800">{formatRupiah(macroStats.valuasiGudangPemalang)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 normal-case mb-0.5">Kapasitas Dimsum Global</div>
              <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-black border border-amber-200">{formatNumber(macroStats.stokDimsumGlobal)} Pcs</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
