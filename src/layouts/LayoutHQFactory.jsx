import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Activity, Factory, Truck, 
  Wallet, Users, Database, LogOut, Menu, X, ShieldCheck, Send
} from 'lucide-react';
import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutHQFactory({ user, activeTab, setActiveTab, handleLogout, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const todayStr = getTodayStr();

  const menuGroups = [
    {
      groupName: "Executive Menu",
      items: [
        { id: 'dashboard', label: 'HQ Dashboard', icon: LayoutDashboard },
        { id: 'cash_war_room', label: 'Cash War Room', icon: Activity },
        { id: 'orders', label: 'POS & Penjualan', icon: ShoppingCart },
      ]
    },
    {
      groupName: "Core Operations",
      items: [
        { id: 'stok', label: 'Produksi & Yield', icon: Factory },
        { id: 'purchases', label: 'Belanja & HPP', icon: Truck },
        { id: 'distribusi', label: 'Distribusi Node', icon: Send },
      ]
    },
    {
      groupName: "Finance & HR",
      items: [
        { id: 'accounting', label: 'Accounting GL', icon: Wallet },
        { id: 'karyawan', label: 'Smart Payroll', icon: Users },
      ]
    },
    {
      groupName: "System",
      items: [
        { id: 'master_data', label: 'Master Data & Rules', icon: Database },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-2xl`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <ShieldCheck size={24} className="text-white"/>
            </div>
            <div>
              <h1 className="font-black text-white text-lg tracking-wider uppercase leading-none">DIMSUM ADITYA</h1>
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mt-1">Phase 13 Engine</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{group.groupName}</h2>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
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
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-black text-white text-xs uppercase border border-slate-600">
              {(user?.name || user?.username || 'A').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-white truncate uppercase">{user?.name || user?.username || 'Admin'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{user?.branch_type || 'HQ_FACTORY'}</div>
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
                Pusat Kendali <span className="text-blue-600">/ {user?.branch_id || 'PUSAT'}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{formatDate(todayStr)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Node Online</span>
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
