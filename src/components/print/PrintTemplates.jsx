import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. TEMPLATE INVOICE & VOUCHER (DOT-MATRIX OPTIMIZED)
// ============================================================================
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
          <thead><tr><th>NO</th><th className="text-left">DESKRIPSI BARANG</th><th>PORSI</th><th>QTY</th><th className="text-right">HARGA</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>
            <tr><td className="font-bold">1</td><td className="text-left font-bold uppercase">Dimsum Ayam Mix</td><td className="font-bold">{totalPorsi} Prs</td><td className="font-bold">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-black">{formatRp(data.totalAll)}</td></tr>
            <tr><td className="py-2"></td><td></td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>
        <div className="flex justify-between items-start mt-2">
            <div className="flex-1 mr-6">
                <div className="border border-black p-2 rounded"><span className="text-[9px] font-bold uppercase block">Terbilang :</span><span className="font-bold italic text-xs"># {terbilang(data.totalAll)} Rupiah #</span></div>
                <div className="mt-2 text-[10px] font-bold"><p className="uppercase underline mb-0.5">Info Transfer :</p><p>BCA : 1320552261 | BRI : 775301006132536 (WASTAM)</p></div>
            </div>
            <div className="w-64">
                <div className="flex justify-between mb-1 text-xs"><span className="font-bold uppercase">Subtotal</span><span className="font-black">{formatRp(data.totalAll)}</span></div>
                <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t border-black pt-1.5 mt-0.5"><span className="font-black text-sm uppercase">SISA TAGIHAN</span><span className="font-black text-sm">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span></div>
            </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. TEMPLATE LAPORAN (FIXED TABEL & LOGO)
// ============================================================================
const a4Style = `
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif; font-size: 11px; color: black; background: white; } 
    .hide-on-print { display: none !important; } 
    table { width: 100%; border-collapse: collapse; margin-top: 10px; } 
    th, td { padding: 8px !important; border: 1px solid #000 !important; text-align: left; } 
    th { background-color: #eee !important; font-weight: bold; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
  }
`;

export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      <div className="p-8 bg-white max-w-[210mm] mx-auto shadow-lg">
        <div className="header flex items-center justify-between">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16" />
            <div>
                <h1 className="text-xl font-bold">LAPORAN KEUANGAN PUSAT</h1>
                <p>Periode: {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            </div>
        </div>
        <h3>RINGKASAN</h3>
        <div className="flex gap-4 mb-4">
            <div className="border p-4 flex-1"><strong>Total Saldo:</strong> {formatRp(rekap?.saldoAkhir)}</div>
            <div className="border p-4 flex-1"><strong>Total Penjualan:</strong> {formatRp(rekap?.totalPenjualanKotor)}</div>
        </div>
        <h3>A. TRANSAKSI PENJUALAN</h3>
        <table>
          <thead><tr><th>NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>OMSET</th></tr></thead>
          <tbody>{(rekap?.listTransaksiDetail || []).map((c, i) => (<tr key={i}><td>{i + 1}</td><td>{c.id}</td><td>{c.customer}</td><td>{c.paymentMethod}</td><td>{formatRp(c.total)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

// (Tinggal copy fungsi lainnya seperti PrintPurchase, PrintVoucher, dsb ke sini jika perlu)
