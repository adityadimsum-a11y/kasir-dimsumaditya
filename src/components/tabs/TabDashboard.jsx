import React, { useState } from 'react';
import { Wallet, TrendingUp, Users, Calendar, Printer, FileText, ArrowRightLeft, Package } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

// Fungsi bantuan lokal agar tidak error di Vercel
const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color}`}>
    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-4 relative z-10"><h3 className="font-bold text-sm opacity-90 uppercase tracking-wide">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-3xl font-black tracking-tight">{value}</div>
        {subtitle && <div className="text-[10px] font-bold mt-2 opacity-80 uppercase">{subtitle}</div>}
    </div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, setPrintData }) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Calendar size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none">Filter Dashboard</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Tentukan Periode Analisa</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2.5 text-sm font-bold border rounded-lg w-full md:w-auto bg-slate-50" />
              <span className="text-slate-400 self-center font-bold">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2.5 text-sm font-bold border rounded-lg w-full md:w-auto bg-slate-50" />
          </div>
      </div>

      {/* SUMMARY CARDS (REALTIME LEDGER) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Omset Penjualan (Pusat)" value={formatRp(dash.totalOmset)} icon={<TrendingUp size={80}/>} color="bg-blue-50 border-blue-200 text-blue-800" subtitle={`Total Dimsum Terjual: ${dash.totalPcs} Pcs`} />
        <StatCard title="Saldo Laci / Brankas (Cash)" value={formatRp(dash.saldoCash)} icon={<Wallet size={80}/>} color="bg-emerald-50 border-emerald-200 text-emerald-800" subtitle={`Masuk: ${formatRp(dash.inCash)} | Keluar: ${formatRp(dash.outCash)}`} />
        <StatCard title="Saldo Rekening (Bank/TF)" value={formatRp(dash.saldoBank)} icon={<ArrowRightLeft size={80}/>} color="bg-indigo-50 border-indigo-200 text-indigo-800" subtitle={`Masuk: ${formatRp(dash.inBank)} | Keluar: ${formatRp(dash.outBank)}`} />
        <StatCard title="Total Piutang Berjalan" value={formatRp(dash.totalPiutangBaru)} icon={<FileText size={80}/>} color="bg-orange-50 border-orange-200 text-orange-800" subtitle={`${dash.piutangBerjalan.length} Invoice Pelanggan Belum Lunas`} />
      </div>

      {/* AREA BAWAH: CETAK MODULAR & KASBON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* MODUL CETAK LAPORAN (KIRI) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
                  <div className="bg-slate-800 p-2 rounded-lg text-white"><Printer size={18}/></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-wide">Cetak Laporan Modular</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  
                  <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/50 flex flex-col justify-between hover:shadow-md transition">
                      <div><h4 className="font-black text-blue-800 flex items-center gap-2 mb-1"><TrendingUp size={16}/> Laporan Penjualan</h4><p className="text-xs text-slate-500 mb-4">Mencetak rekap order, total omset, metode pembayaran, dan piutang pelanggan.</p></div>
                      <button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'sales' } })} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition">Cetak Lap. Penjualan</button>
                  </div>

                  <div className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/50 flex flex-col justify-between hover:shadow-md transition">
                      <div><h4 className="font-black text-emerald-800 flex items-center gap-2 mb-1"><Wallet size={16}/> Laporan Arus Kas & Bank</h4><p className="text-xs text-slate-500 mb-4">Mencetak *Ledger* (Buku Besar) pergerakan uang tunai dan transfer masuk/keluar.</p></div>
                      <button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'finance' } })} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition">Cetak Lap. Keuangan</button>
                  </div>

                  <div className="border border-orange-100 rounded-xl p-4 bg-orange-50/50 flex flex-col justify-between hover:shadow-md transition">
                      <div><h4 className="font-black text-orange-800 flex items-center gap-2 mb-1"><Package size={16}/> Laporan Stok & Produksi</h4><p className="text-xs text-slate-500 mb-4">Mencetak pergerakan bahan baku, total adukan, dan sisa stok freezer.</p></div>
                      <button onClick={() => { alert('Modul Cetak Stok Modular dalam tahap integrasi ke Ledger Stok.'); }} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-xs transition">Cetak Lap. Stok</button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between hover:shadow-md transition opacity-60">
                      <div><h4 className="font-black text-slate-800 flex items-center gap-2 mb-1"><Users size={16}/> Laporan SDM / Payroll</h4><p className="text-xs text-slate-500 mb-4">Modul penggajian, lembur, dan kasbon karyawan. (Tahap Pengembangan)</p></div>
                      <button disabled className="w-full bg-slate-300 text-slate-500 font-bold py-2.5 rounded-lg text-xs cursor-not-allowed">Cetak Laporan SDM</button>
                  </div>

              </div>
          </div>

          {/* MONITORING KASBON KARYAWAN (KANAN) */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col max-h-[400px]">
              <div className="p-5 border-b bg-red-50 flex items-center gap-3">
                  <div className="bg-red-600 p-2 rounded-lg text-white"><Users size={18}/></div>
                  <div><h3 className="font-black text-red-900 uppercase tracking-wide leading-tight">Monitoring Kasbon</h3><p className="text-[9px] font-bold text-red-600">HUTANG KARYAWAN BELUM LUNAS</p></div>
              </div>
              <div className="p-2 overflow-y-auto flex-1">
                  {(!dash.karyawanKasbon || dash.karyawanKasbon.length === 0) ? (
                      <div className="text-center p-8 text-slate-400 text-xs italic">Bagus! Tidak ada karyawan yang memiliki tunggakan kasbon aktif.</div>
                  ) : (
                      <div className="space-y-2">
                          {dash.karyawanKasbon.map((k, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 border rounded-xl bg-white hover:bg-slate-50 transition">
                                  <div className="font-bold text-sm text-slate-800 uppercase">{k.nama}</div>
                                  <div className="font-black text-red-600">{formatRp(k.sisaKasbon)}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>

      </div>
    </div>
  );
}
