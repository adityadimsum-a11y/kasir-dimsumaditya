import React from 'react';

// Ini adalah kerangka wadah Layout. 
// Nantinya UI Sidebar dan Navbar Anda dipindah/disesuaikan di sini.
export default function LayoutHQFactory({ user, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER / NAVBAR SEMENTARA */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-black text-lg tracking-wider">ERP SYSTEM</h1>
          <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold uppercase">{user.branch_type}: {user.branch_id}</span>
        </div>
        <div className="font-medium text-sm">Hi, {user.name}</div>
      </header>

      {/* RENDER KONTEN TAB UTAMA DI SINI */}
      <main className="p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
