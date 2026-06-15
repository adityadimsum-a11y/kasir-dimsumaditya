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
  UserCheck,
  Coins,
  Contact2 // Icon tambahan untuk Master Customer
} from 'lucide-react';

export default function LayoutEngine({ children, activeTab, setActiveTab, user, handleLogout }) {
  const userName = user?.name || 'ADMIN PUSAT';
  const userRole = user?.role || 'super_admin';
  const branchType = user?.branch_type || 'HQ_FACTORY';
  const branchName = user?.branch_id === 'PUSAT' ? 'TANGERANG PUSAT' : user?.branch_id || 'PUSAT';

  const isHQUser = branchType === 'HQ_FACTORY' || userRole === 'super_admin';

  const handleTabChange = (tabId) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-800">
      
{/* AREA LOGO BRANDING */}
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
          
          {/* KELOMPOK 1 */}
          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Pusat Kendali Utama
              </span>
              
              <button type="button" onClick={() => handleTabChange('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'dashboard' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Globe size={16} /> Radar Pusat (Global)
              </button>

              <button type="button" onClick={() => handleTabChange('business_radar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'business_radar' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <TrendingUp size={16} /> Performa Bisnis
              </button>

              <button type="button" onClick={() => handleTabChange('monitoring_cabang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'monitoring_cabang' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Building2 size={16} /> Pantau Cabang
              </button>

              <button type="button" onClick={() => handleTabChange('cash_war_room')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'cash_war_room' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <ShieldAlert size={16} /> Brankas &amp; Aliran Kas
              </button>

              <button type="button" onClick={() => handleTabChange('scm_war_room')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'scm_war_room' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <BarChart3 size={16} /> Kendali Logistik
              </button>

              <button type="button" onClick={() => handleTabChange('analytics')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'analytics' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Layers size={16} /> Analisa Mendalam
              </button>
            </div>
          )}

          {/* KELOMPOK 2 */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Operasional Inti
            </span>

            <button type="button" onClick={() => handleTabChange('orders')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'orders' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <ShoppingCart size={16} /> Kasir (POS) &amp; Penjualan
            </button>

            {/* 🔥 MENU BARU BERDIRI SENDIRI: MASTER CUSTOMER INTELLIGENCE */}
            <button type="button" onClick={() => handleTabChange('master_customer')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'master_customer' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Contact2 size={16} className={activeTab === 'master_customer' ? 'text-white' : 'text-orange-500'} /> Data Pelanggan (CRM)
            </button>

            <button type="button" onClick={() => handleTabChange('pemalang')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'pemalang' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Layers size={16} /> Laporan Produksi
            </button>

            <button type="button" onClick={() => handleTabChange('purchases')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'purchases' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Receipt size={16} /> Belanja &amp; Kas Keluar
            </button>

            <button type="button" onClick={() => handleTabChange('supplier_ayam')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'supplier_ayam' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <BookOpen size={16} /> Buku Nana Ayam
            </button>

            <button type="button" onClick={() => handleTabChange('stok')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'stok' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Package size={16} /> Kartu Stok &amp; Gudang
            </button>

            <button type="button" onClick={() => handleTabChange('stok_outlet')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'stok_outlet' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Building2 size={16} /> Stok Freezer Outlet
            </button>

            <button type="button" onClick={() => handleTabChange('distribusi')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'distribusi' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <Truck size={16} /> Distribusi Antar Cabang
            </button>

            <button type="button" onClick={() => handleTabChange('discrepancy')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'discrepancy' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <ClipboardCheck size={16} /> Opname &amp; Stok Basi
            </button>
          </div>

          {/* KELOMPOK 3 */}
          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Pembukuan &amp; Keuangan
              </span>

              <button type="button" onClick={() => handleTabChange('accounting')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'accounting' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Scale size={16} /> Jurnal &amp; Neraca
              </button>

              <button type="button" onClick={() => handleTabChange('accounting_audit')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'accounting_audit' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <History size={16} /> Riwayat Aktivitas (Audit)
              </button>

              <button type="button" onClick={() => handleTabChange('piutang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'piutang' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <DollarSign size={16} /> Piutang Dagang Agen
              </button>

              <button type="button" onClick={() => handleTabChange('setoran_cabang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'setoran_cabang' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Coins size={16} /> Validasi Setoran Kasir
              </button>
            </div>
          )}

          {/* KELOMPOK 4 */}
          {isHQUser && (
            <div className="space-y-1">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Manajemen Data &amp; Tim
              </span>

              <button type="button" onClick={() => handleTabChange('karyawan')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'karyawan' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Users size={16} /> Manajemen Karyawan
              </button>

              <button type="button" onClick={() => handleTabChange('master_data')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'master_data' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}>
                <Database size={16} /> Pengaturan Sistem Dasar
              </button>
            </div>
          )}

        </div>

        {/* PROFILE CRADLE FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
          <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-xs shadow-inner">
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer normal-case"
          >
            <LogOut size={14} />
            Keluar Aplikasi
          </button>
        </div>

      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-50 relative custom-scrollbar">
        {children}
      </main>

    </div>
  );
}
