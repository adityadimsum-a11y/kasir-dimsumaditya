import React from 'react';

export default function LayoutProductionBranch({ user, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-black text-lg tracking-wider">ERP PABRIK CABANG</h1>
          <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded font-bold uppercase">{user.branch_type}: {user.branch_id}</span>
        </div>
        <div className="font-medium text-sm">Cabang: {user.branch_id}</div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
