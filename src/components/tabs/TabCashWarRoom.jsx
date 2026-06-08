import React, { useMemo, useState } from 'react';
import { Wallet, Coins, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, ShieldAlert, AlertTriangle } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD, formatDate } from '../../utils/helpers';

export default function TabCashWarRoom({ orders, purchases, expenses, cashflowTransactions, marketplaceSettlement, supplierLedger, masterBranches, financialClosings }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const stats = useMemo(() => {
    const isPeriod = (d) => getLocalYMD(d) >= dateFrom && getLocalYMD(d) <= dateTo;

    // --- 1. SALDO CENTRAL TREASURY REAL-TIME (ALL TIME) ---
    let cashReadyPusat = 0;
    let totalIn = 0;
    let totalOut = 0;

    (cashflowTransactions || []).forEach(c => {
      const amtIn = Number(c.amount_in) || Number(c.type === 'CASH_IN' ? c.amount : 0);
      const amtOut = Number(c.amount_out) || Number(c.type === 'CASH_OUT' ? c.amount : 0);
      
      cashReadyPusat += (amtIn - amtOut);

      if (isPeriod(c.date)) {
        totalIn += amtIn;
        totalOut += amtOut;
      }
    });

    // --- 2. PENDING MARKETPLACE PAYOUT (UANG MENGAPUNG) ---
    let pendingMarketplace = 0;
    (marketplaceSettlement || []).forEach(m => {
      if (m.status === 'PENDING') {
        pendingMarketplace += (Number(m.net) || 0);
      }
    });

    // --- 3. HUTANG SUPPLIER AYAM AKTIF ---
    let hutangAyamAktif = 0;
    (supplierLedger || []).forEach(l => {
      if (l.transaction_type === 'PURCHASE') hutangAyamAktif += Number(l.amount);
      if (l.transaction_type === 'PAYMENT') hutangAyamAktif -= Number(l.amount);
    });

    // --- 4. ESTIMASI KEBUTUHAN PUTARAN AYAM (30 HARI TERAKHIR) ---
    let totalAyamKg30d = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimitStr = thirtyDaysAgo.toISOString().split('T')[0];

    (purchases || []).forEach(p => {
      if (getLocalYMD(p.date) >= dateLimitStr && String(p.itemName).toUpperCase().includes('AYAM')) {
        totalAyamKg30d += Number(p.qty);
      }
    });
    const avgAyamKgPerDay = totalAyamKg30d / 30;
    const estimasiKebutuhanKasAyam = Math.ceil(avgAyamKgPerDay * 7) * 38000; // Proyeksi kas beli ayam untuk 7 hari ke depan

    // --- 5. DETEKSI CABANG BELUM SETOR CLOSING (HARI INI) ---
    const activeNodes = (masterBranches || []).filter(b => b.branch_id !== 'TANGERANG');
    const nodesBelumSetor = activeNodes.filter(node => {
      const sdhClose = (financialClosings || []).some(c => c.date === todayStr && c.branch_id === node.branch_id);
      return !sdhClose;
    });

    // --- 6. ARUS KAS KONSOLIDASI PER BUSINESS NODE ---
    const nodeCashflowMap = {};
    (masterBranches || []).forEach(b => {
      nodeCashflowMap[b.branch_id] = { name: b.branch_name, type: b.branch_type, in: 0, out: 0 };
    });

    // Isikan data ke map konsolidasi
    (cashflowTransactions || []).filter(c => isPeriod(c.date)).forEach(c => {
      const src = c.branch_id || c.source_branch || 'TANGERANG';
      const amtIn = Number(c.amount_in) || Number(c.type === 'CASH_IN' ? c.amount : 0);
      const amtOut = Number(c.amount_out) || Number(c.type === 'CASH_OUT' ? c.amount : 0);
      
      if (nodeCashflowMap[src]) {
        nodeCashflowMap[src].in += amtIn;
        nodeCashflowMap[src].out += amtOut;
      }
    });

    return {
      cashReadyPusat,
      pendingMarketplace,
      hutangAyamAktif,
      estimasiKebutuhanKasAyam,
      nodesBelumSetor,
      totalIn,
      totalOut,
      consolidatedList: Object.values(nodeCashflowMap)
    };
  }, [cashflowTransactions, marketplaceSettlement, supplierLedger, purchases, masterBranches, financialClosings, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER PERIODE WAR ROOM */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">⏱️ Filter Analisis Arus Kas Terpusat</h3>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50" />
            <span className="text-slate-400 self-center">s/d</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50" />
          </div>
        </div>
        <div className="text-xs bg-slate-900 text-white font-black px-4 py-2.5 rounded-lg flex items-center gap-2 tracking-wide">
          <Layers size={14} className="text-cyan-400"/> MODE KENDALI TREASURY AKTIF
        </div>
      </div>

      {/* RENDER UTAMA SALDO TREASURY HOLDING */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-white relative overflow-hidden shadow-xl lg:col-span-2">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Wallet size={120}/></div>
          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">TOTAL SALDO CENTRAL TREASURY</div>
          <div className="text-4xl font-black tracking-tight">{formatRp(stats.cashReadyPusat)}</div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">*Gabungan Kas Laci Utama & Rekening Holding Pusat Tangerang.</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-amber-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dana Tertahan Marketplace</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{formatRp(stats.pendingMarketplace)}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Menunggu Payout Aplikasi Online</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hutang Bahan Baku (AP)</div>
          <div className="text-2xl font-black text-red-600 mt-1">{formatRp(stats.hutangAktif)}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Kewajiban Supplier Ayam Berjalan</div>
        </div>
      </div>

      {/* SCREEN PANTAUAN DIAGNOSTIK KAS AYAM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl md:col-span-2">
          <h3 className="font-bold text-blue-900 text-sm tracking-wide uppercase flex items-center gap-2 mb-2"><ShieldAlert size={18}/> Analisis Kecukupan Putaran Bahan Baku</h3>
          <p className="text-xs text-blue-800 font-medium">
            Proyeksi kebutuhan dana tunai untuk restock ayam 7 hari ke depan adalah sebesar <b className="text-blue-900 text-sm">{formatRp(stats.estimasiKebutuhanKasAyam)}</b>.
          </p>
          {stats.cashReadyPusat >= stats.estimasiKebutuhanKasAyam ? (
            <div className="mt-3 text-xs font-bold text-emerald-700 bg-emerald-100/60 p-3 rounded-xl border border-emerald-300">
              🟢 Saldo Treasury Aman! Kas likuid pusat mampu membiayai perputaran rantai pasok ayam seminggu kedepan.
            </div>
          ) : (
            <div className="mt-3 text-xs font-bold text-red-700 bg-red-100/60 p-3 rounded-xl border border-red-300 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0"/> 🚨 DEFISIT TUNAI: Central treasury membutuhkan suntikan dana cair segera. Tagih setoran cabang atau lakukan penarikan saldo marketplace.
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Status Closing EOD Cabang</h3>
          {stats.nodesBelumSetor.length === 0 ? (
            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border p-3 rounded-xl text-center"> seluruh Node Cabang telah menyetorkan Kas Hari Ini! </div>
          ) : (
            <div className="space-y-2">
              {stats.nodesBelumSetor.map(node => (
                <div key={node.branch_id} className="flex justify-between items-center bg-slate-50 border p-2 rounded-xl text-xs font-bold">
                  <span className="text-slate-700 uppercase">{node.branch_id}</span>
                  <span className="text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">BELUM SETOR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABEL ARUS KAS KONSOLIDASI GROUP HOLDING */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-4">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Group Consolidated Cashflow Statement</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nama Business Node</th>
                <th className="px-4 py-3">Tipe Node</th>
                <th className="px-4 py-3 text-right text-emerald-600">Total Uang Masuk (+)</th>
                <th className="px-4 py-3 text-right text-red-600">Total Uang Keluar (-)</th>
                <th className="px-4 py-3 text-right font-black">Net Cashflow Periode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs">
              {stats.consolidatedList.map(node => {
                const netNode = node.in - node.out;
                return (
                  <tr key={node.name} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-800 uppercase">{node.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-[10px] uppercase">{node.type}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">+{formatRp(node.in)}</td>
                    <td className="px-4 py-3 text-right text-red-600">-{formatRp(node.out)}</td>
                    <td className={`px-4 py-3 text-right text-sm font-black ${netNode >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatRp(netNode)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
