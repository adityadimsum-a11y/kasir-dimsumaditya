import React from 'react';

export default function LayoutOutletResto({ user, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-orange-600 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-black text-lg tracking-wider">POS KASIR OUTLET</h1>
          <span className="text-[10px] bg-white text-orange-700 px-2 py-0.5 rounded font-bold uppercase">{user.branch_type}: {user.branch_id}</span>
        </div>
        <div className="font-medium text-sm">Kasir: {user.name}</div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
