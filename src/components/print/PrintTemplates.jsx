import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

const printStyle = `
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Helvetica', Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; margin: 0; }
    .hide-on-print { display: none !important; }
    .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
    .table-print th, .table-print td { border: 1px solid #000 !important; padding: 6px !important; text-align: left; }
    .table-print th { background-color: #f3f3f3 !important; text-align: center; font-weight: bold; }
    .logo-print { height: 50px; }
  }
`;

const dotMatrixStyle = `
  @media print {
    @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
  }
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 10px 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.3; }
  .box-solid { border: 1px solid black; padding: 8px 12px; border-radius: 4px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid black; }
  .table-pro th { border: 1px solid black; padding: 6px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; font-size: 11px; }
  .table-pro td { border: 1px solid black; padding: 6px; text-align: center; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
`;

export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const totalQtyNum = (data.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
  const totalPorsi = totalQtyNum / 4;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-red-700 transition">Kembali ke Aplikasi</button>
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16 object-contain" />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-[10px] font-medium leading-tight">Cipondoh, Tangerang | 087809020931</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1">INVOICE</h2>
            <p className="font-bold text-base">{data.id}</p>
          </div>
        </div>
        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid"><p className="text-[10px] font-bold uppercase mb-1">Tagihan Kepada :</p><p className="text-lg font-black uppercase">{data.customer}</p></div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Pembayaran</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div>
          </div>
        </div>
        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left">DESKRIPSI BARANG</th><th className="w-20">PORSI</th><th className="w-20">QTY</th><th className="w-32 text-right">HARGA SATUAN</th><th className="w-32 text-right">TOTAL</th></tr></thead>
          <tbody>
            <tr><td className="font-bold">1</td><td className="text-left font-bold uppercase">Dimsum Ayam Mix</td><td className="font-bold">{totalPorsi} Prs</td><td className="font-bold">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-black">{formatRp(data.totalAll)}</td></tr>
            <tr><td className="py-2 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr>
          </tbody>
        </table>
        <div className="flex justify-between items-start mt-2">
            <div className="flex-1 mr-6">
                <div className="border border-black p-2 rounded bg-white"><span className="text-[9px] font-bold uppercase block">Terbilang :</span><span className="font-bold italic text-xs"># {terbilang(data.totalAll)} Rupiah #</span></div>
                <div className="mt-2 text-[10px] font-bold"><p className="uppercase underline mb-0.5">Info Transfer :</p><p>BCA : 1320552261 a/n WASTAM</p><p>BRI : 775301006132536 a/n WASTAM</p></div>
            </div>
            <div className="w-64">
                <div className="flex justify-between mb-1 text-xs"><span className="font-bold uppercase">Subtotal</span><span className="font-black">{formatRp(data.totalAll)}</span></div>
                <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t border-black pt-1.5 mt-0.5"><span className="font-black text-sm uppercase">SISA TAGIHAN</span><span className="font-black text-sm">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span></div>
            </div>
        </div>
        <div className="flex justify-between mt-6 text-center text-xs">
          <div className="w-40"><p className="font-bold uppercase">Penerima / Pelanggan</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( {data.customer} )</p></div>
          <div className="w-40"><p className="font-bold uppercase">Hormat Kami,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Admin Kasir )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintVoucher({ data, onBack }) { /* Sama seperti dot matrix voucher */ return null; }
export function PrintPurchase({ data, onBack }) { return null; }
export function PrintReceipt({ data, onBack }) { return null; }

