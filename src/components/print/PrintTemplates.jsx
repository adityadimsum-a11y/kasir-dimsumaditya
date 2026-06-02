import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. CSS DOT MATRIX (CLEAN MINIMALIST - TANPA BANYAK GARIS)
// ============================================================================
const dotMatrixStyle = `
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.4; }
  
  /* Hilangkan kotak-kotak kaku, ganti dengan garis pemisah elegan */
  .clean-header-block { border-top: 2px solid black; border-bottom: 2px solid black; padding: 12px 0; margin-bottom: 20px; }
  
  /* Tabel tanpa garis vertikal (Modern Look) */
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

// ============================================================================
// 2. CSS LAPORAN A4 (LEBIH RAPI & TTD TIDAK NUMPUK)
// ============================================================================
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
// KOMPONEN PRINT INVOICE PENJUALAN
// ============================================================================
export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const totalQtyNum = (data.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
  const totalPorsi = totalQtyNum / 4;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-red-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        {/* KOP INVOICE */}
        <div className="flex justify-between items-end mb-6">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-2xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-xs font-medium text-slate-600 leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-xs font-medium text-slate-600 leading-tight">Kec. Cipondoh, Tangerang, Banten 15147</p>
              <p className="text-xs font-medium text-slate-600 leading-tight mt-0.5">087809020931 | dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black tracking-widest uppercase mb-1 text-slate-800">INVOICE</h2>
            <p className="font-bold text-lg text-slate-600">{data.id}</p>
          </div>
        </div>

        {/* INFO PELANGGAN & TANGGAL (CLEAN) */}
        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase mb-1 text-slate-500">Tagihan Kepada :</p>
            <p className="text-xl font-black uppercase">{data.customer}</p>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-6">
            <div className="flex justify-between mb-1.5"><span className="text-xs font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-xs">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Pembayaran</span> <span className="font-bold uppercase text-xs">{data.paymentMethod}</span></div>
          </div>
        </div>

        {/* TABEL BARANG */}
        <table className="table-pro">
          <thead>
            <tr>
              <th className="w-8">NO</th>
              <th className="text-left">DESKRIPSI BARANG</th>
              <th className="w-24">PORSI</th>
              <th className="w-24">QTY</th>
              <th className="w-32 text-right">HARGA SATUAN</th>
              <th className="w-40 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold text-slate-600">1</td>
              <td className="text-left font-black uppercase">Dimsum Ayam Mix</td>
              <td className="font-bold">{totalPorsi} Prs</td>
              <td className="font-bold">{totalQtyNum} Pcs</td>
              <td className="text-right">{formatRp(data.price)}</td>
              <td className="text-right font-black">{formatRp(data.totalAll)}</td>
            </tr>
          </tbody>
        </table>

        {/* SUMMARY & INFO */}
        <div className="flex justify-between items-start mt-4">
            <div className="flex-1 mr-8">
                <div className="mb-4">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Terbilang :</span>
                    <span className="font-bold italic text-sm"># {terbilang(data.totalAll)} Rupiah #</span>
                </div>
                <div className="text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 w-max">
                    <p className="uppercase mb-1 text-slate-800">Info Pembayaran / Transfer :</p>
                    <p>BCA : 1320552261 a/n WASTAM</p>
                    <p>BRI : 775301006132536 a/n WASTAM</p>
                </div>
            </div>
            
            <div className="w-64">
                <div className="flex justify-between mb-2 text-sm"><span className="font-bold uppercase text-slate-600">Subtotal</span><span className="font-black">{formatRp(data.totalAll)}</span></div>
                <div className="flex justify-between mb-2 text-sm"><span className="font-bold uppercase text-slate-600">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t-2 border-black pt-2 mt-2">
                    <span className="font-black text-base uppercase">SISA TAGIHAN</span>
                    <span className="font-black text-base">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span>
                </div>
            </div>
        </div>
        
        {/* TANDA TANGAN */}
        <div className="flex justify-between mt-12 text-center text-xs font-bold">
          <div className="w-48"><p className="uppercase text-slate-500">Penerima / Pelanggan</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( {data.customer} )</p></div>
          <div className="w-48"><p className="uppercase text-slate-500">Hormat Kami,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( Admin Kasir )</p></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT TANDA TERIMA PEMBAYARAN CICILAN / HUTANG
// ============================================================================
export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { payment, order } = data;
  
  const totalTagihan = Number(order?.totalTagihan) || Number(order?.totalAll) || 0;
  const sisaTagihanAktual = payment?.sisaAtThisPoint !== undefined ? Number(payment.sisaAtThisPoint) : (Number(order?.sisaHutang) || 0);
  const totalTerbayar = totalTagihan - sisaTagihanAktual;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-blue-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-6">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-2xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-xs font-medium text-slate-600 leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-xs font-medium text-slate-600 leading-tight">Kec. Cipondoh, Tangerang, Banten 15147</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1 text-slate-800">TANDA TERIMA</h2>
            <p className="font-bold text-base text-slate-500 uppercase">{order?.tipe === 'HUTANG' ? 'PEMBAYARAN HUTANG' : 'PEMBAYARAN CICILAN'}</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <div className="flex mb-2 items-center"><span className="w-36 font-bold uppercase text-xs text-slate-500">{order?.tipe === 'HUTANG' ? 'Dibayarkan Kpd' : 'Diterima Dari'}</span><span className="font-black uppercase text-lg">: {order?.customer || order?.supplier}</span></div>
            <div className="flex mb-2 items-center"><span className="w-36 font-bold uppercase text-xs text-slate-500">Uang Sejumlah</span><span className="font-black text-xl">: {formatRp(payment?.amount)}</span></div>
            <div className="flex items-start"><span className="w-36 font-bold uppercase text-xs text-slate-500 mt-0.5">Terbilang</span><span className="font-bold italic text-sm text-slate-700">: # {terbilang(payment?.amount)} Rupiah #</span></div>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-6">
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-xs">{payment?.id}</span></div>
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-xs">{formatDate(payment?.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-xs">{payment?.paymentMethod}</span></div>
          </div>
        </div>

        <div className="mt-4">
            <p className="text-xs font-bold uppercase mb-2 text-slate-500">Keterangan Pembayaran :</p>
            <p className="text-sm font-bold mb-4">Pembayaran untuk Invoice Referensi: <span className="font-black uppercase">{order?.id}</span></p>
            
            <table className="table-pro">
                <thead>
                    <tr>
                        <th className="text-center w-1/4">TOTAL TAGIHAN INV</th>
                        <th className="text-center w-1/4">TOTAL TERBAYAR (AKUMULASI)</th>
                        <th className="text-center w-1/4">SISA TAGIHAN AKTUAL</th>
                        <th className="text-center w-1/4">STATUS INVOICE</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="font-bold text-base">{formatRp(totalTagihan)}</td>
                        <td className="font-bold text-base text-emerald-600">{formatRp(totalTerbayar)}</td>
                        <td className="font-black text-base text-red-600">{formatRp(sisaTagihanAktual)}</td>
                        <td className="font-black text-base">{sisaTagihanAktual <= 0 ? 'LUNAS' : 'BELUM LUNAS'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div className="flex justify-between mt-16 text-center text-xs font-bold">
          <div className="w-48"><p className="uppercase text-slate-500">Pihak Penerima</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( {order?.customer || order?.supplier} )</p></div>
          <div className="w-48"><p className="uppercase text-slate-500">Admin / Kasir</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( Dimsum Aditya )</p></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT VOUCHER KAS KELUAR
// ============================================================================
export function PrintVoucher({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-6">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-2xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-xs font-medium text-slate-600 leading-tight">Sistem Kas Terpadu</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1 text-slate-800">VOUCHER KAS</h2>
            <p className="font-bold text-sm text-slate-500 uppercase">KAS KELUAR (PENGELUARAN)</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <div className="flex mb-2 items-center"><span className="w-32 font-bold uppercase text-xs text-slate-500">Dibayarkan Kpd</span><span className="font-black uppercase text-lg">: {data.recipient}</span></div>
            <div className="flex mb-2 items-center"><span className="w-32 font-bold uppercase text-xs text-slate-500">Uang Sejumlah</span><span className="font-black text-xl">: {formatRp(data.total)}</span></div>
            <div className="flex items-start"><span className="w-32 font-bold uppercase text-xs text-slate-500 mt-0.5">Terbilang</span><span className="font-bold italic text-sm text-slate-700">: # {terbilang(data.total)} Rupiah #</span></div>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-6">
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-xs">{data.id}</span></div>
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-xs">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-xs">{data.paymentMethod}</span></div>
          </div>
        </div>

        <table className="table-pro">
          <thead>
            <tr>
              <th className="w-8">NO</th>
              <th className="text-left w-64">KATEGORI PENGELUARAN</th>
              <th className="text-left">KETERANGAN / RINCIAN</th>
              <th className="w-40 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold text-slate-600">1</td>
              <td className="text-left font-bold uppercase">{data.category}</td>
              <td className="text-left font-medium">{data.description} (Qty: {data.qty})</td>
              <td className="text-right font-black">{formatRp(data.total)}</td>
            </tr>
          </tbody>
        </table>
        
        <div className="flex justify-between mt-16 text-center text-xs font-bold">
          <div className="w-40"><p className="uppercase text-slate-500">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( Admin Kasir )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Disetujui Oleh,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( Manajemen )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Penerima,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase text-sm">( {data.recipient} )</p></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT PEMBELIAN BAHAN (RESTOCK)
// ============================================================================
export function PrintPurchase({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-6">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-2xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-xs font-medium text-slate-600 leading-tight">Divisi Pengadaan Barang</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1 text-slate-800">PEMBELIAN</h2>
            <p className="font-bold text-sm text-slate-500 uppercase">BUKTI RESTOCK BAHAN BAKU</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase mb-1 text-slate-500">Nama Supplier / Toko :</p>
            <p className="text-xl font-black uppercase">{data.supplier}</p>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-6">
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-xs">{data.id}</span></div>
            <div className="flex justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-xs">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-xs">{data.paymentMethod}</span></div>
          </div>
        </div>

        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left">NAMA BARANG & SATUAN</th></tr></thead>
          <tbody>
              {(data.items || []).map((item, idx) => (
                  <tr key={idx}>
                      <td className="font-bold text-slate-600">{idx + 1}</td>
                      <td className="text-left font-bold uppercase">{item}</td>
                  </tr>
              ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-72">
            <div className="flex justify-between mb-2 text-sm"><span className="font-bold uppercase text-slate-600">Total Belanja</span><span className="font-black">{formatRp(data.totalAll)}</span></div>
            <div className="flex justify-between mb-2 text-sm"><span className="font-bold uppercase text-slate-600">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-black pt-2 mt-2">
                <span className="font-black text-base uppercase">SISA HUTANG</span>
                <span className="font-black text-base text-red-600">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-12 text-center text-xs font-bold">
            <div className="w-48">
                <p className="uppercase text-slate-500">Admin Pembelian,</p>
                <div className="h-16"></div>
                <p className="border-t border-slate-400 pt-2 uppercase text-sm">( Dimsum Aditya )</p>
            </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT LAPORAN REKAP PUSAT (A4) - TTD DIPERBAIKI (TIDAK NUMPUK)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      
      {/* Container utama dilepas dari class relative-bottom agar mengalir natural */}
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
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px] text-slate-500">{c.id}</span></td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-right font-medium">{formatRp(c.totalTagihan)}</td>
                    <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Omset Penjualan :</td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3" className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        {rekap?.listRiwayatPiutang?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-3 mt-8 text-emerald-700">B. RIWAYAT TERIMA PIUTANG (DARI PELANGGAN)</h3>
            <table className="table-print">
              <thead>
                <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-right">NOMINAL MASUK</th><th className="text-center">STATUS NOTA</th></tr>
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
            <h3 className="font-bold text-sm mb-3 mt-8 text-red-700">C. RIWAYAT BAYAR HUTANG (KE SUPPLIER)</h3>
            <table className="table-print">
              <thead>
                <tr><th className="w-8">NO</th><th>TGL & ID BAYAR</th><th>TGL & INV ASAL</th><th>SUPPLIER</th><th className="text-center">BARANG</th><th className="text-right">NOMINAL KELUAR</th><th className="text-center">STATUS NOTA</th></tr>
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
            <h3 className="font-bold text-sm mb-3 mt-8 text-slate-800">D. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="text-center">{formatDate(o.date)}</td><td className="font-bold uppercase">{o.category}</td><td>{o.description}</td><td className="text-right font-medium">-{formatRp(o.total)}</td></tr>))}<tr><td colSpan="4" className="text-right font-bold uppercase bg-slate-50">Total Pengeluaran Kas :</td><td className="text-right font-black text-red-600 bg-slate-50">-{formatRp(totalPengeluaran)}</td></tr></tbody>
            </table>
          </>
        )}

        {/* BAGIAN TANDA TANGAN (NORMAL FLOW, ANTI NUMPUK) */}
        <div className="flex justify-between mt-20 pt-8 text-center text-sm">
            <div className="w-56">
                <p className="text-slate-600">Dibuat Oleh,</p>
                <div className="h-24"></div>
                <p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Admin / Kasir )</p>
            </div>
            <div className="w-56">
                <p className="text-slate-600">Mengetahui / Menyetujui,</p>
                <div className="h-24"></div>
                <p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Pimpinan )</p>
            </div>
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
            {(rekap?.listOrders || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px] text-slate-500">{c.id}</span></td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-right">{formatRp(c.totalTagihan)}</td>
                    <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Omset Cabang :</td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3" className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-3 mt-8 text-slate-800">B. LAPORAN HARIAN & STOK</h3>
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

        {/* BAGIAN TANDA TANGAN (NORMAL FLOW) */}
        <div className="flex justify-between mt-20 pt-8 text-center text-sm">
            <div className="w-56"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( {user?.name} )</p></div>
            <div className="w-56"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-24"></div><p className="border-t border-black pt-2 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}
