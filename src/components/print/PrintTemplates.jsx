import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

const dotMatrixStyle = `
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.3; }
  .box-solid { border: 1px solid black; padding: 8px 12px; border-radius: 4px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid black; }
  .table-pro th { border: 1px solid black; padding: 6px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; font-size: 11px; }
  .table-pro td { border: 1px solid black; padding: 6px; text-align: center; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
  @media print {
    @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
    .print-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

const a4Style = `
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 30px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
  .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid black; }
  .table-print th, .table-print td { border: 1px solid black !important; padding: 6px 8px !important; text-align: left; vertical-align: middle; }
  .table-print th { background-color: #f3f4f6 !important; text-align: center; font-weight: bold; text-transform: uppercase; }
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif !important; font-size: 11px !important; color: black; background: white; -webkit-print-color-adjust: exact; margin: 0; } 
    .hide-on-print { display: none !important; } 
    .a4-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

// ============================================================================
// KOMPONEN PRINT INVOICE, TANDA TERIMA, VOUCHER, DAN PEMBELIAN BAHAN (DOT MATRIX)
// ============================================================================
export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const totalQtyNum = (data.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
  const totalPorsi = totalQtyNum / 4;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} /><div><h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1><p className="text-[10px] font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p><p className="text-[10px] font-medium leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p><p className="text-[10px] font-medium leading-tight mt-0.5">Telp: 087809020931 | Web: dimsumaditya.id</p></div></div>
          <div className="text-right"><h2 className="text-3xl font-black tracking-widest uppercase mb-1">INVOICE</h2><p className="font-bold text-base">{data.id}</p></div>
        </div>
        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid"><p className="text-[10px] font-bold uppercase mb-1">Tagihan Kepada :</p><p className="text-lg font-black uppercase">{data.customer}</p></div>
          <div className="w-1/3 box-solid flex flex-col justify-center"><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div><div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Pembayaran</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div></div>
        </div>
        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left">DESKRIPSI BARANG</th><th className="w-20">PORSI</th><th className="w-20">QTY</th><th className="w-32 text-right">HARGA SATUAN</th><th className="w-32 text-right">TOTAL</th></tr></thead>
          <tbody>
            <tr><td className="font-bold">1</td><td className="text-left font-bold uppercase">Dimsum Ayam Mix</td><td className="font-bold">{totalPorsi} Prs</td><td className="font-bold">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-black">{formatRp(data.totalAll)}</td></tr>
            <tr><td className="py-2 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr>
          </tbody>
        </table>
        <div className="flex justify-between items-start mt-2">
            <div className="flex-1 mr-6"><div className="border border-black p-2 rounded bg-white"><span className="text-[9px] font-bold uppercase block">Terbilang :</span><span className="font-bold italic text-xs"># {terbilang(data.totalAll)} Rupiah #</span></div><div className="mt-2 text-xs font-bold"><p className="uppercase underline mb-0.5">Info Transfer :</p><p>BCA : 1320552261 a/n WASTAM</p><p>BRI : 775301006132536 a/n WASTAM</p></div></div>
            <div className="w-64"><div className="flex justify-between mb-1 text-xs"><span className="font-bold uppercase">Subtotal</span><span className="font-black">{formatRp(data.totalAll)}</span></div><div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div><div className="flex justify-between border-t border-b border-black py-1 mt-1"><span className="font-black text-sm uppercase">SISA TAGIHAN</span><span className="font-black text-sm">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span></div></div>
        </div>
        <div className="flex justify-between mt-6 text-center text-xs"><div className="w-40"><p className="font-bold uppercase">Penerima / Pelanggan</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( {data.customer} )</p></div><div className="w-40"><p className="font-bold uppercase">Hormat Kami,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Admin Kasir )</p></div></div>
      </div>
    </div>
  );
}

