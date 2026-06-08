import React, { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Factory, Send, LogOut, Menu, X, ShieldCheck, Clock } from 'lucide-react';
import { getTodayStr, formatDate } from '../utils/helpers';

export default function LayoutProductionBranch({ user, activeTab, setActiveTab, handleLogout, children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const todayStr = getTodayStr();

  const menuGroups = [
    {
      groupName: "Operasional Cabang",
      items: [
        { id: 'dashboard_branch', label: 'Dashboard Cabang', icon: LayoutDashboard },
        { id: 'orders', label: 'POS & Kasir', icon: ShoppingCart },
      ]
    },
    {
      groupName: "Dapur & Logistik",
      items: [
        { id: 'stok', label: 'Produksi & Yield', icon: Factory },
        { id: 'distribusi', label: 'Pengiriman (DO)', icon: Send },
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
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Factory size={24} className="text-white"/>
            </div>
            <div>
              <h1 className="font-black text-white text-lg tracking-wider leading-none uppercase">NODE PRODUKSI</h1>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mt-1">Phase 13 Connected</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6 mt-4">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{group.groupName}</h2>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
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
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center font-black text-white text-xs uppercase border border-slate-600">
              {(user?.name || user?.username || 'C').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-white truncate uppercase">{user?.name || user?.username || 'Cabang'}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase truncate">ID: {user?.branch_id || 'NODE'}</div>
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
                Sistem Cabang <span className="text-indigo-600">/ {user?.branch_id || 'BRANCH'}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1"><Clock size={10}/> {formatDate(todayStr)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
              <ShieldCheck size={14} className="text-blue-600" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Tersinkronisasi</span>
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
