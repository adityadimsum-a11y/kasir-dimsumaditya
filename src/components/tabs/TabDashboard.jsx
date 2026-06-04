import React, { useState } from 'react';
import { Wallet, TrendingUp, Users, Calendar, Printer, FileText, ArrowRightLeft, PackageCheck, BellRing, Activity, ShoppingCart, Truck, Factory, AlertCircle, Clock, ArrowDownCircle } from 'lucide-react';
import { formatRp, getTodayStr, formatDate } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm hover:shadow-md transition-shadow`}>
    <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-2 relative z-10"><h3 className="font-bold text-[10px] opacity-90 uppercase tracking-wider">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-xl lg:text-2xl font-black tracking-tight">{value}</div>
        {subtitle && (
            <div className="flex justify-between items-center mt-1.5 border-t border-black/10 pt-1.5">
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

  const getFeedIcon = (type) => {
      if(type === 'ORDER') return <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white z-10"><ShoppingCart size={14}/></div>;
      if(type === 'PAYMENT') return <div className="bg-emerald-100 text-emerald-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white z-10"><Wallet size={14}/></div>;
      if(type === 'PURCHASE') return <div className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white z-10"><Truck size={14}/></div>;
      if(type === 'PRODUKSI') return <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white z-10"><Factory size={14}/></div>;
      return <div className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white z-10"><ArrowRightLeft size={14}/></div>;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><Activity size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Pusat Kontrol Operasional</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Monitor Transaksi Realtime</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2.5 text-sm font-bold border border-slate-300 rounded-xl w-full md:w-auto bg-slate-50 focus:ring-2 focus:ring-slate-800 outline-none transition" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2.5 text-sm font-bold border border-slate-300 rounded-xl w-full md:w-auto bg-slate-50 focus:ring-2 focus:ring-slate-800 outline-none transition" />
          </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Omset Penjualan" value={formatRp(dash.totalOmset)} icon={<TrendingUp size={64}/>} color="bg-blue-50 border-blue-200 text-blue-900" subtitle="Terjual" subValue={`${dash.totalPcs} Pcs`} />
        <StatCard title="Saldo Cash (Laci)" value={formatRp(dash.saldoCash)} icon={<Wallet size={64}/>} color="bg-emerald-50 border-emerald-200 text-emerald-900" subtitle="In: Cash" subValue={formatRp(dash.inCash)} />
        <StatCard title="Saldo Bank (TF)" value={formatRp(dash.saldoBank)} icon={<ArrowRightLeft size={64}/>} color="bg-indigo-50 border-indigo-200 text-indigo-900" subtitle="In: Transfer" subValue={formatRp(dash.inBank)} />
        <StatCard title="Piutang Berjalan" value={formatRp(dash.totalPiutangBaru)} icon={<FileText size={64}/>} color="bg-amber-50 border-amber-200 text-amber-900" subtitle="Invoice" subValue={`${dash.piutangBerjalan.length} Nota`} />
        <StatCard title="Hutang Berjalan" value={formatRp(dash.totalHutangBaru)} icon={<FileText size={64}/>} color="bg-red-50 border-red-200 text-red-900" subtitle="Supplier" subValue={`${dash.hutangBerjalan.length} Nota`} />
      </div>

      {/* AREA BAWAH: LAYOUT 3 KOLOM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 items-start">
          
          {/* KOLOM KIRI: ACTIVITY FEED REALTIME (4/12) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm flex flex-col h-[700px]">
              <div className="p-4 border-b bg-slate-900 flex items-center justify-between sticky top-0 z-20 rounded-t-2xl">
                  <div className="flex items-center gap-3"><div className="bg-slate-800 p-1.5 rounded-lg text-emerald-400"><Activity size={16}/></div><h3 className="font-bold text-sm text-white tracking-wide">Activity Feed Operasional</h3></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Live</span></div>
              </div>
              <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50">
                  {(!dash.feed || dash.feed.length === 0) ? (
                      <div className="text-center p-8 text-slate-400 text-xs italic">Belum ada aktivitas di periode ini.</div>
                  ) : (
                      <div className="relative before:absolute before:inset-0 before:ml-4 before:w-0.5 before:bg-slate-200 space-y-6">
                          {dash.feed.map((f, idx) => (
                              <div key={idx} className="relative flex items-start gap-4">
                                  {getFeedIcon(f.type)}
                                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-1 hover:border-slate-300 transition group">
                                      <div className="flex justify-between items-start mb-1">
                                          <div className="flex items-center gap-2">
                                              <span className={`w-2 h-2 rounded-full ${f.type==='ORDER'?'bg-blue-500':f.type==='PAYMENT'?'bg-emerald-500':f.type==='PRODUKSI'?'bg-purple-500':f.type==='PURCHASE'?'bg-orange-500':'bg-red-500'}`}></span>
                                              <span className="font-black text-[10px] uppercase text-slate-700">{f.title}</span>
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-400 text-right">{f.time}<br/>{formatDate(f.date).replace(/20\d\d/,'')}</span>
                                      </div>
                                      <div className="font-bold text-xs text-slate-700 uppercase mb-0.5">{f.name}</div>
                                      <div className="text-[10px] text-slate-500 leading-tight mb-2">{f.desc}</div>
                                      {f.amount > 0 && (
                                          <div className={`text-xs font-black bg-slate-50 px-2 py-1 rounded w-max ${f.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
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

          {/* KOLOM TENGAH: LIST PIUTANG & HUTANG (5/12) */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                  <div className="p-4 border-b bg-amber-50 flex items-center gap-3 sticky top-0 z-10 rounded-t-2xl"><div className="bg-amber-100 p-1.5 rounded-lg text-amber-700"><Clock size={16}/></div><h3 className="font-bold text-sm text-amber-900 tracking-wide uppercase">Piutang Customer Berjalan</h3></div>
                  <div className="p-4 bg-slate-50/50 space-y-3">
                      {(!dash.piutangBerjalan || dash.piutangBerjalan.length === 0) ? <div className="text-center p-6 text-slate-400 text-[10px] italic">Tidak ada piutang customer aktif.</div> : dash.piutangBerjalan.map((p, idx) => (
                          <div key={idx} className="bg-white border border-amber-200 rounded-xl p-3 shadow-sm hover:shadow-md transition relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                              <div className="flex justify-between items-center mb-2 pl-2"><span className="text-[9px] text-slate-500 font-bold">{formatDate(p.date)} • {p.time}</span><span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.id}</span></div>
                              <div className="font-black uppercase text-slate-800 text-sm mb-2 pl-2 truncate">{p.customer}</div>
                              <div className="flex justify-between items-end pl-2"><div><div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Sisa Tagihan</div><div className="font-black text-red-600 text-sm">{formatRp(p.sisaTagihan)}</div></div><div className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200">Status: {p.statusProduksi}</div></div>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                  <div className="p-4 border-b bg-red-50 flex items-center gap-3 sticky top-0 z-10 rounded-t-2xl"><div className="bg-red-100 p-1.5 rounded-lg text-red-700"><Clock size={16}/></div><h3 className="font-bold text-sm text-red-900 tracking-wide uppercase">Hutang Supplier Aktif</h3></div>
                  <div className="p-4 bg-slate-50/50 space-y-3">
                      {(!dash.hutangBerjalan || dash.hutangBerjalan.length === 0) ? <div className="text-center p-6 text-slate-400 text-[10px] italic">Tidak ada hutang supplier aktif.</div> : dash.hutangBerjalan.map((h, idx) => (
                          <div key={idx} className="bg-white border border-red-200 rounded-xl p-3 shadow-sm hover:shadow-md transition relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                              <div className="flex justify-between items-center mb-2 pl-2"><span className="text-[9px] text-slate-500 font-bold">{formatDate(h.date)} • {h.time}</span><span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{h.id}</span></div>
                              <div className="font-black uppercase text-slate-800 text-sm mb-2 pl-2 truncate">{h.supplier}</div>
                              <div className="flex justify-between items-end pl-2"><div><div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Sisa Kewajiban</div><div className="font-black text-red-600 text-sm">{formatRp(h.sisaHutang)}</div></div><div className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">Status: Belum Lunas</div></div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* KOLOM KANAN: NOTIFIKASI & PRINT MODULAR (3/12) */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                  <div className="p-4 border-b bg-slate-50 flex items-center gap-3 sticky top-0 z-10 rounded-t-2xl"><div className="bg-white border p-1.5 rounded-lg text-slate-700"><BellRing size={16}/></div><h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase">Notifikasi Sistem</h3></div>
                  <div className="p-3 bg-slate-50/50 space-y-2">
                      {(!dash.alerts || dash.alerts.length === 0) ? <div className="text-center p-6 text-slate-400 text-xs italic">Semua operasional berjalan normal.</div> : dash.alerts.map(a => (
                          <div key={a.id} className={`p-3 rounded-xl border flex items-start gap-3 shadow-sm bg-white ${a.type === 'danger' ? 'border-red-200' : 'border-orange-200'}`}>
                              <AlertCircle size={16} className={`shrink-0 mt-0.5 ${a.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`}/>
                              <div><h4 className={`text-[10px] font-black uppercase mb-0.5 ${a.type === 'danger' ? 'text-red-700' : 'text-orange-700'}`}>{a.title}</h4><p className="text-[9px] text-slate-600 leading-snug">{a.desc}</p></div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-white rounded-2xl border shadow-sm flex flex-col">
                  <div className="p-4 border-b bg-blue-50 flex items-center gap-3 sticky top-0 z-10 rounded-t-2xl"><div className="bg-blue-100 p-1.5 rounded-lg text-blue-700"><Printer size={16}/></div><h3 className="font-bold text-sm text-blue-900 tracking-wide uppercase">Cetak Modular</h3></div>
                  <div className="p-4 flex flex-col gap-3 bg-slate-50/50">
                      <div className="border border-slate-200 rounded-xl p-3 bg-white hover:border-blue-300 hover:shadow-md transition"><div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={14}/></div><h4 className="font-black text-slate-800 text-[10px] uppercase">Lap. Penjualan</h4></div><button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'sales' } })} className="w-full bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-bold py-2 rounded-lg text-[10px] transition uppercase tracking-wide mt-2">Cetak Data</button></div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-white hover:border-emerald-300 hover:shadow-md transition"><div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet size={14}/></div><h4 className="font-black text-slate-800 text-[10px] uppercase">Buku Besar (Ledger)</h4></div><button onClick={() => setPrintData({ type: 'report', data: { dash, dateFrom, dateTo, reportType: 'finance' } })} className="w-full bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white font-bold py-2 rounded-lg text-[10px] transition uppercase tracking-wide mt-2">Cetak Data</button></div>
                  </div>
              </div>
          </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }`}}/>
    </div>
  );
}
