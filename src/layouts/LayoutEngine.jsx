import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Activity, Factory, Truck, 
  Wallet, Users, Database, LogOut, Menu, X, ShieldCheck, 
  Send, Store, Package, Lock, Globe, Landmark, AlertTriangle, ShieldAlert,
  Archive, BookOpen
} from 'lucide-react';

import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutEngine({ user, activeTab, setActiveTab, handleLogout, masterCapabilities, children }) {
  // 🔥 STATE MENU MOBILE TETAP KOKOH DAN AMAN
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const todayStr = getTodayStr();

  const nodeCapability = useMemo(() => {
    if (!masterCapabilities || masterCapabilities.length === 0) {
      return { branch_type: user?.branch_type || 'UNKNOWN' };
    }
    return masterCapabilities.find(c => c.branch_type === user?.branch_type) || {};
  }, [masterCapabilities, user?.branch_type]);

  const menuGroups = useMemo(() => {
    const groups = [];

    // =====================================
    // 1. COMMAND CENTER (DASHBOARD & RADAR)
    // =====================================
    const dashboardItems = [];
    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        dashboardItems.push({ id: 'dashboard', label: 'Global HQ Radar', icon: Globe });
        dashboardItems.push({ id: 'business_radar', label: 'Business Radar', icon: Activity });
        dashboardItems.push({ id: 'monitoring_pemalang', label: 'Monitor Pemalang', icon: Factory });
    } else {
        dashboardItems.push({ id: 'dashboard_branch', label: 'Dashboard Node', icon: LayoutDashboard });
    }
    if (dashboardItems.length > 0) groups.push({ groupName: "Command Center", items: dashboardItems });

    // =====================================
    // 2. CORE OPERATIONS (TRANSAKSI & LOGISTIK)
    // =====================================
    const coreItems = [];
    if (nodeCapability.can_marketplace === true || nodeCapability.can_marketplace === 'true') {
        coreItems.push({ id: 'orders', label: 'POS & Penjualan', icon: ShoppingCart });
    }
    if (nodeCapability.can_production === true || nodeCapability.can_production === 'true') {
        coreItems.push({ id: 'stok', label: 'Laporan Produksi', icon: Factory });
    }
    if (nodeCapability.can_purchase === true || nodeCapability.can_purchase === 'true') {
        coreItems.push({ id: 'purchases', label: 'Belanja & Kas Keluar', icon: Truck });
        // 🔥 KABEL MENU BARU: BUKU JANTUNG PABRIK SUPPLIER AYAM
        coreItems.push({ id: 'supplier_ayam', label: 'Buku Nana Ayam', icon: BookOpen });
    }
    
    coreItems.push({ id: 'kartu_stok', label: 'Kartu Stok & Gudang', icon: Archive });

    if (nodeCapability.can_distribution === true || nodeCapability.can_distribution === 'true') {
        coreItems.push({ id: 'distribusi', label: 'Distribusi Global', icon: Send });
    }
    
    coreItems.push({ id: 'discrepancy', label: 'Stok Basi / Opname', icon: AlertTriangle });

    if (coreItems.length > 0) groups.push({ groupName: "Core Operations", items: coreItems });

    // =====================================
    // 3. FINANCE & SETTLEMENT (KEUANGAN & SDM)
    // =====================================
    const financeItems = [];
    if (nodeCapability.can_treasury === true || nodeCapability.can_treasury === 'true') {
        financeItems.push({ id: 'cash_war_room', label: 'Dompet Perusahaan', icon: Wallet });
        financeItems.push({ id: 'piutang', label: 'Manajemen Piutang', icon: Landmark });
    }
    if (nodeCapability.can_accounting === true || nodeCapability.can_accounting === 'true') {
        financeItems.push({ id: 'accounting', label: 'Laba Rugi & Aset', icon: Database });
    }
    if (nodeCapability.can_payroll === true || nodeCapability.can_payroll === 'true') {
        financeItems.push({ id: 'karyawan', label: 'Smart Payroll & SDM', icon: Users });
    }
    
    financeItems.push({ id: 'setoran_cabang', label: 'Closing & Settlement', icon: Lock });
    
    if (financeItems.length > 0) groups.push({ groupName: "Finance & Settlement", items: financeItems });

    // =====================================
    // 4. SYSTEM & CONFIGURATION
    // =====================================
    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        groups.push({ 
            groupName: "System Configuration", 
            items: [
              { id: 'master_data', label: 'Master Data & Rules', icon: Database },
              { id: 'accounting_audit', label: 'Log Sampah (Audit)', icon: ShieldAlert } 
            ] 
        });
    }

    return groups;
  }, [nodeCapability]);

  const themeConfig = useMemo(() => {
      const type = user?.branch_type;
      if (type === 'HQ_FACTORY') return { bg: 'bg-red-600', text: 'text-red-600', ring: 'ring-red-500', icon: ShieldCheck, title: 'TANGERANG PUSAT' };
      if (type === 'PRODUCTION_BRANCH') return { bg: 'bg-orange-600', text: 'text-orange-600', ring: 'ring-orange-500', icon: Factory, title: 'PRODUKSI PEMALANG' };
      if (type === 'OUTLET_RESTO') return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-400', icon: Store, title: 'OUTLET RESTO' };
      if (type === 'FRANCHISE') return { bg: 'bg-rose-600', text: 'text-rose-600', ring: 'ring-rose-500', icon: Package, title: 'FRANCHISE NODE' };
      return { bg: 'bg-slate-800', text: 'text-slate-800', ring: 'ring-slate-700', icon: LayoutDashboard, title: 'SYSTEM NODE' };
  }, [user?.branch_type]);

  return (
    <div className="h-full w-full bg-slate-50 flex overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* 🔥 REVISI: SIDEBAR DIUBAH MENJADI PUTIH BERSIH FLAT ALA GRABMERCHANT */}
      <aside 
        className="fixed inset-y-0 left-0 z-50 w-72 text-slate-700 bg-white transition-transform duration-300 ease-in-out flex flex-col lg:translate-x-0 lg:static lg:flex-shrink-0 border-r border-slate-200 shadow-sm"
      >
        {/* LOGO AREA - WHITE SOLID FLAT */}
        <div className="h-20 flex items-center px-6 justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
              <img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo Dimsum Aditya" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="font-black text-slate-800 text-sm tracking-wider uppercase leading-none">{themeConfig.title}</h1>
              <span className={`text-[9px] font-black ${themeConfig.text} uppercase tracking-widest block mt-1`}>Dimsum Aditya ERP</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {/* NAVIGATION - SCROLLABLE WHITE BACKGROUND */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-5 mt-2 custom-scrollbar bg-white">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{group.groupName}</h2>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? `${themeConfig.bg} text-white shadow-sm font-black` : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'}`}
                    >
                      <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* USER PROFILE BOX - CLEAN LIGHT FOOTER SECTION */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className={`w-8 h-8 rounded-full ${themeConfig.bg} flex items-center justify-center font-black text-white text-xs uppercase border border-white/20`}>
              {(user?.name || user?.username || 'U').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-slate-800 truncate uppercase">{user?.name || user?.username || 'USER'}</div>
              <div className="text-[9px] font-black text-slate-400 uppercase truncate">{user?.branch_id.replace('_', ' ') || 'NODE'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors uppercase tracking-wide border border-transparent hover:border-red-200">
            <LogOut size={14} /> Logout Sistem
          </button>
        </div>
      </aside>

      {/* RIGHT CONTAINER - CLEAN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative bg-slate-50">
        
        {/* SOLID BAR HEADER */}
        <header className="h-20 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative z-20 bg-white shadow-xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={22} /></button>
            <div>
              <div className="font-black text-slate-800 text-base uppercase tracking-wide">
                Terminal Operasional <span className={themeConfig.text}>/ {user?.branch_id.replace('_', ' ') || 'NODE'}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatDate(todayStr)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-inner">
              <div className={`w-2 h-2 rounded-full ${themeConfig.bg} animate-pulse`}></div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hidden sm:inline-block">Online &amp; Tersinkronisasi</span>
            </div>
          </div>
        </header>
        
        {/* RE-ADJUST WORKSPACE BLUR REMOVED */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 custom-scrollbar">
           <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