// ============================================================================
// 2. TEMPLATE LAPORAN (TITLE DIUBAH, DITAMBAH TOTAL BAWAH, & TABEL PIUTANG)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg border border-gray-300">
        
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="logo-print" />
            <div className="text-right">
                <h1 className="text-lg font-bold uppercase">LAPORAN KEUANGAN DIMSUM ADITYA TANGERANG</h1>
                <p className="text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        
        <div className="flex gap-4 mb-6">
            <div className="border p-4 flex-1"><strong>Total Saldo Akhir:</strong> {formatRp(rekap?.saldoAkhir)}</div>
            <div className="border p-4 flex-1"><strong>Total Penjualan:</strong> {formatRp(rekap?.totalPenjualanKotor)}</div>
            <div className="border p-4 flex-1"><strong>Piutang Baru:</strong> <span className="text-red-600">{formatRp(rekap?.totalPiutangBaru)}</span></div>
        </div>

        <h3 className="font-bold">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead><tr><th>NO</th><th>NO. INV</th><th>PELANGGAN</th><th>KATEGORI</th><th>VIA</th><th>QTY</th><th className="text-right">OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{c.id}</td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-center">{c.category}</td>
                    <td className="text-center">{c.paymentMethod}</td>
                    <td className="text-center">{(c?.items || []).join(', ')}</td>
                    <td className="text-right">{formatRp(c.total)}</td>
                </tr>
            ))}
            {/* TOTAL BAWAH TABEL */}
            <tr>
                <td colSpan="6" className="text-right font-bold uppercase">Total Omset Penjualan :</td>
                <td className="text-right font-black text-emerald-600">{formatRp(rekap?.totalPenjualanKotor)}</td>
            </tr>
          </tbody>
        </table>

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="mt-6 font-bold">B. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th>NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th>VIA</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>
                  {rekap.listExpenses.map((o, i) => (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td className="text-center">{formatDate(o.date)}</td>
                          <td className="font-bold uppercase">{o.category}</td>
                          <td>{o.description}</td>
                          <td className="text-center">{o.paymentMethod}</td>
                          <td className="text-right">{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td>
                      </tr>
                  ))}
                  {/* TOTAL BAWAH TABEL */}
                  <tr>
                      <td colSpan="5" className="text-right font-bold uppercase">Total Pengeluaran Kas :</td>
                      <td className="text-right font-black text-red-600">-{formatRp(totalPengeluaran)}</td>
                  </tr>
              </tbody>
            </table>
          </>
        )}

        {rekap?.listPiutangBerjalan?.length > 0 && (
          <>
            <h3 className="mt-6 font-bold text-red-600">C. DAFTAR PIUTANG BERJALAN (SEMUA PELANGGAN BELUM LUNAS)</h3>
            <table className="table-print">
              <thead><tr><th>NO</th><th>TGL & INV</th><th>PELANGGAN</th><th>QTY (PCS/PORSI)</th><th className="text-right">TAGIHAN</th><th className="text-right">DIBAYAR</th><th className="text-right">SISA</th></tr></thead>
              <tbody>
                {rekap.listPiutangBerjalan.map((o, i) => {
                   const totalQtyNum = (o.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                   return (
                     <tr key={i}>
                       <td className="text-center">{i + 1}</td>
                       <td>{formatDate(o.date)}<br/><span className="font-mono text-[9px]">{o.id}</span></td>
                       <td className="font-bold uppercase">{o.customer}</td>
                       <td className="text-center">{totalQtyNum} Pcs / {totalQtyNum/4} Prs</td>
                       <td className="text-right">{formatRp(o.totalTagihan)}</td>
                       <td className="text-right text-emerald-600">{formatRp((Number(o.paidAmount)||0) + (Number(o.cicilanTerbayar)||0))}</td>
                       <td className="text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                     </tr>
                   )
                })}
              </tbody>
            </table>
          </>
        )}

        {rekap?.listHutangBerjalan?.length > 0 && (
          <>
            <h3 className="mt-6 font-bold text-orange-600">D. DAFTAR HUTANG SUPPLIER (BELUM LUNAS)</h3>
            <table className="table-print">
              <thead><tr><th>NO</th><th>TGL & INV</th><th>SUPPLIER</th><th>BARANG</th><th className="text-right">TAGIHAN</th><th className="text-right">DIBAYAR</th><th className="text-right">SISA</th></tr></thead>
              <tbody>
                {rekap.listHutangBerjalan.map((o, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{formatDate(o.date)}<br/><span className="font-mono text-[9px]">{o.id}</span></td>
                    <td className="font-bold uppercase">{o.supplier}</td>
                    <td className="text-center">{(o.items || []).join(', ')}</td>
                    <td className="text-right">{formatRp(o.totalTagihan)}</td>
                    <td className="text-right text-emerald-600">{formatRp((Number(o.paidAmount)||0) + (Number(o.cicilanTerbayar)||0))}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

      </div>
    </div>
  );
}

export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg border border-gray-300">
        <div className="header flex items-center justify-between border-b-2 border-black pb-4 mb-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="logo-print" />
            <div className="text-right">
                <h1 className="text-lg font-bold uppercase">LAPORAN KEUANGAN DIMSUM ADITYA TANGERANG</h1>
                <p className="text-xs font-bold uppercase">CABANG: {user?.name}</p>
                <p className="text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        <div className="flex gap-4 mb-6">
            <div className="border p-4 flex-1"><strong>Total Penjualan Kotor:</strong> {formatRp(rekap?.totalPenjualanKotor)}</div>
            <div className="border p-4 flex-1"><strong>Porsi Terjual:</strong> {rekap?.totalPorsi} Prs</div>
            <div className="border p-4 flex-1"><strong>Total Setoran Pusat:</strong> <span className="text-blue-600">{formatRp(rekap?.setoranKePusat)}</span></div>
        </div>
        <h3 className="font-bold">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th>NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>
            {(rekap?.listOrders || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[10px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td className="text-center">{c.paymentMethod}</td><td className="text-center">{(c?.items||[]).join(', ')}</td><td className="text-right">{formatRp(c.total)}</td></tr>))}
            <tr><td colSpan="5" className="text-right font-bold uppercase">Total Omset Cabang :</td><td className="text-right font-black text-emerald-600">{formatRp(rekap?.totalPenjualanKotor)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
