import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Store, LogOut, 
  Menu, X, ShieldCheck, Clock, Lock
} from 'lucide-react';
import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutOutletResto({ user, activeTab, setActiveTab, handleLogout, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const todayStr = getTodayStr();

  // =====================================
  // STRUKTUR MENU OUTLET RESTO (SLIM POS)
  // =====================================
  const menuGroups = [
    {
      groupName: "Pelayanan Resto",
      items: [
        { id: 'dashboard_branch', label: 'Dashboard Toko', icon: LayoutDashboard },
        { id: 'orders', label: 'Kasir (POS Engine)', icon: ShoppingCart },
      ]
    },
    {
      groupName: "Akhir Operasional",
      items: [
        { id: 'pemalang', label: 'Closing & Tutup Buku', icon: Lock },
      ]
    }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      
      {/* ======================================= */}
      {/* 1. SIDEBAR (STOREFRONT ORANGE THEME)    */}
      {/* ======================================= */}
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-2xl`}>
        
        {/* Sidebar Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Store size={22} className="text-white"/>
            </div>
            <div>
              <h1 className="font-black text-white text-lg tracking-wider leading-tight uppercase">OUTLET RESTO</h1>
              <div className="text-[9px] font-bold text-orange-400 uppercase tracking-widest">Garis Depan POS</div>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 mt-4">
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
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        isActive 
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
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

        {/* Sidebar Footer (Kasir Info & Logout) */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-orange-700 flex items-center justify-center font-black text-white text-xs uppercase">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-white truncate uppercase">{user.name}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">KASIR: {user.branch_id}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors uppercase tracking-wide"
          >
            <LogOut size={16} /> Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* ======================================= */}
      {/* 2. MAIN CONTENT AREA                      */}
      {/* ======================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Topbar / Header Utama */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 relative shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <Menu size={24} />
            </button>
            <div>
              <div className="font-black text-slate-800 text-lg uppercase tracking-wide flex items-center gap-2">
                Terminal POS <span className="hidden sm:inline-block text-slate-300">/</span> <span className="text-orange-600 hidden sm:inline-block">{user.branch_id}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <Clock size={10}/> {formatDate(todayStr)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indikator Proteksi Kasir */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
              <ShieldCheck size={14} className="text-orange-600" />
              <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Kas POS Terkunci</span>
            </div>
          </div>
        </header>

        {/* Ruang Konten Tab (Scrollable) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 bg-slate-50/50 relative">
           <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-50/40 to-transparent pointer-events-none"></div>
           
           <div className="relative z-10 max-w-7xl mx-auto">
             {children}
           </div>
        </main>
      </div>

    </div>
  );
}
