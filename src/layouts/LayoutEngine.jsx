import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Activity, Factory, Truck, 
  Wallet, Users, Database, LogOut, Menu, X, ShieldCheck, 
  Send, Store, Package, Lock, Globe 
} from 'lucide-react';
import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutEngine({ user, activeTab, setActiveTab, handleLogout, masterCapabilities, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const todayStr = getTodayStr();

  // 1. EXTRAK KAPABILITAS (DNA) CABANG SAAT INI DARI DATABASE
  const nodeCapability = useMemo(() => {
    if (!masterCapabilities || masterCapabilities.length === 0) {
      // Fallback sementara saat data masih loading dari server
      return { branch_type: user?.branch_type || 'UNKNOWN' };
    }
    return masterCapabilities.find(c => c.branch_type === user?.branch_type) || {};
  }, [masterCapabilities, user?.branch_type]);

  // 2. DYNAMIC MENU GENERATOR BERDASARKAN KAPABILITAS
  const menuGroups = useMemo(() => {
    const groups = [];

    // GROUP A: EXECUTIVE & DASHBOARD (Terpusat vs Cabang)
    const dashboardItems = [];
    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        dashboardItems.push({ id: 'dashboard', label: 'Global HQ Radar', icon: Globe });
        dashboardItems.push({ id: 'business_radar', label: 'Business Radar', icon: Activity });
    } else {
        dashboardItems.push({ id: 'dashboard_branch', label: 'Dashboard Node', icon: LayoutDashboard });
    }
    if (dashboardItems.length > 0) groups.push({ groupName: "Command Center", items: dashboardItems });

    // GROUP B: OPERASIONAL INTI & PRODUKSI
    const coreItems = [];
    if (nodeCapability.can_marketplace === true || nodeCapability.can_marketplace === 'true') {
        coreItems.push({ id: 'orders', label: 'POS & Penjualan', icon: ShoppingCart });
    }
    if (nodeCapability.can_production === true || nodeCapability.can_production === 'true') {
        coreItems.push({ id: 'stok', label: 'Produksi & Yield', icon: Factory });
    }
    if (nodeCapability.can_purchase === true || nodeCapability.can_purchase === 'true') {
        coreItems.push({ id: 'purchases', label: 'Belanja Logistik', icon: Truck });
    }
    if (nodeCapability.can_distribution === true || nodeCapability.can_distribution === 'true') {
        coreItems.push({ id: 'distribusi', label: 'Distribusi Global', icon: Send });
    }
    if (nodeCapability.can_receive_frozen === true || nodeCapability.can_receive_frozen === 'true') {
        coreItems.push({ id: 'stok_outlet', label: 'Logistik Freezer', icon: Package });
    }
    if (coreItems.length > 0) groups.push({ groupName: "Core Operations", items: coreItems });

    // GROUP C: TREASURY, FINANCE & HR
    const financeItems = [];
    if (nodeCapability.can_treasury === true || nodeCapability.can_treasury === 'true') {
        financeItems.push({ id: 'cash_war_room', label: 'Treasury Consolidation', icon: Wallet });
    }
    if (nodeCapability.can_accounting === true || nodeCapability.can_accounting === 'true') {
        financeItems.push({ id: 'accounting', label: 'General Ledger', icon: Database });
    }
    if (nodeCapability.can_payroll === true || nodeCapability.can_payroll === 'true') {
        financeItems.push({ id: 'karyawan', label: 'Smart Payroll', icon: Users });
    }
    // Semua Node wajib bisa closing (Setoran)
    financeItems.push({ id: 'pemalang', label: 'Closing & Settlement', icon: Lock });
    
    if (financeItems.length > 0) groups.push({ groupName: "Finance & Settlement", items: financeItems });

    // GROUP D: MASTER DATA & SYSTEM
    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        groups.push({ 
            groupName: "System Configuration", 
            items: [{ id: 'master_data', label: 'Master Data & Rules', icon: Database }] 
        });
    }

    return groups;
  }, [nodeCapability]);

  // 3. DYNAMIC THEME COLOR GENERATOR
  const themeConfig = useMemo(() => {
      const type = user?.branch_type;
      if (type === 'HQ_FACTORY') return { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-500', icon: ShieldCheck, title: 'HQ FACTORY' };
      if (type === 'PRODUCTION_BRANCH') return { bg: 'bg-indigo-600', text: 'text-indigo-600', ring: 'ring-indigo-500', icon: Factory, title: 'PRODUCTION NODE' };
      if (type === 'OUTLET_RESTO') return { bg: 'bg-orange-600', text: 'text-orange-600', ring: 'ring-orange-500', icon: Store, title: 'OUTLET RESTO' };
      if (type === 'FRANCHISE') return { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-500', icon: Package, title: 'FRANCHISE NODE' };
      return { bg: 'bg-slate-600', text: 'text-slate-600', ring: 'ring-slate-500', icon: LayoutDashboard, title: 'SYSTEM NODE' };
  }, [user?.branch_type]);

  const ThemeIcon = themeConfig.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-2xl`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${themeConfig.bg} rounded-xl flex items-center justify-center shadow-lg`}>
              <ThemeIcon size={22} className="text-white"/>
            </div>
            <div>
              <h1 className="font-black text-white text-lg tracking-wider uppercase leading-none">{themeConfig.title}</h1>
              <span className={`text-[9px] font-bold ${themeConfig.text} brightness-150 uppercase tracking-widest block mt-1`}>Dimsum Aditya ERP</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6 mt-2 custom-scrollbar">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{group.groupName}</h2>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? `${themeConfig.bg} text-white shadow-md` : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                      <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className={`w-8 h-8 rounded-full ${themeConfig.bg} flex items-center justify-center font-black text-white text-xs uppercase border border-slate-600`}>
              {(user?.name || user?.username || 'U').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-white truncate uppercase">{user?.name || user?.username || 'USER'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{user?.branch_id || 'NODE'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-500/10 transition-colors uppercase tracking-wide">
            <LogOut size={16} /> Logout Sistem
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <div>
              <div className="font-black text-slate-800 text-lg uppercase tracking-wide">
                Terminal Operasional <span className={themeConfig.text}>/ {user?.branch_id || 'NODE'}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{formatDate(todayStr)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full">
              <div className={`w-2 h-2 rounded-full ${themeConfig.bg} animate-pulse`}></div>
              <span className={`text-[10px] font-black ${themeConfig.text} uppercase tracking-widest`}>Online & Tersinkronisasi</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50/50 relative">
           <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
