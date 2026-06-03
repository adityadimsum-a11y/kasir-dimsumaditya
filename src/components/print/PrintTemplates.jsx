import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';
import { getLocalYMD } from '../../utils/helpers'; // Diperlukan untuk cek (Baru)

const dotMatrixStyle = `
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.4; }
  .clean-header-block { border-top: 2px solid black; border-bottom: 2px solid black; padding: 10px 0; margin-bottom: 15px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .table-pro th { border-top: 1px solid black; border-bottom: 1px solid black; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 11px; }
  .table-pro td { padding: 6px 4px; text-align: center; border-bottom: 1px dashed #ccc; }
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
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 20px; color: black; font-family: Arial, sans-serif; font-size: 11px; }
  .table-print { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 15px; }
  .table-print th, .table-print td { border: 1px solid #aaa !important; padding: 4px 6px !important; text-align: left; vertical-align: middle; font-size: 10px; }
  .table-print th { background-color: #f8f9fa !important; text-align: center; font-weight: bold; text-transform: uppercase; color: #333; }
  @media print { 
    @page { size: A4 portrait; margin: 8mm; } 
    body { font-family: Arial, sans-serif !important; font-size: 10px !important; color: black; background: white; -webkit-print-color-adjust: exact; margin: 0; } 
    .hide-on-print { display: none !important; } 
    .a4-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

export function PrintInvoiceDotMatrix({ data, onBack }) { /* Tdk berubah dari sebelumnya */ return null; }
export function PrintReceipt({ data, onBack }) { /* Tdk berubah dari sebelumnya */ return null; }
export function PrintVoucher({ data, onBack }) { /* Tdk berubah dari sebelumnya */ return null; }
export function PrintPurchase({ data, onBack }) { /* Tdk berubah dari sebelumnya */ return null; }

// ============================================================================
// KOMPONEN PRINT LAPORAN REKAP PUSAT (A4)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);
  const sumTerbayar = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (c.totalTerbayar||0), 0);
  const sumSisa = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (c.sisaTagihan||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-5">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-[10px]">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Total Omset Penjualan</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Terjual: <strong>{rekap?.totalPcs} Pcs</strong> ({rekap?.totalPorsi} Prs)</p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Total Kas Masuk</p>
                <div className="flex justify-between text-[9px]"><span>Cash:</span><span className="font-bold">{formatRp(rekap?.inCashPeriode)}</span></div>
                <div className="flex justify-between text-[9px]"><span>Transfer:</span><span className="font-bold">{formatRp(rekap?.inTfPeriode)}</span></div>
                <div className="flex justify-between text-[10px] border-t border-emerald-200 pt-0.5 mt-0.5 font-black text-emerald-800"><span>TOTAL:</span><span>{formatRp((rekap?.inCashPeriode||0) + (rekap?.inTfPeriode||0))}</span></div>
            </div>
            <div className="border border-red-200 p-2 rounded bg-red-50">
                <p className="text-[9px] font-bold text-red-700 uppercase mb-0.5">Total Kas Keluar</p>
                <div className="flex justify-between text-[9px]"><span>Cash:</span><span className="font-bold">{formatRp(rekap?.outCashPeriode)}</span></div>
                <div className="flex justify-between text-[9px]"><span>Transfer:</span><span className="font-bold">{formatRp(rekap?.outTfPeriode)}</span></div>
                <div className="flex justify-between text-[10px] border-t border-red-200 pt-0.5 mt-0.5 font-black text-red-800"><span>TOTAL:</span><span>{formatRp((rekap?.outCashPeriode||0) + (rekap?.outTfPeriode||0))}</span></div>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Tagihan Gantung (Sisa)</p>
                <div className="flex justify-between text-[9px]"><span>Piutang Agen:</span><span className="font-bold">{formatRp(rekap?.totalPiutangBaru)}</span></div>
                <div className="flex justify-between text-[9px]"><span>Hutang Supplier:</span><span className="font-bold">{formatRp(rekap?.totalHutangBaru)}</span></div>
            </div>
        </div>

        <h3 className="font-bold text-xs mb-1.5 text-slate-800">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi di periode ini.</td></tr>
            ) : (
                rekap.listTransaksiDetail.map((c, i) => {
                    const itemPcs = c.items.reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c.id}</span></td>
                        <td className="font-bold uppercase">{c.customer}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c.paymentMethod}</td>
                        <td className="text-right font-medium">{formatRp(c.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                    </tr>
                )})
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Penjualan :</td>
                <td className="text-center font-bold text-slate-700 bg-slate-50 text-[9px]">{rekap?.totalPcs} Pcs / {rekap?.totalPorsi} Prs</td>
                <td className="bg-slate-50"></td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td className="text-right font-black text-emerald-600 bg-slate-50">{formatRp(sumTerbayar)}</td>
                <td className="text-right font-black text-red-600 bg-slate-50">{formatRp(sumSisa)}</td>
                <td className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        {/* TABEL B: PIUTANG BERJALAN (SELALU TAMPIL) */}
        <h3 className="font-bold text-xs mb-1.5 mt-5 text-orange-700">B. DAFTAR PIUTANG BERJALAN (BELUM LUNAS)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-right">TOTAL TAGIHAN</th><th className="text-right">TERBAYAR (DP+CICILAN)</th><th className="text-right">SISA PIUTANG</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listPiutangBerjalan || rekap.listPiutangBerjalan.length === 0) ? (
                <tr><td colSpan="7" className="text-center py-4 italic text-slate-500">Tidak ada piutang berjalan.</td></tr>
            ) : (
                rekap.listPiutangBerjalan.map((p, i) => {
                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                  return (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{formatDate(p.date)}<br/><span className="font-mono text-[8px] text-slate-500">{p.id}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-right">{formatRp(p.totalTagihan)}</td>
                    <td className="text-right text-emerald-600">{formatRp(p.totalDibayar + p.cicilanTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(p.sisaHutang)}</td>
                    <td className="text-center font-bold text-[9px] text-red-600">
                        BELUM LUNAS
                        {isNew && <div className="text-orange-600 mt-0.5">(PIUTANG BARU)</div>}
                    </td>
                  </tr>
                )})
            )}
          </tbody>
        </table>

        {/* TABEL C: HUTANG BERJALAN (SELALU TAMPIL) */}
        <h3 className="font-bold text-xs mb-1.5 mt-5 text-red-700">C. DAFTAR HUTANG BERJALAN (BELUM LUNAS)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>SUPPLIER</th><th className="text-right">TOTAL TAGIHAN</th><th className="text-right">TERBAYAR (DP+CICILAN)</th><th className="text-right">SISA HUTANG</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listHutangBerjalan || rekap.listHutangBerjalan.length === 0) ? (
                <tr><td colSpan="7" className="text-center py-4 italic text-slate-500">Tidak ada hutang berjalan.</td></tr>
            ) : (
                rekap.listHutangBerjalan.map((p, i) => {
                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                  return (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{formatDate(p.date)}<br/><span className="font-mono text-[8px] text-slate-500">{p.id}</span></td>
                    <td className="font-bold uppercase">{p.supplier}</td>
                    <td className="text-right">{formatRp(p.totalTagihan)}</td>
                    <td className="text-right text-emerald-600">{formatRp(p.totalDibayar + p.cicilanTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(p.sisaHutang)}</td>
                    <td className="text-center font-bold text-[9px] text-red-600">
                        BELUM LUNAS
                        {isNew && <div className="text-red-600 mt-0.5">(HUTANG BARU)</div>}
                    </td>
                  </tr>
                )})
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-emerald-700">D. RIWAYAT TERIMA PIUTANG (DARI PELANGGAN)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">NOMINAL MASUK</th><th className="text-right">SISA TAGIHAN</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listRiwayatPiutang || rekap.listRiwayatPiutang.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada riwayat pembayaran piutang.</td></tr>
            ) : (
                rekap.listRiwayatPiutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td><span className="font-bold text-blue-700">{formatDate(p.date)}</span><br/><span className="font-mono text-[8px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td>{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[8px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-[9px]">{p.qtyDesc}</td>
                    <td className="text-center text-[9px]">{p.paymentMethod}</td>
                    <td className="text-right font-black text-emerald-600">+{formatRp(p.amount)}</td>
                    <td className={`text-right font-bold ${p.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.sisaTagihan <= 0 ? 'Rp 0' : formatRp(p.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[9px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-red-700">E. RIWAYAT BAYAR HUTANG (KE SUPPLIER)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>SUPPLIER</th><th className="text-center">VIA</th><th className="text-right">NOMINAL KELUAR</th><th className="text-right">SISA HUTANG</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listRiwayatHutang || rekap.listRiwayatHutang.length === 0) ? (
                <tr><td colSpan="8" className="text-center py-4 italic text-slate-500">Tidak ada riwayat pembayaran hutang.</td></tr>
            ) : (
                rekap.listRiwayatHutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td><span className="font-bold text-blue-700">{formatDate(p.date)}</span><br/><span className="font-mono text-[8px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td>{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[8px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-[9px]">{p.paymentMethod}</td>
                    <td className="text-right font-black text-red-600">-{formatRp(p.amount)}</td>
                    <td className={`text-right font-bold ${p.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.sisaTagihan <= 0 ? 'Rp 0' : formatRp(p.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[9px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-slate-800">F. BUKU KAS (PENGELUARAN)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & REF</th><th>PENERIMA</th><th>KATEGORI & KETERANGAN</th><th className="text-center">VIA</th><th className="text-right">NOMINAL</th></tr>
          </thead>
          <tbody>
              {(!rekap?.listExpenses || rekap.listExpenses.length === 0) ? (
                  <tr><td colSpan="6" className="text-center py-4 italic text-slate-500">Tidak ada pengeluaran kas di periode ini.</td></tr>
              ) : (
                  rekap.listExpenses.map((o, i) => (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td>{formatDate(o.date)}<br/><span className="font-mono text-[8px] text-slate-500">{o.id}</span></td>
                          <td className="font-bold uppercase">{o.recipient || '-'}</td>
                          <td><div className="font-bold text-slate-800">{o.category}</div><div>{o.description}</div></td>
                          <td className="text-center text-[9px]">{o.paymentMethod}</td>
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

        <div className="flex justify-between mt-12 text-center text-xs">
            <div className="w-48"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Admin / Kasir )</p></div>
            <div className="w-48"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
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
  const sumTerbayarBranch = (rekap?.listOrders || []).reduce((s, c) => s + (c.totalTerbayar||0), 0);
  const sumSisaBranch = (rekap?.listOrders || []).reduce((s, c) => s + (c.sisaTagihan||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-5">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-[10px]">CABANG: {user?.name} | Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Total Omset Cabang</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Terjual: <strong>{rekap?.totalPcs} Pcs</strong> ({rekap?.totalPorsi} Prs)</p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Total Kas Disetor</p>
                <p className="text-sm font-black text-emerald-700">{formatRp(rekap?.setoranKePusat)}</p>
                <p className="text-[9px] text-emerald-600 mt-0.5">Ke Rekening Pusat</p>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Piutang Gantung</p>
                <p className="text-sm font-black text-orange-700">{formatRp(rekap?.totalPiutangBaru)}</p>
                <p className="text-[9px] text-orange-600 mt-0.5">Belum Lunas (Agen)</p>
            </div>
        </div>
        
        <h3 className="font-bold text-xs mb-1.5 text-slate-800">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr></thead>
          <tbody>
            {(!rekap?.listOrders || rekap.listOrders.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi penjualan cabang.</td></tr>
            ) : (
                rekap.listOrders.map((c, i) => {
                    const itemPcs = c.items.reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c.id}</span></td>
                        <td className="font-bold uppercase">{c.customer}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c.paymentMethod}</td>
                        <td className="text-right">{formatRp(c.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                    </tr>
                )})
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Penjualan :</td>
                <td className="text-center font-bold text-slate-700 bg-slate-50 text-[9px]">{rekap?.totalPcs} Pcs / {rekap?.totalPorsi} Prs</td>
                <td className="bg-slate-50"></td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td className="text-right font-black text-emerald-600 bg-slate-50">{formatRp(sumTerbayarBranch)}</td>
                <td className="text-right font-black text-red-600 bg-slate-50">{formatRp(sumSisaBranch)}</td>
                <td className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        {/* TABEL B: PIUTANG BERJALAN CABANG */}
        <h3 className="font-bold text-xs mb-1.5 mt-5 text-orange-700">B. DAFTAR PIUTANG BERJALAN (BELUM LUNAS)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-right">TOTAL TAGIHAN</th><th className="text-right">TERBAYAR (DP+CICILAN)</th><th className="text-right">SISA PIUTANG</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listPiutangBerjalan || rekap.listPiutangBerjalan.length === 0) ? (
                <tr><td colSpan="7" className="text-center py-4 italic text-slate-500">Tidak ada piutang berjalan.</td></tr>
            ) : (
                rekap.listPiutangBerjalan.map((p, i) => {
                  const isNew = getLocalYMD(p.date) >= dateFrom && getLocalYMD(p.date) <= dateTo;
                  return (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{formatDate(p.date)}<br/><span className="font-mono text-[8px] text-slate-500">{p.id}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-right">{formatRp(p.totalTagihan)}</td>
                    <td className="text-right text-emerald-600">{formatRp(p.paid + p.cicilanTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(p.sisaHutang)}</td>
                    <td className="text-center font-bold text-[9px] text-red-600">
                        BELUM LUNAS
                        {isNew && <div className="text-orange-600 mt-0.5">(PIUTANG BARU)</div>}
                    </td>
                  </tr>
                )})
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-emerald-700">C. RIWAYAT TERIMA PIUTANG (AGEN CABANG)</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">NOMINAL MASUK</th><th className="text-right">SISA TAGIHAN</th><th className="text-center">STATUS NOTA</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listRiwayatPiutang || rekap.listRiwayatPiutang.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada riwayat pembayaran piutang.</td></tr>
            ) : (
                rekap.listRiwayatPiutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td><span className="font-bold text-blue-700">{formatDate(p.date)}</span><br/><span className="font-mono text-[8px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td>{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[8px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-[9px]">{p.qtyDesc}</td>
                    <td className="text-center text-[9px]">{p.paymentMethod}</td>
                    <td className="text-right font-black text-emerald-600">+{formatRp(p.amount)}</td>
                    <td className={`text-right font-bold ${p.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.sisaTagihan <= 0 ? 'Rp 0' : formatRp(p.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[9px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-slate-800">D. LAPORAN HARIAN & STOK</h3>
        <table className="table-print">
            <thead><tr><th className="w-8">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>
                {(!rekap?.listReports || rekap.listReports.length === 0) ? (
                    <tr><td colSpan="6" className="text-center py-4 italic text-slate-500">Tidak ada laporan setoran.</td></tr>
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

        <div className="flex justify-between mt-12 text-center text-xs">
            <div className="w-48"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( {user?.name} )</p></div>
            <div className="w-48"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}
