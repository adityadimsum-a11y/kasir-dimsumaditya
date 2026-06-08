import React, { useMemo } from 'react';
import { 
  Activity, Wallet, AlertCircle, TrendingUp, ShieldAlert, 
  ShoppingCart, Factory, Package, ArrowRight, CheckCircle, 
  Clock, AlertTriangle, Coins, Store, Smartphone
} from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabDashboard({ 
  orders, purchases, stockMovements, inventoryCostLayers, supplierLedger, 
  cashflowTransactions, distributionOrders, financialClosings, user, handleTabChange 
}) {
  const todayStr = getTodayStr();

  // ==============================================================
  // EAGLE EYE OPERATION CENTER ENGINE (PHASE 12.5)
  // ==============================================================
  const operationCenter = useMemo(() => {
    const today = new Date(todayStr);
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    // 1. REVENUE & PROFIT HARI INI
    let revToday = 0, profitToday = 0, rev30D = 0;
    let pcsSoldToday = 0;
    let offlineRev = 0, marketplaceRev = 0;

    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const date = getLocalYMD(o.date);
      const isMarketplace = o.sales_category === 'MERCHANT' || o.sales_category === 'TOKO_ONLINE';
      const netAmount = Number(o.total) - (Number(o.fee_amount)||0) - (Number(o.marketplace_promo)||0);

      if (date === todayStr) { 
          revToday += netAmount; 
          profitToday += Number(o.net_profit) || 0; 
          pcsSoldToday += Number(o.qty) || 0;

          if(isMarketplace) marketplaceRev += netAmount;
          else offlineRev += netAmount;
      }
      if (date >= str30Days) { rev30D += netAmount; }
    });

    // 2. STATUS HUTANG & DAYA BELI
    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
        if(l.isDeleted) return;
        const amt = Number(l.amount) || 0;
        if (l.transaction_type === 'PURCHASE') hutangAyamAktif += amt;
        if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= amt;
    });

    // 3. INVENTORY FISIK (AYAM & DIMSUM FROZEN)
    let ayamGudangKg = 0;
    let frozenReadyPcs = 0;
    (inventoryCostLayers || []).forEach(l => {
        if(l.isDeleted || l.status !== 'ACTIVE') return;
        if(String(l.item_name).toUpperCase() === 'AYAM') ayamGudangKg += Number(l.qty_remaining) || 0;
        if(String(l.item_name).toUpperCase().includes('DIMSUM')) frozenReadyPcs += Number(l.qty_remaining) || 0;
    });

    // 4. PRODUKSI HARI INI (Dari Stock Movements)
    let pcsProducedToday = 0;
    (stockMovements || []).forEach(m => {
        if(!m.isDeleted && getLocalYMD(m.date) === todayStr && m.movement_type === 'PRODUCTION_RESULT') {
            pcsProducedToday += Number(m.qty) || 0;
        }
    });

    return { 
        revToday, profitToday, rev30D, pcsSoldToday, offlineRev, marketplaceRev,
        hutangAyamAktif, ayamGudangKg, frozenReadyPcs, pcsProducedToday
    };
  }, [orders, supplierLedger, inventoryCostLayers, stockMovements, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. HEADER & GREETING */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-blue-600">
          <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wide">HQ Dashboard</h1>
              <p className="text-xs font-bold text-slate-500 mt-1">Sistem Komando Utama Dimsum Aditya — <span className="text-blue-600">{todayStr}</span></p>
          </div>
          <div className="flex gap-3">
              <button onClick={() => handleTabChange('orders')} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition flex items-center gap-2"><ShoppingCart size={16}/> Kasir Pusat</button>
              <button onClick={() => handleTabChange('cash_war_room')} className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition flex items-center gap-2"><Activity size={16}/> War Room</button>
          </div>
      </div>

      {/* 2. REAL-TIME FISIK & REVENUE SNAPSHOT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: OMZET HARI INI */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-3xl flex items-center justify-center"><Wallet className="text-emerald-500" size={24}/></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue Hari Ini</div>
            <div className="text-2xl font-black text-slate-800">{formatRp(operationCenter.revToday)}</div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Profit: {formatRp(operationCenter.profitToday)}</span>
            </div>
        </div>

        {/* CARD 2: PENJUALAN OFFLINE VS MARKETPLACE */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-3xl flex items-center justify-center"><TrendingUp className="text-blue-500" size={24}/></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kinerja Saluran Sales</div>
            <div className="text-2xl font-black text-slate-800">{operationCenter.pcsSoldToday.toLocaleString('id-ID')} <span className="text-sm">Pcs Terjual</span></div>
            <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase">
                <span className="flex items-center gap-1 text-slate-600"><Store size={10}/> {formatRp(operationCenter.offlineRev)}</span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-orange-600"><Smartphone size={10}/> {formatRp(operationCenter.marketplaceRev)}</span>
            </div>
        </div>

        {/* CARD 3: BEBAN HUTANG AKTIF */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 relative overflow-hidden border-b-4 border-b-rose-500">
            <div className="absolute right-0 top-0 w-16 h-16 bg-rose-50 rounded-bl-3xl flex items-center justify-center"><ShieldAlert className="text-rose-500" size={24}/></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hutang Supplier (Ayam)</div>
            <div className="text-2xl font-black text-rose-600">{formatRp(operationCenter.hutangAyamAktif)}</div>
            <div className="mt-3 text-[10px] font-bold text-slate-500">
                ⚠️ Menunggu pelunasan dari Kas.
            </div>
        </div>

        {/* CARD 4: STOK AYAM GUDANG */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-amber-50 rounded-bl-3xl flex items-center justify-center"><Package className="text-amber-500" size={24}/></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ayam Mentah (Gudang)</div>
            <div className={`text-2xl font-black ${operationCenter.ayamGudangKg < 30 ? 'text-rose-600' : 'text-slate-800'}`}>
                {operationCenter.ayamGudangKg.toLocaleString('id-ID')} <span className="text-sm">KG</span>
            </div>
            <div className="mt-3 text-[10px] font-bold text-slate-500">
                {operationCenter.ayamGudangKg < 30 ? <span className="text-rose-600 font-black flex items-center gap-1"><AlertTriangle size={12}/> Kurang dari 1 Adukan!</span> : <span>Stok aman untuk produksi.</span>}
            </div>
        </div>

      </div>

      {/* 3. MIDDLE SECTION: LIVE OPERATION BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* PANEL KIRI: PRODUKSI & INVENTORY (2 Kolom) */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-6 relative">
              <div className="absolute right-0 bottom-0 opacity-10"><Factory size={200} className="text-white"/></div>
              <div className="relative z-10">
                  <h3 className="font-black text-white text-lg tracking-wide flex items-center gap-2 mb-6"><Activity className="text-emerald-400"/> Live Production & Inventory</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimsum Selesai Diproduksi Hari Ini</div>
                          <div className="text-3xl font-black text-emerald-400">{operationCenter.pcsProducedToday.toLocaleString('id-ID')} <span className="text-sm text-slate-300">Pcs</span></div>
                          <div className="text-xs font-bold text-slate-500 mt-2">Masuk ke Freezer Pusat</div>
                      </div>
                      
                      <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Stok Dimsum (Ready Jual)</div>
                          <div className="text-3xl font-black text-white">{operationCenter.frozenReadyPcs.toLocaleString('id-ID')} <span className="text-sm text-slate-300">Pcs</span></div>
                          <div className="text-xs font-bold text-slate-500 mt-2">Valuasi aktif di Freezer</div>
                      </div>
                  </div>

                  <div className="mt-6 flex gap-4">
                      <button onClick={() => handleTabChange('stok')} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition">Input Batch Produksi</button>
                      <button onClick={() => handleTabChange('master_data')} className="bg-transparent border border-slate-600 hover:bg-slate-800 text-slate-300 px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition">Cek Master Packaging</button>
                  </div>
              </div>
          </div>

          {/* PANEL KANAN: QUICK ALERTS & TASKS (1 Kolom) */}
          <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 flex flex-col">
              <h3 className="font-black text-slate-800 text-sm tracking-wide flex items-center gap-2 mb-4 uppercase"><AlertCircle className="text-amber-500"/> System Alerts</h3>
              
              <div className="flex-1 space-y-3">
                  {operationCenter.hutangAyamAktif > 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                          <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5"/>
                          <div>
                              <div className="text-xs font-black text-rose-800 uppercase">Hutang Supplier Aktif</div>
                              <div className="text-[10px] text-rose-600 font-bold mt-1">Anda memiliki beban hutang {formatRp(operationCenter.hutangAyamAktif)}. Cek kas sebelum belanja ayam lagi.</div>
                          </div>
                      </div>
                  )}

                  {operationCenter.ayamGudangKg < 60 && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                          <div>
                              <div className="text-xs font-black text-amber-800 uppercase">Stok Ayam Menipis</div>
                              <div className="text-[10px] text-amber-700 font-bold mt-1">Sisa di gudang: {operationCenter.ayamGudangKg} KG. Segera order ke supplier untuk produksi besok.</div>
                          </div>
                      </div>
                  )}

                  {(operationCenter.hutangAyamAktif === 0 && operationCenter.ayamGudangKg >= 60) && (
                      <div className="flex flex-col items-center justify-center text-center py-8 opacity-60">
                          <CheckCircle size={32} className="text-emerald-500 mb-2"/>
                          <div className="text-xs font-black text-emerald-700 uppercase">Semua Sistem Normal</div>
                          <div className="text-[10px] font-bold text-slate-500 mt-1">Tidak ada peringatan mendesak.</div>
                      </div>
                  )}
              </div>
              
              <button onClick={() => handleTabChange('purchases')} className="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2">Buka Modul Belanja <ArrowRight size={14}/></button>
          </div>

      </div>
    </div>
  );
}
