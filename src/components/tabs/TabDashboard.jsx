import React, { useState } from 'react';
import { Wallet, TrendingUp, Users, Calendar, Printer, FileText, ArrowRightLeft, PackageCheck, BellRing, Activity, ShoppingCart, Truck, Factory, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  <div className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm hover:shadow-md transition-shadow`}>
    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-4 relative z-10"><h3 className="font-bold text-[11px] opacity-90 uppercase tracking-wider">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-2xl lg:text-3xl font-black tracking-tight">{value}</div>
        {subtitle && (
            <div className="flex justify-between items-center mt-2 border-t border-black/10 pt-2">
                <span className="text-[9px] font-bold opacity-80 uppercase">{subtitle}</span>
                {subValue && <span className="text-[10px] font-black">{subValue}</span>}
            </div>
        )}
    </div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, setPrintData }) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, dateFrom, dateTo });

  // Helper Icon Feed
  const getFeedIcon = (type) => {
      if(type === 'ORDER') return <ShoppingCart size={14} className="text-blue-600"/>;
      if(type === 'PAYMENT') return <Wallet size={14} className="text-emerald-600"/>;
      if(type === 'PURCHASE') return <Truck size={14} className="text-orange-600"/>;
      if(type === 'PRODUKSI') return <Factory size={14} className="text-purple-600"/>;
      return <ArrowRightLeft size={14} className="text-red-600"/>;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><Calendar size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Pusat Kontrol Operasional</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Tentukan Periode Analisa Realtime</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2.5 text-sm font-bold border border-slate-300 rounded-xl w-full md:w-auto bg-slate-50 focus:ring-2 focus:ring-slate-800 outline-none transition" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2.5 text-sm font-bold border border-slate-300 rounded-xl w-full md:w-auto bg-slate-50 focus:ring-2 focus:ring-slate-800 outline-none transition" />
          </div>
      </div>

      {/* SUMMARY CARDS (REALTIME LEDGER) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Omset Penjualan" value={formatRp(dash.totalOmset)} icon={<TrendingUp size={80}/>} color="bg-blue-50 border-blue-200 text-blue-900" subtitle="Total Terjual" subValue={`${dash.totalPcs} Pcs`} />
        <StatCard title="Saldo Cash (Laci)" value={formatRp(dash.saldoCash)} icon={<Wallet size={80}/>} color="bg-emerald-50 border-emerald-200 text-emerald-900" subtitle="Arus Kas Tunai" subValue={`In: ${formatRp(dash.inCash)}`} />
        <StatCard title="Saldo Bank (Transfer)" value={formatRp(dash.saldoBank)} icon={<ArrowRightLeft size={80}/>} color="bg-indigo-50 border-indigo-200 text-indigo-900" subtitle="Arus Rekening" subValue={`In: ${formatRp(dash.inBank)}`} />
        <StatCard title="Piutang Berjalan" value={formatRp(dash.totalPiutangBaru)} icon={<FileText size={80}/>} color="bg-amber-50 border-amber-200 text-amber-900" subtitle="Uang Nyangkut" subValue={`${dash.piutangBerjalan.length} Invoice`} />
        <StatCard title="Hutang Berjalan" value={formatRp(dash.totalHutangBaru)} icon={<FileText size={80}/>} color="bg-red-50 border-red-200 text-red-900" subtitle="Kewajiban Bayar" subValue={`${dash.hutangBerjalan.length} Tagihan`} />
      </div>

      {/* AREA BAWAH: LAYOUT 3 KOLOM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* KOLOM KIRI: ACTIVITY FEED REALTIME */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b bg-slate-900 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                      <div className="bg-slate-800 p-1.5 rounded-lg text-emerald-400"><Activity size={16}/></div>
                      <h3 className="font-bold text-sm text-white tracking-wide">Aktivitas Operasional</h3>
                  </div>
                  <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
                  </div>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                  {dash.feed.length === 0 ? (
                      <div className="text-center p-8 text-slate-400 text-xs italic">Belum ada aktivitas di periode ini.</div>
                  ) : (
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                          {dash.feed.map((f, idx) => (
                              <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                      {getFeedIcon(f.type)}
                                  </div>
                                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-3 rounded-xl border border-slate-100 shadow-sm group-hover:border-blue-200 transition">
                                      <div className="flex items-center justify-between mb-1">
                                          <span className="font-black text-[10px] uppercase text-slate-700">{f.title}</span>
                                          <span className="text-[9px] font-bold text-slate-400">{new Date(f.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 mb-1 leading-tight">{f.desc}</div>
                                      {f.amount > 0 && (
                                          <div className={`text-xs font-black ${f.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                              {f.isPositive ? '+' : '-'}{formatRp(f.amount)}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>

          {/* KOLOM TENGAH: NOTIFIKASI & KASBON */}
          <div className="flex flex-col gap-6 h-[500px]">
              
              {/* NOTIFIKASI OPERASIONAL */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1">
                  <div className="p-4 border-b bg-amber-50 flex items-center gap-3 sticky top-0">
                      <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700"><BellRing size={16}/></div>
                      <h3 className="font-bold text-sm text-amber-900 tracking-wide">Notifikasi Sistem</h3>
                  </div>
                  <div className="p-3 overflow-y-auto flex-1 space-y-2">
                      {dash.alerts.length === 0 ? (
                          <div className="text-center p-6 text-slate-400 text-xs italic">Semua operasional berjalan normal. Tidak ada peringatan.</div>
                      ) : (
                          dash.alerts.map(a => (
                              <div key={a.id} className={`p-3 rounded-xl border flex items-start gap-3 ${a.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                                  <AlertCircle size={16} className={`shrink-0 mt-0.5 ${a.type === 'danger' ? 'text-red-600' : 'text-orange-600'}`}/>
                                  <div>
                                      <h4 className={`text-[11px] font-black uppercase mb-0.5 ${a.type === 'danger' ? 'text-red-800' : 'text-orange-800'}`}>{a.title}</h4>
                                      <p className="text-[10px] text-slate-700 leading-snug">{a.desc}</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* KASBON KARYAWAN */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1">
                  <div className="p-4 border-b bg-red-50 flex items-center gap-3 sticky top-0">
                      <div className="bg-red-100 p-1.5 rounded-lg text-red-700"><Users size={16}/></div>
                      <h3 className="font-bold text-sm text-red-900 tracking-wide">Hutang Karyawan (Kasbon)</h3>
                  </div>
                  <div className="p-3 overflow-y-auto flex-1">
                      {dash.karyawanKasbon.length === 0 ? (
                          <div className="text-center p-6 text-slate-400 text-[10px] italic">Tidak ada tunggakan kasbon aktif.</div>
                      ) : (
                          <div className="space-y-2">
                              {dash.karyawanKasbon.map((k, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-2.5 border rounded-lg bg-white">
                                      <div className="font-bold text-[11px] text-slate-700 uppercase flex items-center gap-2"><ArrowDownCircle size={12} className="text-red-400"/> {k.nama}</div>
                                      <div className="font-black text-red-600 text-xs">{formatRp(k.sisaKasbon)}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

          </div>

          {/* KOLOM KANAN: CETAK LAPORAN MODULAR */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b bg-blue-50 flex items-center gap-3 sticky top-0">
                  <div className="bg-blue-100 p-1.5 rounded-lg text-blue-700"><Printer size={16}/></div>
                  <h3 className="font-bold text-sm text-blue-900 tracking-wide">Cetak Laporan Modular</h3>
              </div>
              <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                  
                  <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-blue-300 hover:shadow-md transition group">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition"><TrendingUp size={16}/></div><h4 className="font-black text-slate-800 text-xs uppercase">Laporan Penjualan</h4></div>
                      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Rekapitulasi tagihan order, metode bayar kasir, dan sisa piutang pelanggan.</p>
                      <button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'sales' } })} className="w-full bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-bold py-2 rounded-lg text-[10px] transition uppercase tracking-wide">Cetak Lap. Penjualan</button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-emerald-300 hover:shadow-md transition group">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition"><Wallet size={16}/></div><h4 className="font-black text-slate-800 text-xs uppercase">Buku Besar (Ledger)</h4></div>
                      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Histori lengkap pergerakan arus kas tunai dan mutasi rekening bank.</p>
                      <button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'finance' } })} className="w-full bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white font-bold py-2 rounded-lg text-[10px] transition uppercase tracking-wide">Cetak Lap. Keuangan</button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-orange-300 hover:shadow-md transition group">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition"><PackageCheck size={16}/></div><h4 className="font-black text-slate-800 text-xs uppercase">Laporan Produksi</h4></div>
                      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Mencetak pergerakan bahan baku dan rekap adukan. (Akan Datang)</p>
                      <button disabled className="w-full bg-slate-50 text-slate-400 font-bold py-2 rounded-lg text-[10px] cursor-not-allowed uppercase tracking-wide border border-slate-200">Tahap Pengembangan</button>
                  </div>

              </div>
          </div>

      </div>
    </div>
  );
}