export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { payment, order } = data;
  const totalDibayar = (Number(order?.totalDibayar) || Number(order?.paidAmount) || 0) + (Number(order?.cicilanTerbayar) || 0);
  const sisaHutang = Number(order?.sisaHutang) || 0;
  const totalTagihan = Number(order?.totalTagihan) || Number(order?.totalAll) || (totalDibayar + sisaHutang);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-blue-700 transition">Kembali ke Aplikasi</button>
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} /><div><h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1><p className="text-[10px] font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p></div></div>
          <div className="text-right"><h2 className="text-2xl font-black tracking-widest uppercase mb-1">TANDA TERIMA</h2><p className="font-bold text-sm">{order?.tipe === 'HUTANG' ? 'PEMBAYARAN' : 'CICILAN'}</p></div>
        </div>
        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid"><div className="flex mb-1.5"><span className="w-36 font-bold uppercase text-[10px]">{order?.tipe === 'HUTANG' ? 'Dibayarkan Kepada' : 'Diterima Dari'}</span><span className="font-black uppercase text-sm">: {order?.customer || order?.supplier}</span></div><div className="flex mb-1.5"><span className="w-36 font-bold uppercase text-[10px]">Uang Sejumlah</span><span className="font-black text-base">: {formatRp(payment?.amount)}</span></div><div className="flex"><span className="w-36 font-bold uppercase text-[10px]">Terbilang</span><span className="font-bold italic text-[10px]">: # {terbilang(payment?.amount)} Rupiah #</span></div></div>
          <div className="w-1/3 box-solid flex flex-col justify-center"><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">No. Referensi</span> <span className="font-bold text-[10px]">{payment?.id}</span></div><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(payment?.date)}</span></div><div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Metode</span> <span className="font-bold uppercase text-[10px]">{payment?.paymentMethod}</span></div></div>
        </div>
        <div className="box-solid mt-4">
            <p className="text-[10px] font-bold uppercase mb-2">Keterangan Pembayaran :</p><p className="text-xs mb-2">Pembayaran untuk Invoice Referensi: <strong className="font-mono">{order?.id}</strong></p>
            <table className="table-pro mt-2">
                <thead><tr><th className="text-center">TOTAL TAGIHAN INV</th><th className="text-center">TOTAL TERBAYAR</th><th className="text-center bg-gray-100">SISA TAGIHAN</th><th className="text-center">STATUS</th></tr></thead>
                <tbody><tr><td className="font-bold text-center">{formatRp(totalTagihan)}</td><td className="font-bold text-emerald-600 text-center">{formatRp(totalDibayar)}</td><td className="font-black text-red-600 text-center bg-gray-100">{formatRp(sisaHutang)}</td><td className="font-black text-center">{sisaHutang <= 0 ? 'LUNAS' : 'BELUM LUNAS'}</td></tr></tbody>
            </table>
        </div>
        <div className="flex justify-between mt-12 text-center text-xs"><div className="w-40"><p className="font-bold uppercase">Penerima</p><div className="h-16"></div><p className="border-t border-black pt-1 uppercase">( {order?.customer || order?.supplier} )</p></div><div className="w-40"><p className="font-bold uppercase">Admin / Kasir</p><div className="h-16"></div><p className="border-t border-black pt-1 uppercase">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

