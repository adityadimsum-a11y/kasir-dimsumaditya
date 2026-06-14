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
  LogOut 
} from 'lucide-react';

export default function LayoutEngine({ children, activeTab, setActiveTab, user, onLogout }) {
  // Ambil data profil user secara aman
  const userName = user?.name || 'ADMIN PUSAT';
  const userRole = user?.role || 'super_admin';
  const branchType = user?.branch_type || 'HQ_FACTORY';
  const branchName = user?.branch_id === 'PUSAT' ? 'TANGERANG PUSAT' : user?.branch_id || 'PUSAT';

  // Periksa apakah user memiliki hak akses melihat menu Command Center Utama
  const isHQUser = branchType === 'HQ_FACTORY' || userRole === 'super_admin';

  // Handler klik menu dengan validasi preventif agar state navigasi tidak error
  const handleTabChange = (tabId) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-800">
      
      {/* ================= SIDEBAR KIRI ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-full select-none">
        
        {/* BAGIAN ATAS: LOGO PERUSAHAAN & BRANDING */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-sm shadow-red-200 shrink-0">
            DIMSUM
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black text-slate-800 tracking-wide uppercase truncate">{branchName}</h1>
            <p className="text-[9px] font-bold text-red-600 uppercase tracking-wider mt-0.5">Dimsum Aditya ERP</p>
          </div>
        </div>

        {/* BAGIAN TENGAH: MENU NAVIGASI KELOMPOK DINAMIS */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7 custom-scrollbar">
          
          {/* KELOMPOK 1: COMMAND CENTER (Hanya untuk Admin Pusat/HQ) */}
          {isHQUser && (
            <div className="space-y-1.5">
              <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Command Center
              </span>
              
              <button
                type="button"
                onClick={() => handleTabChange('global_hq')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'global_hq'
                    ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Globe size={16} className={activeTab === 'global_hq' ? 'text-red-600' : 'text-slate-400'} />
                Global HQ Radar
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('business_radar')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'business_radar'
                    ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <TrendingUp size={16} className={activeTab === 'business_radar' ? 'text-red-600' : 'text-slate-400'} />
                Business Radar
              </button>

              {/* 🔥 REKAYASA FITUR MONITOR: MENGGANTI 'MONITOR PEMALANG' MENJADI 'MONITOR CABANG' SECARA UNIVERSAL */}
              <button
                type="button"
                onClick={() => handleTabChange('monitoring_cabang')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                  activeTab === 'monitoring_cabang'
                    ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Building2 size={16} className={activeTab === 'monitoring_cabang' ? 'text-red-600' : 'text-slate-400'} />
                Monitor Cabang
              </button>
            </div>
          )}

          {/* KELOMPOK 2: CORE OPERATIONS (Akses Operasional Lapangan) */}
          <div className="space-y-1.5">
            <span className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Core Operations
            </span>

            <button
              type="button"
              onClick={() => handleTabChange('pos')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'pos'
                  ? 'bg-red-600 text-white shadow-md shadow-red-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <ShoppingCart size={16} className={activeTab === 'pos' ? 'text-white' : 'text-slate-400'} />
              POS &amp; Penjualan
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('produksi')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'produksi'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Layers size={16} className={activeTab === 'produksi' ? 'text-red-600' : 'text-slate-400'} />
              Laporan Produksi
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('belanja')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'belanja'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Receipt size={16} className={activeTab === 'belanja' ? 'text-red-600' : 'text-slate-400'} />
              Belanja &amp; Kas Keluar
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('buku_ayam')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'buku_ayam'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={16} className={activeTab === 'buku_ayam' ? 'text-red-600' : 'text-slate-400'} />
              Buku Nana Ayam
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('kartu_stok')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'kartu_stok'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Package size={16} className={activeTab === 'kartu_stok' ? 'text-red-600' : 'text-slate-400'} />
              Kartu Stok &amp; Gudang
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('distribusi')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'distribusi'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Truck size={16} className={activeTab === 'distribusi' ? 'text-red-600' : 'text-slate-400'} />
              Distribusi Global
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('opname')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all normal-case ${
                activeTab === 'opname'
                  ? 'bg-red-50 text-red-600 shadow-xs border border-red-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <ClipboardCheck size={16} className={activeTab === 'opname' ? 'text-red-600' : 'text-slate-400'} />
              Stok Basi / Opname
            </button>
          </div>

        </div>

        {/* BAGIAN BAWAH: DATA USER LOGIN DAN KENDALI KELUAR SISTEM */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
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
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer normal-case"
          >
            <LogOut size={14} />
            Logout Sistem
          </button>
        </div>

      </aside>

      {/* ================= AREA KONTEN UTAMA ================= */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-50 relative custom-scrollbar">
        {children}
      </main>

    </div>
  );
}
