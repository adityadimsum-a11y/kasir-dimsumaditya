import React from 'react';
import { PackageCheck } from 'lucide-react';

export default function TabAntrianPO({ orders, inventoryCostLayers, user, showToast }) {
  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      <div className="card-holo p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-orange-500">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-2 normal-case">
          <PackageCheck className="text-orange-500" size={24} /> 
          Pusat Komando Antrian PO & Karantina Stok
        </h2>
        <p className="text-xs font-bold text-slate-500 normal-case">
          Ruang kontrol untuk mengalokasikan hasil adukan dapur ke pesanan PO, serta mencatat peminjaman stok karantina secara detail dan anti-fitnah.
        </p>
      </div>

      <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center flex flex-col items-center justify-center text-slate-400">
        <PackageCheck size={48} className="mb-4 opacity-20" />
        <h3 className="text-sm font-black uppercase tracking-widest mb-1">Infrastruktur Terhubung</h3>
        <p className="text-xs font-bold normal-case">Kabel database telah sukses dikoneksikan. Siap diisi algoritma Karantina pada tahap selanjutnya!</p>
      </div>
    </div>
  );
}
