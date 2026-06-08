import React, { useMemo } from 'react';
import { BookOpen, PieChart, TrendingUp, Briefcase } from 'lucide-react';
import { formatRp } from '../../utils/helpers';

export default function TabAccounting({ generalLedger, chartOfAccounts }) {

  const accountingData = useMemo(() => {
    const balances = {};
    
    // Inisialisasi COA
    (chartOfAccounts || []).forEach(acc => {
      if (!acc.isDeleted) {
        balances[acc.code] = { code: acc.code, name: acc.name, type: acc.type, debit: 0, credit: 0, balance: 0 };
      }
    });

    // Proses GL Lines
    (generalLedger || []).forEach(gl => {
      if (gl.isDeleted) return;
      const code = String(gl.account_code);
      if (!balances[code]) return;

      const dr = Number(gl.debit) || 0;
      const cr = Number(gl.credit) || 0;
      
      balances[code].debit += dr;
      balances[code].credit += cr;

      // Normal Balance Rules
      if (['ASSET', 'EXPENSE'].includes(balances[code].type)) {
        balances[code].balance += (dr - cr);
      } else if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(balances[code].type)) {
        balances[code].balance += (cr - dr);
      }
    });

    const accountList = Object.values(balances).sort((a,b) => a.code.localeCompare(b.code));

    // Calculate P&L
    let totalRevenue = 0, totalCOGS = 0, totalOpex = 0, totalWaste = 0;
    accountList.forEach(a => {
      if (a.type === 'REVENUE') totalRevenue += a.balance;
      if (a.code === '5001') totalCOGS += a.balance;
      if (a.code === '6001' || a.code === '6002') totalOpex += a.balance;
      if (a.code === '6003') totalWaste += a.balance;
    });

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalOpex - totalWaste;

    return { accountList, totalRevenue, totalCOGS, totalOpex, totalWaste, grossProfit, netProfit };
  }, [generalLedger, chartOfAccounts]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><BookOpen size={18}/> Consolidated Financial Reports</h3>
          <p className="text-xs text-slate-500 mt-1">Laporan Jurnal Umum & Laba Rugi di-*generate* otomatis oleh ERP.</p>
        </div>
        <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-slate-800 transition">CETAK LAPORAN</button>
      </div>

      {/* PROFIT & LOSS STATEMENT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
        <div className="p-5 border-b bg-emerald-50 flex items-center gap-3">
          <TrendingUp size={24} className="text-emerald-600"/>
          <div>
            <h3 className="font-black text-emerald-900 text-lg uppercase tracking-wide">Profit & Loss Statement</h3>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Laporan Laba Rugi Komprehensif (All Nodes)</p>
          </div>
        </div>
        <div className="p-6">
          {/* Revenue */}
          <div className="flex justify-between items-end border-b-2 border-slate-200 pb-2 mb-2">
            <span className="font-black text-slate-700 uppercase">Total Pendapatan (Revenue)</span>
            <span className="text-lg font-black text-emerald-600">{formatRp(accountingData.totalRevenue)}</span>
          </div>
          {/* COGS */}
          <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-2 mb-2 pl-4">
            <span className="font-bold text-slate-600 text-sm">Dikurangi: Harga Pokok Penjualan (HPP)</span>
            <span className="text-base font-bold text-red-600">({formatRp(accountingData.totalCOGS)})</span>
          </div>
          {/* Gross Profit */}
          <div className="flex justify-between items-end border-b-2 border-slate-200 pb-2 mb-6">
            <span className="font-black text-slate-800 uppercase">Laba Kotor (Gross Profit)</span>
            <span className="text-lg font-black text-blue-600">{formatRp(accountingData.grossProfit)}</span>
          </div>
          
          {/* Expenses */}
          <div className="font-black text-slate-700 uppercase mb-2">Beban Operasional & Kerugian:</div>
          <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-2 mb-2 pl-4">
            <span className="font-bold text-slate-600 text-sm">Beban Opex & Fee Marketplace</span>
            <span className="text-base font-bold text-red-600">({formatRp(accountingData.totalOpex)})</span>
          </div>
          <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-2 mb-6 pl-4">
            <span className="font-bold text-slate-600 text-sm">Kerugian Aset (Waste & Discrepancy)</span>
            <span className="text-base font-bold text-red-600">({formatRp(accountingData.totalWaste)})</span>
          </div>

          {/* NET PROFIT */}
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl text-white">
            <span className="font-black uppercase tracking-widest">Laba Bersih (Net Profit)</span>
            <span className={`text-2xl font-black ${accountingData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatRp(accountingData.netProfit)}</span>
          </div>
        </div>
      </div>

      {/* TRIAL BALANCE (NERACA SALDO) */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
          <Briefcase size={20} className="text-slate-600"/>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Trial Balance (Neraca Saldo)</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left table-compact">
            <thead className="bg-white border-b text-[10px] text-slate-500 uppercase table-sticky-header">
              <tr><th className="px-4 py-3">Kode Akun</th><th className="px-4 py-3">Nama Akun</th><th className="px-4 py-3 text-center">Tipe (Normal)</th><th className="px-4 py-3 text-right">Mutasi Debit</th><th className="px-4 py-3 text-right">Mutasi Kredit</th><th className="px-4 py-3 text-right bg-slate-50">Saldo Akhir</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {accountingData.accountList.map(a => (
                <tr key={a.code} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-500">{a.code}</td>
                  <td className="px-4 py-2 font-bold text-slate-800 uppercase">{a.name}</td>
                  <td className="px-4 py-2 text-center text-[9px] text-slate-400">{a.type}</td>
                  <td className="px-4 py-2 text-right">{formatRp(a.debit)}</td>
                  <td className="px-4 py-2 text-right">{formatRp(a.credit)}</td>
                  <td className="px-4 py-2 text-right font-black bg-slate-50">{formatRp(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
