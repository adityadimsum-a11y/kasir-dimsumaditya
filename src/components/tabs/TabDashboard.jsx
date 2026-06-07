import React, { useMemo } from 'react';
import { Activity, Wallet, TrendingUp, AlertCircle, Package, DollarSign, PieChart, ShieldAlert } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';

export default function TabDashboard({ 
    orders, purchases, inventoryCostLayers, supplierLedger, cashflowTransactions, systemTasks, user 
}) {
    const todayStr = getTodayStr();

    // ==========================================
    // 1. ENGINE LABA BERSIH (REALTIME HARI INI)
    // ==========================================
    const netProfitToday = useMemo(() => {
        return (orders || [])
            .filter(o => o.date === todayStr && !o.isDeleted)
            .reduce((sum, o) => sum + (Number(o.net_profit) || 0), 0);
    }, [orders, todayStr]);

    const grossRevenueToday = useMemo(() => {
        return (orders || [])
            .filter(o => o.date === todayStr && !o.isDeleted)
            .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    }, [orders, todayStr]);

    // ==========================================
    // 2. ENGINE VALUASI ASET INVENTORY (FIFO)
    // ==========================================
    const totalAssetValue = useMemo(() => {
        return (inventoryCostLayers || [])
            .filter(l => l.status === 'ACTIVE' && Number(l.qty_remaining) > 0 && !l.isDeleted)
            .reduce((sum, l) => sum + (Number(l.qty_remaining) * Number(l.unit_cost)), 0);
    }, [inventoryCostLayers]);

    // ==========================================
    // 3. ENGINE HUTANG AKTIF (AP)
    // ==========================================
    const hutangAktif = useMemo(() => {
        let hutang = 0;
        (supplierLedger || []).filter(l => !l.isDeleted).forEach(l => {
            if (l.transaction_type === 'PURCHASE') hutang += Number(l.amount);
            if (l.transaction_type === 'PAYMENT') hutang -= Number(l.amount);
        });
        return hutang > 0 ? hutang : 0;
    }, [supplierLedger]);

    // ==========================================
    // 4. ENGINE CASH READY
    // ==========================================
    const cashReady = useMemo(() => {
        let cash = 0;
        (cashflowTransactions || []).filter(c => !c.isDeleted).forEach(c => {
            if (c.type === 'CASH_IN') cash += Number(c.amount);
            if (c.type === 'CASH_OUT') cash -= Number(c.amount);
        });
        return cash;
    }, [cashflowTransactions]);

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* WELCOME BANNER */}
            <div className="bg-slate-900 rounded-2xl p-8 relative overflow-hidden shadow-xl border border-slate-800 flex items-center justify-between">
                <div className="absolute -top-24 -right-24 text-slate-800 opacity-50"><PieChart size={250}/></div>
                <div className="relative z-10 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={20} className="text-emerald-400"/>
                        <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Executive View (Super Admin)</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight">Selamat Datang, {user.name}!</h2>
                    <p className="text-slate-400 font-medium mt-1">Sistem ERP sedang memantau seluruh pergerakan HPP, Kas, dan Cabang secara Real-Time.</p>
                </div>
            </div>

            {/* FINANCIAL METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* LABA BERSIH HARI INI */}
                <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Laba Bersih Hari Ini</div>
                        <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><TrendingUp size={18}/></div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600">{formatRp(netProfitToday)}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-2">Dari Omset Kotor: {formatRp(grossRevenueToday)}</div>
                </div>

                {/* VALUASI ASET (INVENTORY) */}
                <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valuasi Aset Gudang</div>
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Package size={18}/></div>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{formatRp(totalAssetValue)}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-2">Total Modal Ayam & Dimsum (FIFO)</div>
                </div>

                {/* HUTANG SUPPLIER (AP) */}
                <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-red-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hutang Aktif (Ayam)</div>
                        <div className="bg-red-100 p-2 rounded-lg text-red-600"><AlertCircle size={18}/></div>
                    </div>
                    <div className="text-2xl font-black text-red-600">{formatRp(hutangAktif)}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-2">Segera jadwalkan pelunasan</div>
                </div>

                {/* CASH READY */}
                <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-indigo-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Uang Kas (Cash Ready)</div>
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Wallet size={18}/></div>
                    </div>
                    <div className="text-2xl font-black text-indigo-600">{formatRp(cashReady)}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-2">Total perputaran uang masuk & keluar</div>
                </div>

            </div>

            {/* AUTOMATION & SYSTEM ALERTS */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-slate-600"/>
                    <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">System Diagnostics</h3>
                </div>
                {hutangAktif > totalAssetValue ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-sm">
                        <AlertCircle size={20} className="text-amber-500 shrink-0"/>
                        <div className="font-medium text-amber-800"><b>Peringatan Arus Kas:</b> Hutang Supplier Anda saat ini lebih besar dari nilai aset gudang. Pastikan penjualan Marketplace segera cair.</div>
                    </div>
                ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex gap-3 text-sm">
                        <CheckCircle size={20} className="text-emerald-500 shrink-0"/>
                        <div className="font-medium text-emerald-800"><b>Sistem Sehat:</b> Valuasi Aset Gudang Anda mampu menutup seluruh hutang supplier yang berjalan.</div>
                    </div>
                )}
            </div>
            
        </div>
    );
}
