import React, { useMemo } from 'react';
import { Store, Receipt, Activity, Package, AlertCircle, FileText, TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { formatRp, formatDate, getTodayStr } from '../../utils/helpers';

export default function TabDashboardBranch({ orders, expenses, karyawan, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'UNKNOWN_BRANCH';
  const branchName = user?.branch_name || currentBranch;
  const curMonth = todayStr.substring(0, 7);

  const data = useMemo(() => {
    // 1. Filter Order Cabang
    const myOrders = (orders || []).filter(o => !o.isDeleted && String(o.branch_id).toUpperCase() === currentBranch.toUpperCase());
    const sortedOrders = myOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. Summary Omset Hari Ini
    const todayOrders = myOrders.filter(o => o.date === todayStr);
    const omsetHariIni = todayOrders.reduce((sum, o) => sum + (Number(o.total || 0) - Number(o.fee_amount || 0)), 0);

    // 3. Payroll & Kasbon Summary
    const myExpenses = (expenses || []).filter(e => !e.isDeleted);
    const totalKasbon = myExpenses.filter(e => e.category === 'KASBON_KARYAWAN').reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPotonganKasbon = myExpenses.filter(e => e.category === 'GAJI_KARYAWAN').reduce((sum, e) => sum + Number(e.kasbon_deduction || 0), 0);
    
    return {
        sortedOrders,
        omsetHariIni,
        totalGajiBulanIni: myExpenses.filter(e => e.category === 'GAJI_KARYAWAN' && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.amount), 0),
        totalKasbonBulanIni: myExpenses.filter(e => e.category === 'KASBON_KARYAWAN' && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.amount), 0),
        sisaPiutang: totalKasbon - totalPotonganKasbon
    };
  }, [orders, expenses, currentBranch, todayStr, curMonth]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER HERO */}
      <div className="bg-slate-900 rounded-3xl p-8 flex items-center justify-between shadow-xl border border-slate-800">
        <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wide">{branchName}</h2>
            <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mt-1">Terminal Operasional - {todayStr}</p>
        </div>
        <div className="bg-blue-600 px-6 py-3 rounded-2xl text-white font-black shadow-lg">
            OMSET HARI INI: {formatRp(data.omsetHariIni)}
        </div>
      </div>

      {/* METRIK SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-blue-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Total Gaji Bulan Ini</div>
            <div className="text-xl font-black text-blue-600">{formatRp(data.totalGajiBulanIni)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-orange-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Total Kasbon Bulan Ini</div>
            <div className="text-xl font-black text-orange-600">{formatRp(data.totalKasbonBulanIni)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-red-500">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Sisa Piutang Karyawan</div>
            <div className="text-xl font-black text-red-600">{formatRp(data.sisaPiutang)}</div>
        </div>
      </div>

      {/* TABEL DETAIL TRANSAKSI */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 uppercase text-sm flex items-center gap-2"><Receipt size={16}/> Detail Transaksi Terlengkap</h4>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                      <tr>
                          <th className="px-6 py-4">Tgl</th>
                          <th className="px-6 py-4">ID Transaksi</th>
                          <th className="px-6 py-4">Pelanggan</th>
                          <th className="px-6 py-4">Deskripsi Barang</th>
                          <th className="px-6 py-4 text-center">Qty</th>
                          <th className="px-6 py-4 text-right">Total Net</th>
                          <th className="px-6 py-4 text-center">Status Tempo</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {data.sortedOrders.length === 0 ? (
                          <tr><td colSpan="7" className="text-center py-10 text-slate-400">Tidak ada transaksi ditemukan.</td></tr>
                      ) : (
                          data.sortedOrders.map(o => (
                              <tr key={o.id} className="hover:bg-slate-50 transition">
                                  <td className="px-6 py-4 font-bold text-slate-700">{formatDate(o.date)}</td>
                                  <td className="px-6 py-4 font-mono font-bold text-slate-400 text-[10px]">{o.id}</td>
                                  <td className="px-6 py-4 uppercase font-black text-slate-800">{o.customer_name}</td>
                                  <td className="px-6 py-4 text-slate-600">{o.itemName}</td>
                                  <td className="px-6 py-4 text-center font-bold text-blue-600">{Number(o.qty).toLocaleString('id-ID')} Pcs</td>
                                  <td className="px-6 py-4 text-right font-black">{formatRp(o.total)}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${o.settlement_status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {o.settlement_status || 'LUNAS'}
                                      </span>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      
    </div>
  );
}
