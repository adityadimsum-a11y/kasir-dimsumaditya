import React, { useMemo } from 'react';
import { Store, Receipt, Package, AlertCircle, FileText, Wallet } from 'lucide-react';
import { formatRp, formatDate, getTodayStr } from '../../utils/helpers';

export default function TabDashboardBranch({ orders, purchases, expenses, karyawan, user }) {
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

    // 3. Payroll & Kasbon Summary (Mendukung dua versi kategori teks)
    const myExpenses = (expenses || []).filter(e => !e.isDeleted);
    const totalKasbon = myExpenses.filter(e => e.category === 'KASBON_KARYAWAN' || e.category === 'KASBON').reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPotonganKasbon = myExpenses.filter(e => e.category === 'GAJI_KARYAWAN' || e.category === 'PAYROLL').reduce((sum, e) => sum + Number(e.kasbon_deduction || 0), 0);
    
    return {
        sortedOrders,
        omsetHariIni,
        totalGajiBulanIni: myExpenses.filter(e => (e.category === 'GAJI_KARYAWAN' || e.category === 'PAYROLL') && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.amount), 0),
        totalKasbonBulanIni: myExpenses.filter(e => (e.category === 'KASBON_KARYAWAN' || e.category === 'KASBON') && e.date.startsWith(curMonth)).reduce((sum, e) => sum + Number(e.amount), 0),
        sisaPiutang: totalKasbon - totalPotonganKasbon
    };
  }, [orders, expenses, currentBranch, todayStr, curMonth]);

  // Tambahkan perhitungan jatuh tempo (Tempo) sederhana: +7 Hari / +14 Hari dari tanggal transaksi
  const hitungTempo = (tgl, hari = 7) => {
      if(!tgl) return '-';
      const d = new Date(tgl);
      d.setDate(d.getDate() + hari);
      return d.toISOString().split('T')[0]; 
  };

  const detailData = useMemo(() => {
      // 1. DETAIL PIUTANG PELANGGAN (Dari Orders)
      const listPiutang = (orders || [])
          .filter(o => !o.isDeleted && String(o.branch_id).toUpperCase() === currentBranch.toUpperCase())
          .map(o => {
              const terbayar = Number(o.paidAmount || 0); 
              const sisa = Number(o.total || 0) - terbayar;
              return { ...o, sisaTagihan: sisa, tempo: hitungTempo(o.date, 7) };
          })
          .filter(o => o.sisaTagihan > 0 && (o.paymentMethod === 'PIUTANG' || o.statusProduksi === 'Sudah Diambil'))
          .sort((a,b) => new Date(b.date) - new Date(a.date));

      // 2. DETAIL HUTANG & BELANJA (Dari Purchases)
      const listBelanjaHutang = (purchases || [])
          .filter(p => !p.isDeleted && String(p.branch_id).toUpperCase() === currentBranch.toUpperCase())
          .map(p => {
              const tagihan = Number(p.totalAmount || p.total_amount || 0);
              const dibayar = Number(p.paidAmount || p.paid_amount || 0);
              const sisa = tagihan - dibayar;
              return { ...p, sisaHutang: sisa, tempo: hitungTempo(p.date, 14) }; // Tempo supplier 14 hari
          })
          .filter(p => p.sisaHutang > 0) // Filter agar HANYA menampilkan yang belum lunas
          .sort((a,b) => new Date(b.date) - new Date(a.date));

      // 3. DETAIL KASBON KARYAWAN (Dari Expenses)
      const listKasbon = (expenses || [])
          .filter(e => !e.isDeleted && String(e.branch_id).toUpperCase() === currentBranch.toUpperCase())
          .filter(e => e.category === 'KASBON' || e.category === 'KASBON_KARYAWAN')
          .sort((a,b) => new Date(b.date) - new Date(a.date));

      return { listPiutang, listBelanjaHutang, listKasbon };
  }, [orders, purchases, expenses, currentBranch]);

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

      {/* TABEL DETAIL TRANSAKSI OMSET (POS) */}
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
                          data.sortedOrders.slice(0, 50).map(o => (
                              <tr key={o.id} className="hover:bg-slate-50 transition">
                                  <td className="px-6 py-4 font-bold text-slate-700">{formatDate(o.date)}</td>
                                  <td className="px-6 py-4 font-mono font-bold text-slate-400 text-[10px]">{o.id}</td>
                                  <td className="px-6 py-4 uppercase font-black text-slate-800">{o.customer_name}</td>
                                  <td className="px-6 py-4 text-slate-600">{o.itemName}</td>
                                  <td className="px-6 py-4 text-center font-bold text-blue-600">{Number(o.qty).toLocaleString('id-ID')} Pcs</td>
                                  <td className="px-6 py-4 text-right font-black">{formatRp(o.total)}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${o.paymentMethod === 'PIUTANG' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {o.paymentMethod === 'PIUTANG' ? 'PIUTANG' : 'LUNAS'}
                                      </span>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      
      {/* ========================================================= */}
      {/* SECTION DETAIL TRANSAKSI: PIUTANG, HUTANG, & KASBON       */}
      {/* ========================================================= */}
      <div className="space-y-6 mt-8 border-t border-slate-200 pt-8">
          <h3 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
              <FileText className="text-blue-600"/> Laporan Detail Transaksi (Untuk Review)
          </h3>

          {/* 1. TABEL DETAIL PIUTANG PELANGGAN */}
          <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-orange-50 flex items-center gap-2">
                  <AlertCircle size={18} className="text-orange-600"/>
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Rincian Piutang Pelanggan (Lokal)</h4>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                          <tr><th className="px-4 py-3">Tgl & Tempo</th><th className="px-4 py-3">ID / Nota</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3 text-center">Qty (Pcs)</th><th className="px-4 py-3 text-right">Total Tagihan</th><th className="px-4 py-3 text-right text-red-600">Sisa Belum Dibayar</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {detailData.listPiutang.length === 0 ? <tr><td colSpan="6" className="text-center py-6 text-slate-400">Semua tagihan pelanggan sudah lunas.</td></tr> : 
                          detailData.listPiutang.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3"><div className="text-slate-800">{formatDate(p.date)}</div><div className="text-[9px] text-red-500 mt-0.5">Tempo: {formatDate(p.tempo)}</div></td>
                                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{p.invoice_no || p.id}</td>
                                  <td className="px-4 py-3 uppercase text-slate-800">{p.customer_name || p.customer}</td>
                                  <td className="px-4 py-3 text-center text-blue-600">{p.qty}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{formatRp(p.total)}</td>
                                  <td className="px-4 py-3 text-right font-black text-red-600">{formatRp(p.sisaTagihan)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* 2. TABEL DETAIL HUTANG & BELANJA OPERASIONAL */}
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-red-50 flex items-center gap-2">
                  <Package size={18} className="text-red-600"/>
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Rincian Belanja & Hutang Supplier</h4>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                          <tr><th className="px-4 py-3">Tgl & Tempo</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Deskripsi Barang</th><th className="px-4 py-3 text-center">Volume</th><th className="px-4 py-3 text-right">Total Belanja</th><th className="px-4 py-3 text-right text-red-600">Sisa Hutang</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {detailData.listBelanjaHutang.length === 0 ? <tr><td colSpan="6" className="text-center py-6 text-slate-400">Belum ada catatan belanja logistik yang masih hutang.</td></tr> : 
                          detailData.listBelanjaHutang.map(b => (
                              <tr key={b.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3"><div className="text-slate-800">{formatDate(b.date)}</div>{b.sisaHutang > 0 && <div className="text-[9px] text-red-500 mt-0.5">Tempo: {formatDate(b.tempo)}</div>}</td>
                                  <td className="px-4 py-3 uppercase text-slate-800">{b.supplierName || b.supplier_name}</td>
                                  <td className="px-4 py-3 uppercase text-slate-600">{b.itemName || b.item_name}</td>
                                  <td className="px-4 py-3 text-center text-blue-600">{b.qty} {b.unit}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{formatRp(b.totalAmount || b.total_amount)}</td>
                                  <td className="px-4 py-3 text-right font-black">
                                      {b.sisaHutang > 0 ? <span className="text-red-600">{formatRp(b.sisaHutang)}</span> : <span className="text-emerald-600 text-[10px] bg-emerald-50 px-2 py-1 rounded">LUNAS</span>}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* 3. TABEL DETAIL KASBON KARYAWAN */}
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-indigo-50 flex items-center gap-2">
                  <Wallet size={18} className="text-indigo-600"/>
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Rincian Kasbon Karyawan</h4>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                          <tr><th className="px-4 py-3">Tgl Transaksi</th><th className="px-4 py-3">ID Referensi</th><th className="px-4 py-3">Deskripsi / Keterangan</th><th className="px-4 py-3 text-center">Metode</th><th className="px-4 py-3 text-right text-indigo-600">Nominal Pinjaman</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold">
                          {detailData.listKasbon.length === 0 ? <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada kasbon karyawan saat ini.</td></tr> : 
                          detailData.listKasbon.map(k => (
                              <tr key={k.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-slate-800">{formatDate(k.date)}</td>
                                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{k.id}</td>
                                  <td className="px-4 py-3 text-slate-600 uppercase">{k.description}</td>
                                  <td className="px-4 py-3 text-center text-[10px] uppercase">{k.payment_method}</td>
                                  <td className="px-4 py-3 text-right font-black text-indigo-600">{formatRp(k.amount)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

    </div>
  );
}
