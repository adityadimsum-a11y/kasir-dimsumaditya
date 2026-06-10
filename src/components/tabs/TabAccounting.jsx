import React, { useMemo } from 'react';
import { TrendingUp, ArrowDownToLine, ArrowUpRight, Scale, Calculator, DollarSign, Activity } from 'lucide-react';
import { getTodayStr } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabGeneralLedger({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data 
}) {
  
  // SINKRONISASI DATA
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // ENGINE LABA RUGI (PROFIT & LOSS)
  const pnlData = useMemo(() => {
    let pendapatanKotor = 0;
    let hppAyam = 0;
    let biayaOperasional = 0;
    let asetAyamKg = 0;

    // 1. Pendapatan Jualan
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      pendapatanKotor += Number(o.total_amount || 0);
    });

    // 2. Pembelian Ayam & Packaging (HPP/Aset)
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      if (p.category === 'BAHAN_BAKU') {
        hppAyam += Number(p.total_amount || 0);
        asetAyamKg += Number(p.qty_kg || 0);
      } else {
        biayaOperasional += Number(p.total_amount || 0);
      }
    });

    // 3. Biaya Operasional & Kas Keluar Manual
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      biayaOperasional += Number(e.amount || 0);
    });
    realCashflow.filter(c => !c.isDeleted && c.type === 'OUT').forEach(c => {
      biayaOperasional += Number(c.amount || 0);
    });

    const labaBersih = pendapatanKotor - hppAyam - biayaOperasional;
    const persentaseLaba = pendapatanKotor > 0 ? (labaBersih / pendapatanKotor) * 100 : 0;

    return { pendapatanKotor, hppAyam, biayaOperasional, labaBersih, persentaseLaba, asetAyamKg };
  }, [realOrders, realPurchases, realExpenses, realCashflow]);

  return (
    <div className="space-y-6 pb-10">
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Scale className="text-blue-500"/> Laba Rugi & Aset (P&L)</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Laporan kesehatan finansial dan performa cuan pabrik.</p>
        </div>
        <div className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Activity size={14}/> Sistem Akuntansi Sederhana (Cash Basis)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-2"><ArrowDownToLine size={14}/> Pendapatan Kotor</div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight">{formatRupiah(pnlData.pendapatanKotor)}</div>
          <div className="mt-3 text-[10px] font-bold text-slate-500">Total omzet dari penjualan Dimsum.</div>
        </div>

        <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100 shadow-sm">
          <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 mb-2"><ArrowUpRight size={14}/> Total Modal & Beban</div>
          <div className="text-3xl font-black text-rose-700 tracking-tight">{formatRupiah(pnlData.hppAyam + pnlData.biayaOperasional)}</div>
          <div className="mt-3 text-[10px] font-bold text-slate-500">Gabungan Beli Ayam + Operasional Pabrik.</div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-white/5" size={120} />
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2"><TrendingUp size={14}/> Laba Bersih (Net Profit)</div>
          <div className="text-4xl font-black text-white tracking-tight">{formatRupiah(pnlData.labaBersih)}</div>
          <div className="mt-3 flex gap-2">
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${pnlData.labaBersih >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              Margin: {pnlData.persentaseLaba.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <h3 className="font-black text-sm uppercase text-slate-800 tracking-widest flex items-center gap-2 mb-6 pb-4 border-b border-slate-100"><Calculator size={18} className="text-blue-500"/> Rincian Kalkulasi Laba Rugi</h3>
        
        <div className="space-y-4 max-w-3xl">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="font-bold text-sm text-slate-700 uppercase">A. Pendapatan Penjualan (Omzet)</div>
            <div className="font-black text-emerald-600 text-lg">{formatRupiah(pnlData.pendapatanKotor)}</div>
          </div>

          <div className="pl-6 space-y-3 border-l-2 border-slate-100 ml-4">
            <div className="flex justify-between items-center">
              <div className="font-bold text-xs text-slate-500 uppercase">(-) Pembelian Bahan Baku Utama (Ayam)</div>
              <div className="font-black text-rose-500">{formatRupiah(pnlData.hppAyam)}</div>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
              <div className="font-bold text-xs text-slate-500 uppercase">(-) Pengeluaran Logistik & Operasional Lainnya</div>
              <div className="font-black text-rose-500">{formatRupiah(pnlData.biayaOperasional)}</div>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="font-black text-sm text-blue-900 uppercase">TOTAL LABA / RUGI BERSIH</div>
            <div className={`font-black text-xl ${pnlData.labaBersih >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>{formatRupiah(pnlData.labaBersih)}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
