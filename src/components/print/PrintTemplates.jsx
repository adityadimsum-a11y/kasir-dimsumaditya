import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

const dotMatrixStyle = `
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.4; }
  .clean-header-block { border-top: 2px solid black; border-bottom: 2px solid black; padding: 12px 0; margin-bottom: 20px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .table-pro th { border-top: 1px solid black; border-bottom: 1px solid black; padding: 10px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 11px; }
  .table-pro td { padding: 10px 4px; text-align: center; border-bottom: 1px dashed #ccc; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
  .table-pro tbody tr:last-child td { border-bottom: 2px solid black; }
  @media print {
    @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
    .print-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

const a4Style = `
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 30px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
  .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
  .table-print th, .table-print td { border: 1px solid #aaa !important; padding: 8px !important; text-align: left; vertical-align: middle; }
  .table-print th { background-color: #f8f9fa !important; text-align: center; font-weight: bold; text-transform: uppercase; color: #333; }
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif !important; font-size: 11px !important; color: black; background: white; -webkit-print-color-adjust: exact; margin: 0; } 
    .hide-on-print { display: none !important; } 
    .a4-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

// ============================================================================
// KOMPONEN PRINT LAPORAN REKAP PUSAT (A4)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-8">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-2xl font-black uppercase mb-1">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold text-slate-700 mb-1">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <h3 className="font-bold text-sm mb-3 text-slate-800">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {rekap?.listTransaksiDetail?.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 italic text-slate-500">Tidak ada transaksi di periode ini.</td></tr>
            ) : (
                rekap?.listTransaksiDetail.map((c, i) => (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px] text-slate-500">{c.id}</span></td>
                        <td className="font-bold uppercase">{c.customer}</td>
                        <td className="text-right font-medium">{formatRp(c.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                    </tr>
                ))
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Omset Penjualan :</td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3" className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-emerald-700">B. RIWAYAT TERIMA PIUTANG (DARI PELANGGAN)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-right">NOMINAL MASUK</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {rekap?.listRiwayatPiutang?.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 italic text-slate-500">Tidak ada pembayaran piutang di periode ini.</td></tr>
            ) : (
                rekap.listRiwayatPiutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className="text-right font-black text-emerald-600">+{formatRp(p.amount)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-red-700">C. RIWAYAT BAYAR HUTANG (KE SUPPLIER)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>SUPPLIER</th><th className="text-center">BARANG</th><th className="text-right">NOMINAL KELUAR</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {rekap?.listRiwayatHutang?.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 italic text-slate-500">Tidak ada pembayaran hutang di periode ini.</td></tr>
            ) : (
                rekap.listRiwayatHutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className="text-right font-black text-red-600">-{formatRp(p.amount)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-slate-800">D. BUKU KAS (PENGELUARAN)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & REF</th><th>PENERIMA</th><th>KATEGORI & KETERANGAN</th><th className="text-center">VIA</th><th className="text-right">NOMINAL</th></tr>
          </thead>
          <tbody>
              {rekap?.listExpenses?.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-6 italic text-slate-500">Tidak ada pengeluaran kas di periode ini.</td></tr>
              ) : (
                  rekap.listExpenses.map((o, i) => (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td className="text-center">{formatDate(o.date)}<br/><span className="font-mono text-[9px] text-slate-500">{o.id}</span></td>
                          <td className="font-bold uppercase">{o.recipient || '-'}</td>
                          <td><div className="font-bold text-slate-800">{o.category}</div><div className="text-xs text-slate-600">{o.description}</div></td>
                          <td className="text-center text-xs">{o.paymentMethod}</td>
                          <td className="text-right font-bold text-red-600">-{formatRp(o.total)}</td>
                      </tr>
                  ))
              )}
              <tr>
                  <td colSpan="5" className="text-right font-bold uppercase bg-slate-50">Total Pengeluaran Kas :</td>
                  <td className="text-right font-black text-red-600 bg-slate-50">-{formatRp(totalPengeluaran)}</td>
              </tr>
          </tbody>
        </table>

        {/* TANDA TANGAN */}
        <div className="flex justify-between mt-20 pt-8 text-center text-sm">
            <div className="w-56"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Admin / Kasir )</p></div>
            <div className="w-56"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT LAPORAN CABANG PEMALANG (A4)
// ============================================================================
export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-8">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-2xl font-black uppercase mb-1">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold text-slate-700 mb-1">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-xs">CABANG: {user?.name} | Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        
        <h3 className="font-bold text-sm mb-3 text-slate-800">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr></thead>
          <tbody>
            {rekap?.listOrders?.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 italic text-slate-500">Tidak ada transaksi penjualan cabang.</td></tr>
            ) : (
                rekap.listOrders.map((c, i) => (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px] text-slate-500">{c.id}</span></td>
                        <td className="font-bold uppercase">{c.customer}</td>
                        <td className="text-right">{formatRp(c.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                    </tr>
                ))
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Omset Cabang :</td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3" className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-emerald-700">B. RIWAYAT TERIMA PIUTANG (AGEN CABANG)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-right">NOMINAL MASUK</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {rekap?.listRiwayatPiutang?.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 italic text-slate-500">Tidak ada pembayaran piutang di periode ini.</td></tr>
            ) : (
                rekap.listRiwayatPiutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className="text-right font-black text-emerald-600">+{formatRp(p.amount)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-slate-800">C. LAPORAN HARIAN & STOK</h3>
        <table className="table-print">
            <thead><tr><th className="w-8">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>
                {rekap?.listReports?.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-6 italic text-slate-500">Tidak ada laporan setoran.</td></tr>
                ) : (
                    rekap.listReports.map((p, i) => (
                        <tr key={i}>
                            <td className="text-center">{i + 1}</td>
                            <td className="text-center">{formatDate(p.date)}</td>
                            <td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td>
                            <td className="font-bold uppercase text-center">{p.stokFreezer}</td>
                            <td className="text-center font-bold text-indigo-700">{p.transferDestination || 'BCA (WASTAM)'}</td>
                            <td className="text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>

        <div className="flex justify-between mt-20 pt-8 text-center text-sm">
            <div className="w-56"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( {user?.name} )</p></div>
            <div className="w-56"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}