export function PrintVoucher({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} /><h1 className="font-black text-xl tracking-wide uppercase">Dimsum Aditya</h1></div>
          <div className="text-right"><h2 className="text-2xl font-black tracking-widest uppercase mb-1">VOUCHER KAS</h2><p className="font-bold text-base">KAS KELUAR</p></div>
        </div>
        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid"><div className="flex mb-1.5"><span className="w-32 font-bold uppercase text-[10px]">Dibayarkan Kpd</span><span className="font-black uppercase text-sm">: {data.recipient}</span></div><div className="flex mb-1.5"><span className="w-32 font-bold uppercase text-[10px]">Terbilang</span><span className="font-bold italic text-[10px]">: # {terbilang(data.total)} Rupiah #</span></div><div className="flex"><span className="w-32 font-bold uppercase text-[10px]">Uang Sejumlah</span><span className="font-black text-base">: {formatRp(data.total)}</span></div></div>
          <div className="w-1/3 box-solid flex flex-col justify-center"><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">No. Ref</span> <span className="font-bold text-[10px]">{data.id}</span></div><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div><div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Metode</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div></div>
        </div>
        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left w-48">KATEGORI</th><th className="text-left">KETERANGAN / RINCIAN</th><th className="w-32 text-right">TOTAL</th></tr></thead>
          <tbody><tr><td className="font-bold">1</td><td className="text-left font-bold uppercase">{data.category}</td><td className="text-left">{data.description} (Qty: {data.qty})</td><td className="text-right font-black">{formatRp(data.total)}</td></tr><tr><td className="py-4 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr></tbody>
        </table>
        <div className="flex justify-between mt-8 text-center text-[10px]"><div className="w-32"><p className="font-bold uppercase">Dibuat Oleh,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Admin / Kasir )</p></div><div className="w-32"><p className="font-bold uppercase">Disetujui Oleh,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Manajemen )</p></div><div className="w-32"><p className="font-bold uppercase">Penerima,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( {data.recipient} )</p></div></div>
      </div>
    </div>
  );
}

