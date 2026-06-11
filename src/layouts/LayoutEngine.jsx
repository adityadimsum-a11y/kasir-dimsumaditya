import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Activity, Factory, Truck, 
  Wallet, Users, Database, LogOut, Menu, X, ShieldCheck, 
  Send, Store, Package, Lock, Globe, Landmark, AlertTriangle
} from 'lucide-react';
import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutEngine({ user, activeTab, setActiveTab, handleLogout, masterCapabilities, children }) {
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

    const dashboardItems = [];
    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        dashboardItems.push({ id: 'dashboard', label: 'Global HQ Radar', icon: Globe });
        dashboardItems.push({ id: 'business_radar', label: 'Business Radar', icon: Activity });
    } else {
        dashboardItems.push({ id: 'dashboard_branch', label: 'Dashboard Node', icon: LayoutDashboard });
    }
    if (dashboardItems.length > 0) groups.push({ groupName: "Command Center", items: dashboardItems });

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
    coreItems.push({ id: 'discrepancy', label: 'Stok Opname & Basi', icon: AlertTriangle });
    if (coreItems.length > 0) groups.push({ groupName: "Core Operations", items: coreItems });

    const financeItems = [];
    if (nodeCapability.can_treasury === true || nodeCapability.can_treasury === 'true') {
        financeItems.push({ id: 'cash_war_room', label: 'Dompet Perusahaan', icon: Wallet });
        financeItems.push({ id: 'setoran_cabang', label: 'Setoran Cabang', icon: Landmark }); // 🔥 MENU BARUNYA MUNCUL DI SINI!
    }
    if (nodeCapability.can_accounting === true || nodeCapability.can_accounting === 'true') {
        financeItems.push({ id: 'accounting', label: 'Laba Rugi & Aset', icon: Database });
    }
    if (nodeCapability.can_payroll === true || nodeCapability.can_payroll === 'true') {
        financeItems.push({ id: 'karyawan', label: 'Smart Payroll', icon: Users });
    }
    financeItems.push({ id: 'pemalang', label: 'Closing & Settlement', icon: Lock });
    
    if (financeItems.length > 0) groups.push({ groupName: "Finance & Settlement", items: financeItems });

    if (nodeCapability.can_global_dashboard === true || nodeCapability.can_global_dashboard === 'true') {
        groups.push({ 
            groupName: "System Configuration", 
            items: [{ id: 'master_data', label: 'Master Data & Rules', icon: Database }] 
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
    <div className="h-full w-full bg-transparent flex overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR MIDNIGHT SOLID */}
      <aside 
        className="fixed inset-y-0 left-0 z-50 w-72 text-slate-300 transition-transform duration-300 ease-in-out flex flex-col lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-2xl"
        style={{ backgroundColor: '#090d16', borderRight: '1px solid #1e293b' }}
      >
        <div className="h-20 flex items-center px-6 justify-between" style={{ backgroundColor: '#05070a', borderBottom: '1px solid #1e293b' }}>
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl shadow-[0_0_10px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0">
              <img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo Dimsum Aditya" className="h-10 w-10 object-contain hover:scale-105 transition-transform cursor-pointer" />
            </div>
            <div>
              <h1 className="font-black text-white text-base tracking-wider uppercase leading-none">{themeConfig.title}</h1>
              <span className={`text-[9px] font-bold ${themeConfig.text} brightness-150 uppercase tracking-widest block mt-1 transition-colors`}>Dimsum Aditya ERP</span>
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
                    <button 
                      key={item.id} 
                      onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? `${themeConfig.bg} text-white shadow-md` : 'text-slate-400 hover:text-white'}`}
                      style={!isActive ? { backgroundColor: 'transparent' } : {}}
                    >
                      <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 bg-slate-950" style={{ backgroundColor: '#05070a', borderTop: '1px solid #1e293b' }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl border border-slate-800" style={{ backgroundColor: '#090d16' }}>
            <div className={`w-8 h-8 rounded-full ${themeConfig.bg} flex items-center justify-center font-black text-white text-xs uppercase border border-slate-700 transition-colors`}>
              {(user?.name || user?.username || 'U').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-white truncate uppercase">{user?.name || user?.username || 'USER'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{user?.branch_id || 'NODE'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-slate-400 hover:text-white hover:bg-red-600 transition-colors uppercase tracking-wide">
            <LogOut size={16} /> Logout Sistem
          </button>
        </div>
      </aside>

      {/* RIGHT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-white/50 backdrop-blur-xl z-0 pointer-events-none"></div>

        <header className="h-20 border-b border-slate-200/50 flex items-center justify-between px-6 shrink-0 relative z-20 shadow-sm bg-white/70 backdrop-blur-md">
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className={`w-2 h-2 rounded-full ${themeConfig.bg} animate-pulse`}></div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Online &amp; Tersinkronisasi</span>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 custom-scrollbar">
           <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
