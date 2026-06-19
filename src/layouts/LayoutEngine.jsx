import React from 'react';
import { 
  Globe, 
  TrendingUp, 
  Building2, 
  ShoppingCart, 
  Layers, 
  Receipt, 
  BookOpen, 
  Package, 
  Truck, 
  ClipboardCheck, 
  LogOut, 
  ShieldAlert, 
  Users, 
  DollarSign, 
  BarChart3, 
  Database, 
  Scale, 
  History, 
  Coins,
  Contact2,
  PackageCheck,
  Crown,  
  Target, 
  Calculator // 🧮 ICON BARU UNTUK SSOT
} from 'lucide-react';

export default function LayoutEngine({ children, activeTab, setActiveTab, user, handleLogout }) {
  const userName = user?.name || 'ADMIN PUSAT';
  const userRole = user?.role || 'super_admin';
  const branchType = user?.branch_type || 'HQ_FACTORY';
  const branchName = user?.branch_id === 'PUSAT' ? 'TANGERANG PUSAT' : user?.branch_id || 'PUSAT';

  const isHQUser = branchType === 'HQ_FACTORY' || userRole === 'super_admin';
  const isProductionBranch = branchType === 'PRODUCTION_BRANCH' || branchName.includes('PEMALANG');

  const handleTabChange = (tabId) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-800">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 z-20 shadow-xs">
        
        <div className="p-5 border-b border-slate-200/50 flex flex-col items-center justify-center bg-white shrink-0">
          <img 
            src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" 
            alt="Dimsum Aditya ERP" 
            className="h-12 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
          />
          <div className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
            Enterprise Core System
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
          
          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Pusat Kendali Utama
              </span>
              
              <button type="button" onClick={() => handleTabChange('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'dashboard' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Globe size={16} /> Radar Pusat (Global)
              </button>

              <button type="button" onClick={() => handleTabChange('business_radar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'business_radar' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <TrendingUp size={16} /> Performa Bisnis
              </button>

              <button type="button" onClick={() => handleTabChange('monitoring_cabang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'monitoring_cabang' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Building2 size={16} /> Pantau Cabang
              </button>

              <button type="button" onClick={() => handleTabChange('scm_war_room')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'scm_war_room' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <BarChart3 size={16} /> Kendali Logistik
              </button>

              <button type="button" onClick={() => handleTabChange('analytics')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'analytics' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Layers size={16} /> Analisa Mendalam
              </button>
            </div>
          )}

          <div className="space-y-1">
            <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Operasional Inti
            </span>

            <button type="button" onClick={() => handleTabChange('orders')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                activeTab === 'orders' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
              }`}>
              <ShoppingCart size={16} className={activeTab === 'orders' ? "text-white" : ""} /> Kasir (POS) &amp; Penjualan
            </button>

            <button type="button" onClick={() => handleTabChange('antrian_po')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                activeTab === 'antrian_po' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
              }`}>
              <PackageCheck size={16} className={activeTab === 'antrian_po' ? 'text-white' : 'text-orange-500'} /> Antrian PO &amp; Karantina
            </button>

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('master_customer')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'master_customer' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Contact2 size={16} className={activeTab === 'master_customer' ? 'text-white' : 'text-orange-500'} /> Data Pelanggan (CRM)
              </button>
            )}

            {(isHQUser || isProductionBranch) && (
              <button type="button" onClick={() => handleTabChange('pemalang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'pemalang' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Layers size={16} /> Laporan Produksi
              </button>
            )}

            {(isHQUser || isProductionBranch) && (
              <button type="button" onClick={() => handleTabChange('purchases')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'purchases' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Receipt size={16} /> Belanja &amp; Kas Keluar
              </button>
            )}

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('supplier_ayam')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'supplier_ayam' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <BookOpen size={16} /> Buku Nana Ayam
              </button>
            )}

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('stok')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'stok' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Package size={16} /> Kartu Stok &amp; Gudang
              </button>
            )}

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('stok_outlet')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'stok_outlet' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Building2 size={16} /> Stok Freezer Outlet
              </button>
            )}

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('distribusi')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'distribusi' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Truck size={16} /> Distribusi Antar Cabang
              </button>
            )}

            {isHQUser && (
              <button type="button" onClick={() => handleTabChange('discrepancy')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'discrepancy' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <ClipboardCheck size={16} /> Opname &amp; Stok Basi
              </button>
            )}
          </div>

          {/* 👑 MODUL PRIBADI OWNER */}
          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-2">
                Area Pribadi Owner
              </span>
              <button type="button" onClick={() => handleTabChange('profit_owner')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'profit_owner' ? 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-transparent'
                }`}>
                <Crown size={16} /> Brankas Profit (Prive)
              </button>
            </div>
          )}

          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Pembukuan &amp; Keuangan
              </span>

              <button type="button" onClick={() => handleTabChange('kewajiban')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'kewajiban' ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent'
                }`}>
                <Target size={16} /> Pusat Kewajiban
              </button>

              <button type="button" onClick={() => handleTabChange('accounting')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'accounting' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Scale size={16} /> Jurnal &amp; Neraca
              </button>

              <button type="button" onClick={() => handleTabChange('accounting_audit')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'accounting_audit' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <History size={16} /> Riwayat Aktivitas (Audit)
              </button>

              <button type="button" onClick={() => handleTabChange('piutang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'piutang' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <DollarSign size={16} /> Piutang Dagang Agen
              </button>

              <button type="button" onClick={() => handleTabChange('setoran_cabang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'setoran_cabang' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Coins size={16} /> Validasi Setoran Kasir
              </button>
            </div>
          )}

          {(isHQUser || isProductionBranch) && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Manajemen Data &amp; Tim
              </span>

              {isHQUser && (
                <button type="button" onClick={() => handleTabChange('karyawan')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                    activeTab === 'karyawan' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                  }`}>
                  <Users size={16} /> Manajemen Karyawan
                </button>
              )}

              {/* 🧮 ROUTE MENU BARU: MASTER KONVERSI SSOT */}
              <button type="button" onClick={() => handleTabChange('master_konversi')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'master_konversi' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Calculator size={16} className={activeTab === 'master_konversi' ? "text-[#CE1722]" : "text-slate-500"} /> Master Konversi (SSOT)
              </button>

              <button type="button" onClick={() => handleTabChange('master_data')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all normal-case cursor-pointer ${
                  activeTab === 'master_data' ? 'bg-red-50 text-red-600 border border-red-100/50 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}>
                <Database size={16} /> Pengaturan Sistem Dasar
              </button>
            </div>
          )}
        </div>

        {/* PROFILE CRADLE FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
          <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200/60 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-sm shadow-inner shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-800 tracking-tight uppercase truncate">{userName}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">{userRole.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer normal-case shadow-3xs"
          >
            <LogOut size={14} />
            Keluar Aplikasi
          </button>
        </div>

      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-50 relative custom-scrollbar p-4 md:p-6 lg:p-8">
        {children}
      </main>

    </div>
  );
}