export function PrintPurchase({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} /><h1 className="font-black text-xl tracking-wide uppercase">Dimsum Aditya</h1></div>
          <div className="text-right"><h2 className="text-2xl font-black tracking-widest uppercase mb-1">BUKTI PEMBELIAN</h2><p className="font-bold text-sm">RESTOCK BAHAN</p></div>
        </div>
        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid"><div className="flex mb-1.5"><span className="w-24 font-bold uppercase text-[10px]">Supplier</span><span className="font-black uppercase text-sm">: {data.supplier}</span></div><div className="flex mb-1.5"><span className="w-24 font-bold uppercase text-[10px]">Tanggal</span><span className="font-bold text-[10px]">: {formatDate(data.date)}</span></div></div>
          <div className="w-1/3 box-solid flex flex-col justify-center"><div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">No. Ref</span> <span className="font-bold text-[10px]">{data.id}</span></div><div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Metode</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div></div>
        </div>
        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left">BARANG & SATUAN</th></tr></thead>
          <tbody>{(data.items || []).map((item, idx) => (<tr key={idx}><td>{idx + 1}</td><td className="text-left font-bold">{item}</td></tr>))}<tr><td className="py-2 border-b-0"></td><td className="border-b-0"></td></tr></tbody>
        </table>
        <div className="flex justify-end mt-2 text-xs">
          <div className="w-64 box-solid">
            <div className="flex justify-between font-bold mb-1.5"><span>TOTAL BELANJA</span><span className="text-sm">{formatRp(data.totalAll)}</span></div>
            <div className="flex justify-between font-bold border-t border-black pt-1.5"><span>DIBAYAR</span><span>{formatRp(data.paidAmount)}</span></div>
          </div>
        </div>
        <div className="mt-6 flex justify-end text-center text-xs"><div className="w-40"><p className="font-bold uppercase">Admin Pembelian,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

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
      <div className="a4-wrapper shadow-xl border border-gray-200 relative pb-32">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-1">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold mb-1">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-700 font-medium text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <h3 className="font-bold text-sm mb-2">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead>
            <tr>
                <th className="w-8">NO</th>
                <th>TGL & INV</th>
                <th>PELANGGAN</th>
                <th className="text-right">TAGIHAN</th>
                <th className="text-right">TERBAYAR</th>
                <th className="text-right">SISA</th>
                <th className="text-center">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px]">{c.id}</span></td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-right font-medium">{formatRp(c.totalTagihan)}</td>
                    <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase">Total Omset Penjualan :</td>
                <td className="text-right font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3"></td>
            </tr>
          </tbody>
        </table>

        {rekap?.listRiwayatPiutang?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6 text-emerald-700">B. RIWAYAT TERIMA PIUTANG (PELANGGAN)</h3>
            <table className="table-print">
              <thead>
                <tr>
                    <th className="w-8">NO</th>
                    <th>TGL & ID BAYAR</th>
                    <th>TGL & INV ASAL</th>
                    <th>PELANGGAN</th>
                    <th className="text-center">QTY</th>
                    <th className="text-right">NOMINAL MASUK</th>
                    <th className="text-center">STATUS NOTA</th>
                </tr>
              </thead>
              <tbody>
                {rekap.listRiwayatPiutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className="text-right font-black text-emerald-600">+{formatRp(p.amount)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rekap?.listRiwayatHutang?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6 text-red-700">C. RIWAYAT BAYAR HUTANG (SUPPLIER)</h3>
            <table className="table-print">
              <thead>
                <tr>
                    <th className="w-8">NO</th>
                    <th>TGL & ID BAYAR</th>
                    <th>TGL & INV ASAL</th>
                    <th>SUPPLIER</th>
                    <th className="text-center">QTY</th>
                    <th className="text-right">NOMINAL KELUAR</th>
                    <th className="text-center">STATUS NOTA</th>
                </tr>
              </thead>
              <tbody>
                {rekap.listRiwayatHutang.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className="text-right font-black text-red-600">-{formatRp(p.amount)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6">D. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="text-center">{formatDate(o.date)}</td><td className="font-bold uppercase">{o.category}</td><td>{o.description}</td><td className="text-right">-{formatRp(o.total)}</td></tr>))}<tr><td colSpan="4" className="text-right font-bold uppercase">Total Pengeluaran Kas :</td><td className="text-right font-black text-red-600">-{formatRp(totalPengeluaran)}</td></tr></tbody>
            </table>
          </>
        )}

        {/* BAGIAN TANDA TANGAN (POSISI DI BAWAH) */}
        <div className="flex justify-between mt-12 text-center text-sm absolute bottom-8 left-8 right-8">
            <div className="w-48"><p>Dibuat Oleh,</p><div className="h-20"></div><p className="border-t border-black pt-1 uppercase font-bold">( Admin / Kasir )</p></div>
            <div className="w-48"><p>Mengetahui / Menyetujui,</p><div className="h-20"></div><p className="border-t border-black pt-1 uppercase font-bold">( Pimpinan )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-xl border border-gray-200 relative pb-32">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-1">LAPORAN REKAPITULASI TRANSAKSI</h1>
                <h2 className="font-bold mb-1">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-700 font-medium text-xs">CABANG: {user?.name} | Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        
        <h3 className="font-bold text-sm mb-2">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr></thead>
          <tbody>
            {(rekap?.listOrders || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px]">{c.id}</span></td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-right">{formatRp(c.totalTagihan)}</td>
                    <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase">Total Omset Cabang :</td>
                <td className="text-right font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-2 mt-6">B. LAPORAN HARIAN & STOK</h3>
        <table className="table-print">
            <thead><tr><th className="w-8">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>
                {(rekap?.listReports || []).map((p, i) => (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="text-center">{formatDate(p.date)}</td>
                        <td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td>
                        <td className="font-bold uppercase text-center">{p.stokFreezer}</td>
                        <td className="text-center font-bold text-indigo-700">{p.transferDestination || 'BCA (WASTAM)'}</td>
                        <td className="text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* BAGIAN TANDA TANGAN (POSISI DI BAWAH) */}
        <div className="flex justify-between mt-12 text-center text-sm absolute bottom-8 left-8 right-8">
            <div className="w-48"><p>Dibuat Oleh,</p><div className="h-20"></div><p className="border-t border-black pt-1 uppercase font-bold">( {user?.name} )</p></div>
            <div className="w-48"><p>Mengetahui / Menyetujui,</p><div className="h-20"></div><p className="border-t border-black pt-1 uppercase font-bold">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}
