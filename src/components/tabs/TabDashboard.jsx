import React, { useState } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, TrendingUp, ArrowRightLeft, Users, ShoppingCart, AlertCircle, Clock, Package, CheckCircle } from 'lucide-react';
import { getTodayStr, formatRp, formatDate, generateId } from '../../utils/helpers';
import SimpleSVGLineChart from '../ui/SimpleSVGLineChart';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90">{title}</h3><div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div></div>
    <div className="text-2xl font-bold tracking-tight">{formatRp(amount)}</div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, setPrintData, sendToSheet }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  // LOGIC DIAMBIL DARI CUSTOM HOOK
  const rekap = useDashboardPusat({ 
    orders, expenses, purchases, piutangPayments, pemalangReports, 
    dateFrom, dateTo, chartView 
  });

  // LOGIC CLOSING KAS HARIAN (NOL-KAN LACI)
  const handleClosingKas = () => {
      if (rekap.saldoCash <= 0) {
          alert("Saldo Uang Fisik (Cash) saat ini Rp 0 atau minus. Tidak ada yang bisa disetor.");
          return;
      }
      
      const confirmSetor = window.confirm(`Perhatian: Uang fisik di laci Anda saat ini SEHARUSNYA adalah:\n\n>>> ${formatRp(rekap.saldoCash)} <<<\n\nJika uang fisik sudah Anda hitung dan jumlahnya PAS, klik OK untuk melakukan SETOR KE OWNER (Closing Kas). Saldo Cash akan otomatis menjadi Nol.`);
      
      if (confirmSetor) {
          const today = getTodayStr();
          const newExpense = {
              id: generateId('OUT', today), 
              date: today,
              recipient: 'Pimpinan / Owner',
              category: 'Setoran Kas Harian / Closing',
              description: `Closing kas dan serah terima uang fisik ke Bos.`,
              qty: 1,
              price: rekap.saldoCash,
              total: rekap.saldoCash,
              type: 'OUT',
              paymentMethod: 'Cash',
              editCount: 0
          };
          
          // Simpan pengeluaran setor ke database
          sendToSheet('insert', newExpense, 'expenses');
          
          // Langsung otomatis cetak Voucher Kas Keluar
          setPrintData({ type: 'voucher', data: newExpense });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Laporan & Cetak</h3><div className="flex gap-2"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg" /><span className="text-slate-400 self-center">s/d</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg" /></div></div>
          <button onClick={() => setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 text-sm font-medium"><Printer size={16} /> Cetak Rekap Pusat</button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Saldo Berjalan (Akumulasi Aktif)</h2>
                  <p className="text-xs text-slate-500">*Dihitung otomatis terus-menerus (continue) sampai dengan {formatDate(dateTo)}.</p>
              </div>
              <button 
                onClick={handleClosingKas} 
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md transition transform hover:scale-105"
                title="Tekan ini saat mau pulang / tutup toko"
              >
                <CheckCircle size={18} /> Closing Kas & Setor Uang
              </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Saldo Tunai (Laci CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Saldo Rekening Bank (TF)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
          </div>
      </div>

      {/* Tabel Pembelian Bahan Baku */}
      <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-700"><ShoppingCart size={20}/> Transaksi Pembelian Bahan Baku</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-indigo-50 border-b border-indigo-100">
                      <tr><th className="px-3 py-2 text-indigo-800">Tgl & Inv</th><th className="px-3 py-2 text-indigo-800">Supplier</th><th className="px-3 py-2 text-indigo-800">Barang & Qty</th><th className="px-3 py-2 text-center text-indigo-800">Via</th><th className="px-3 py-2 text-right text-indigo-800">Total</th><th className="px-3 py-2 text-right text-indigo-800">Terbayar</th><th className="px-3 py-2 text-right text-indigo-800">Sisa</th><th className="px-3 py-2 text-center text-indigo-800">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap?.listPembelianDetail || rekap.listPembelianDetail.length === 0) ? (
                          <tr><td colSpan="8" className="text-center py-6 text-slate-400">Tidak ada data pembelian di periode ini.</td></tr>
                      ) : (
                          rekap.listPembelianDetail.map((c, i) => {
                              const sisa = Number(c?.total || 0) - Number(c?.paidAmount || 0);
                              const status = sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS';
                              return (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(c?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{c?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{c?.supplier || '-'}</td>
                                  <td className="px-3 py-2 text-xs uppercase">{c?.itemName || '-'} ({c?.qty || 0} {c?.satuan || '-'})</td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{c?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatRp(c?.total)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatRp(c?.paidAmount)}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">{formatRp(sisa)}</td>
                                  <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{status}</span>
                                  </td>
                              </tr>
                          )})
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Wallet size={20}/> Riwayat Kas Pegangan Admin (Pengeluaran Lainnya)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                      <tr><th className="px-3 py-2 text-slate-800">Tgl & Ref</th><th className="px-3 py-2 text-slate-800">Penerima</th><th className="px-3 py-2 text-slate-800">Kategori & Keterangan</th><th className="px-3 py-2 text-center text-slate-800">Via</th><th className="px-3 py-2 text-right text-slate-800">Nominal</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap?.listExpenses || rekap.listExpenses.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada data pengeluaran kas di periode ini.</td></tr>
                      ) : (
                          rekap.listExpenses.map((o, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{o?.recipient || '-'}</td>
                                  <td className="px-3 py-2"><div className="font-bold text-slate-800 uppercase">{o?.category || '-'}</div><div className="text-xs text-slate-600">{o?.description || '-'}</div></td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{o?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">-{formatRp(o?.total)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {(rekap.listPiutangBerjalan.length > 0 || rekap.listHutangBerjalan.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-700"><AlertCircle size={20}/> Daftar Piutang Berjalan (Belum Lunas)</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-orange-50 border-b border-orange-100">
                              <tr><th className="px-3 py-2 text-orange-800">Tgl & Inv</th><th className="px-3 py-2 text-orange-800">Pelanggan</th><th className="px-3 py-2 text-right text-orange-800">Sisa Tagihan</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {rekap.listPiutangBerjalan.map((p, i) => {
                                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                                  return (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-400 font-mono">{p.id}</div></td>
                                      <td className="px-3 py-2 font-bold uppercase text-xs">{p.customer}</td>
                                      <td className="px-3 py-2 text-right">
                                          <div className="font-black text-red-600">{formatRp(p.sisaHutang)}</div>
                                          {isNew && <span className="inline-block mt-0.5 text-[9px] font-black text-orange-600 bg-orange-100 px-1 rounded">(PIUTANG BARU)</span>}
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-700"><AlertCircle size={20}/> Daftar Hutang Berjalan (Belum Lunas)</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-red-50 border-b border-red-100">
                              <tr><th className="px-3 py-2 text-red-800">Tgl & Inv</th><th className="px-3 py-2 text-red-800">Supplier</th><th className="px-3 py-2 text-right text-red-800">Sisa Hutang</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {rekap.listHutangBerjalan.map((p, i) => {
                                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                                  return (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-400 font-mono">{p.id}</div></td>
                                      <td className="px-3 py-2 font-bold uppercase text-xs">{p.supplier}</td>
                                      <td className="px-3 py-2 text-right">
                                          <div className="font-black text-red-600">{formatRp(p.sisaHutang)}</div>
                                          {isNew && <span className="inline-block mt-0.5 text-[9px] font-black text-red-600 bg-red-100 px-1 rounded">(HUTANG BARU)</span>}
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-700"><Clock size={20}/> Riwayat Terima Piutang (Pelanggan)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-emerald-50 border-b border-emerald-100">
                        <tr><th className="px-3 py-2 text-emerald-800">Tgl & Ref</th><th className="px-3 py-2 text-emerald-800">Pelanggan</th><th className="px-3 py-2 text-center text-emerald-800">Via</th><th className="px-3 py-2 text-right text-emerald-800">Nominal Masuk</th><th className="px-3 py-2 text-right text-emerald-800">Sisa Tagihan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rekap.listRiwayatPiutang.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada riwayat piutang.</td></tr>}
                        {rekap.listRiwayatPiutang.map((pay, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(pay.date)}</div><div className="text-[10px] text-slate-400 font-mono">{pay.orderId}</div></td>
                                <td className="px-3 py-2 font-bold uppercase text-xs">{pay.customer}</td>
                                <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{pay.paymentMethod}</td>
                                <td className="px-3 py-2 text-right font-black text-emerald-600">+{formatRp(pay.amount)}</td>
                                <td className="px-3 py-2 text-right">
                                    <div className={`font-bold ${pay.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pay.sisaTagihan <= 0 ? 'Rp 0' : formatRp(pay.sisaTagihan)}</div>
                                    <div className={`text-[9px] font-bold ${pay.statusNota === 'LUNAS' ? 'text-emerald-500' : 'text-orange-500'}`}>{pay.statusNota}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-700"><Clock size={20}/> Riwayat Bayar Hutang (Supplier)</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-red-50 border-b border-red-100">
                        <tr><th className="px-3 py-2 text-red-800">Tgl & Ref</th><th className="px-3 py-2 text-red-800">Supplier</th><th className="px-3 py-2 text-center text-red-800">Via</th><th className="px-3 py-2 text-right text-red-800">Nominal Keluar</th><th className="px-3 py-2 text-right text-red-800">Sisa Hutang</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rekap.listRiwayatHutang.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada riwayat hutang.</td></tr>}
                        {rekap.listRiwayatHutang.map((pay, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(pay.date)}</div><div className="text-[10px] text-slate-400 font-mono">{pay.orderId}</div></td>
                                <td className="px-3 py-2 font-bold uppercase text-xs">{pay.customer}</td>
                                <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{pay.paymentMethod}</td>
                                <td className="px-3 py-2 text-right font-black text-red-600">-{formatRp(pay.amount)}</td>
                                <td className="px-3 py-2 text-right">
                                    <div className={`font-bold ${pay.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pay.sisaTagihan <= 0 ? 'Rp 0' : formatRp(pay.sisaTagihan)}</div>
                                    <div className={`text-[9px] font-bold ${pay.statusNota === 'LUNAS' ? 'text-emerald-500' : 'text-orange-500'}`}>{pay.statusNota}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div><h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-blue-800"><ArrowRightLeft size={20}/> Arus Uang Masuk & Keluar</h3><p className="text-xs text-slate-500 mb-4 border-b pb-2">Khusus periode {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100"><div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Masuk (Cash)</div><div className="text-lg font-black text-emerald-600">+{formatRp(rekap.inCashPeriode)}</div></div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100"><div className="text-[10px] font-bold text-indigo-700 uppercase mb-1">Total Masuk (Transfer)</div><div className="text-lg font-black text-indigo-600">+{formatRp(rekap.inTfPeriode)}</div><div className="text-[9px] text-indigo-500 mt-1">Termasuk TF Cabang: {formatRp(rekap.setorPemalangPeriode)}</div></div>
                <div className="bg-red-50 p-3 rounded border border-red-100"><div className="text-[10px] font-bold text-red-700 uppercase mb-1">Total Keluar (Cash)</div><div className="text-lg font-black text-red-600">-{formatRp(rekap.outCashPeriode)}</div></div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100"><div className="text-[10px] font-bold text-orange-700 uppercase mb-1">Total Keluar (Transfer)</div><div className="text-lg font-black text-orange-600">-{formatRp(rekap.outTfPeriode)}</div></div>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[340px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas (Periode Ini)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {(!rekap?.topCustomersList || rekap.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>
               ) : (
                   rekap.topCustomersList.map((cust, i) => (<div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div><div><div className="font-bold text-slate-800">{cust.name}</div><div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div></div></div><div className="font-bold text-emerald-600">{formatRp(cust.total)}</div></div>))
               )}
            </div>
        </div>
      </div>
    </div>
  );
}
