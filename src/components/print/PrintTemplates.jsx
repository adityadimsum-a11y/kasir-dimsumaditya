import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. TEMPLATE INVOICE & VOUCHER (PRO DOT-MATRIX EDITION 9.5" x 11")
// ============================================================================
const dotMatrixStyle = `
  @media print {
    @page { size: 9.5in 11in; margin: 0.3in 0.4in; }
    body { 
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; 
        font-size: 13px !important; 
        color: #000; background: white; 
        -webkit-print-color-adjust: exact; margin: 0; 
    }
    .hide-on-print { display: none !important; }
  }
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.4; }
  
  /* BORDER TEGAS KHUSUS DOT MATRIX */
  .box-solid { border: 2px solid black; padding: 12px; border-radius: 4px; }
  
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 2px solid black; }
  .table-pro th { border: 1px solid black; padding: 10px 8px; text-align: center; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid black; font-size: 12px; }
  .table-pro td { border: 1px solid black; padding: 10px 8px; text-align: center; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
`;

export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-red-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        {/* HEADER KORPORAT */}
        <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-20 object-contain" />
            <div>
              <h1 className="font-black text-2xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-xs font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-xs font-medium leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
              <p className="text-xs font-medium leading-tight mt-1">Telp: 087809020931 | Web: dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black tracking-widest uppercase mb-1">INVOICE</h2>
            <p className="font-bold text-lg">{data.id}</p>
          </div>
        </div>

        {/* INFO PELANGGAN & INVOICE (KOTAK TEGAS) */}
        <div className="flex justify-between gap-6 mb-6">
          <div className="flex-1 box-solid">
            <p className="text-[10px] font-bold uppercase mb-1">Tagihan Kepada :</p>
            <p className="text-xl font-black uppercase">{data.customer}</p>
          </div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-2 pb-1 border-b border-dashed border-black"><span className="text-xs font-bold uppercase">Tanggal</span> <span className="font-bold">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase">Pembayaran</span> <span className="font-bold uppercase">{data.paymentMethod}</span></div>
          </div>
        </div>

        {/* TABEL ITEM (PRO DESIGN) */}
        <table className="table-pro">
          <thead>
            <tr>
              <th className="w-12">NO</th>
              <th className="text-left">KATEGORI BARANG</th>
              <th className="w-32">QTY</th>
              <th className="w-40 text-right">HARGA SATUAN</th>
              <th className="w-40 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">1</td>
              <td className="text-left font-bold uppercase">{data.category}</td>
              <td className="font-bold">{(data.items || []).join(', ')}</td>
              <td className="text-right">{formatRp(data.price)}</td>
              <td className="text-right font-black">{formatRp(data.totalAll)}</td>
            </tr>
            {/* Ruang kosong estetika */}
            <tr><td className="py-6 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr>
          </tbody>
        </table>

        {/* SUMMARY & TERBILANG */}
        <div className="flex justify-between items-start mt-4">
            <div className="flex-1 mr-8">
                <div className="border border-black p-3 rounded bg-white">
                    <span className="text-[10px] font-bold uppercase block mb-1">Terbilang :</span>
                    <span className="font-bold italic text-sm"># {terbilang(data.totalAll)} Rupiah #</span>
                </div>
                <div className="mt-4 text-xs font-bold">
                    <p className="uppercase underline mb-1">Info Transfer :</p>
                    <p>BCA : 1320552261 a/n WASTAM</p>
                    <p>BRI : 775301006132536 a/n WASTAM</p>
                </div>
            </div>
            
            <div className="w-72">
                <div className="flex justify-between border-b border-black pb-2 mb-2">
                    <span className="font-bold uppercase">Subtotal</span>
                    <span className="font-black">{formatRp(data.totalAll)}</span>
                </div>
                <div className="flex justify-between border-b border-black pb-2 mb-2">
                    <span className="font-bold uppercase">Telah Dibayar</span>
                    <span className="font-bold">{formatRp(data.paidAmount)}</span>
                </div>
                <div className="flex justify-between bg-black text-white p-2 rounded-sm -mx-2 px-2 print:bg-white print:text-black print:border-2 print:border-black">
                    <span className="font-black uppercase">SISA TAGIHAN</span>
                    <span className="font-black">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span>
                </div>
            </div>
        </div>
        
        {/* TANDA TANGAN */}
        <div className="flex justify-between mt-12 text-center text-sm">
          <div className="w-48">
            <p className="mb-20 font-bold uppercase">Penerima / Pelanggan</p>
            <p className="border-t border-black pt-1 uppercase">( {data.customer} )</p>
          </div>
          <div className="w-48">
            <p className="mb-20 font-bold uppercase">Hormat Kami,</p>
            <p className="border-t border-black pt-1 uppercase">( Admin Kasir )</p>
          </div>
        </div>
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
        {/* HEADER KORPORAT */}
        <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16 object-contain" />
            <h1 className="font-black text-2xl tracking-wide uppercase">Dimsum Aditya</h1>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1">PAYMENT VOUCHER</h2>
            <p className="font-bold text-lg">KAS KELUAR</p>
          </div>
        </div>

        {/* INFO VOUCHER (KOTAK TEGAS) */}
        <div className="flex justify-between gap-6 mb-6">
          <div className="flex-1 box-solid">
            <div className="flex mb-2 pb-2 border-b border-dashed border-black"><span className="w-36 font-bold uppercase text-xs">Dibayarkan Kepada</span><span className="font-black uppercase text-base">: {data.recipient}</span></div>
            <div className="flex mb-2 pb-2 border-b border-dashed border-black"><span className="w-36 font-bold uppercase text-xs">Terbilang</span><span className="font-bold italic text-sm">: # {terbilang(data.total)} Rupiah #</span></div>
            <div className="flex"><span className="w-36 font-bold uppercase text-xs">Uang Sejumlah</span><span className="font-black text-lg">: {formatRp(data.total)}</span></div>
          </div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-2 pb-2 border-b border-dashed border-black"><span className="text-xs font-bold uppercase">No. Referensi</span> <span className="font-bold">{data.id}</span></div>
            <div className="flex justify-between mb-2 pb-2 border-b border-dashed border-black"><span className="text-xs font-bold uppercase">Tanggal</span> <span className="font-bold">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase">Metode</span> <span className="font-bold uppercase">{data.paymentMethod}</span></div>
          </div>
        </div>

        {/* TABEL RINCIAN */}
        <table className="table-pro">
          <thead>
            <tr>
              <th className="w-12">NO</th>
              <th className="text-left w-64">KATEGORI</th>
              <th className="text-left">KETERANGAN / RINCIAN</th>
              <th className="w-40 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">1</td>
              <td className="text-left font-bold uppercase">{data.category}</td>
              <td className="text-left">{data.description} (Qty: {data.qty})</td>
              <td className="text-right font-black">{formatRp(data.total)}</td>
            </tr>
            {/* Ruang kosong estetika */}
            <tr><td className="py-8 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr>
          </tbody>
        </table>
        
        {/* TANDA TANGAN (KORPORAT 3 KOLOM) */}
        <div className="flex justify-between mt-12 text-center text-sm">
          <div className="w-40">
            <p className="mb-20 font-bold uppercase">Dibuat Oleh,</p>
            <p className="border-t border-black pt-1 uppercase">( Admin / Kasir )</p>
          </div>
          <div className="w-40">
            <p className="mb-20 font-bold uppercase">Disetujui Oleh,</p>
            <p className="border-t border-black pt-1 uppercase">( Manajemen )</p>
          </div>
          <div className="w-40">
            <p className="mb-20 font-bold uppercase">Penerima,</p>
            <p className="border-t border-black pt-1 uppercase">( {data.recipient} )</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// === TEMPLATE LAINNYA (SISA YANG TIDAK DIUBAH) ===
export function PrintPurchase({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4"><h2 className="font-black text-2xl uppercase">BUKTI PEMBELIAN BAHAN</h2><p className="text-sm font-bold">No. Ref: {data.id} | Tgl: {formatDate(data.date)}</p></div>
        <div className="mb-4 text-sm box-solid flex justify-between"><p>Supplier: <span className="font-bold uppercase text-base">{data.supplier}</span></p><p>Metode Bayar: <strong>{data.paymentMethod}</strong></p></div>
        <table className="table-pro">
          <thead><tr><th className="w-12">NO</th><th className="text-left">BARANG & SATUAN</th></tr></thead>
          <tbody>{(data.items || []).map((item, idx) => (<tr key={idx}><td>{idx + 1}</td><td className="text-left font-bold">{item}</td></tr>))}</tbody>
        </table>
        <div className="flex justify-end mt-4 text-sm">
          <div className="w-72 box-solid">
            <div className="flex justify-between font-bold mb-2 pb-2 border-b border-black"><span>TOTAL BELANJA</span><span className="text-lg">{formatRp(data.totalAll)}</span></div>
            <div className="flex justify-between font-bold"><span>DIBAYAR</span><span>{formatRp(data.paidAmount)}</span></div>
          </div>
        </div>
        <div className="mt-8 flex justify-end text-center text-sm"><div className="w-48"><p className="mb-20 font-bold uppercase">Admin Pembelian,</p><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { payment, order } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-6"><h2 className="font-black text-2xl uppercase">TANDA TERIMA {order.tipe === 'HUTANG' ? 'PEMBAYARAN' : 'CICILAN'}</h2><p className="font-bold">No. Ref: {payment.id} | Tgl: {formatDate(payment.date)}</p></div>
        <div className="text-sm box-solid">
          <div className="flex mb-3 pb-3 border-b border-dashed border-black"><span className="w-48 font-bold uppercase">{order.tipe === 'HUTANG' ? 'Dibayarkan Kepada:' : 'Diterima Dari:'}</span><span className="uppercase font-black text-lg">{order.customer}</span></div>
          <div className="flex mb-3 pb-3 border-b border-dashed border-black"><span className="w-48 font-bold uppercase">Nominal Uang:</span><span className="font-black text-xl">{formatRp(payment.amount)}</span></div>
          <div className="flex mb-3 pb-3 border-b border-dashed border-black"><span className="w-48 font-bold uppercase">Untuk Pembayaran:</span><span className="font-bold">Cicilan Invoice No. {order.id}</span></div>
          <div className="flex"><span className="w-48 font-bold uppercase">Metode Pembayaran:</span><span className="font-bold">{payment.paymentMethod}</span></div>
        </div>
        <div className="mt-16 flex justify-end text-center text-sm"><div className="w-48"><p className="mb-20 font-bold uppercase">Penerima,</p><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. TEMPLATE LAPORAN HARIAN (KHUSUS A4 - MARGIN PADAT & HEMAT KERTAS)
// ============================================================================
const a4Style = `
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif; font-size: 10px; color: black; background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; } 
    .hide-on-print { display: none !important; } 
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; } 
    th, td { padding: 3px 4px !important; border: 1px solid black !important; line-height: 1.1; } 
    th { background-color: #f3f4f6 !important; font-weight: bold; }
    h1 { font-size: 16px; margin: 0 0 4px 0; } 
    h3 { font-size: 12px; margin: 12px 0 4px 0; } 
    p { margin: 2px 0; }
    .grid-summary { display: flex; gap: 10px; margin-bottom: 10px; }
    .grid-summary > div { flex: 1; border: 1px solid black; padding: 6px; }
  }
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 20px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
`;

export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="font-bold uppercase">Laporan Keuangan & Penjualan Pusat</h1>
            <p className="text-gray-700">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
        </div>
        <div className="grid-summary">
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">SALDO AKTUAL BERJALAN</h3><div className="flex justify-between"><span>Tunai (CASH):</span> <strong>{formatRp(rekap?.saldoCash)}</strong></div><div className="flex justify-between"><span>Rekening (TF):</span> <strong>{formatRp(rekap?.saldoTF)}</strong></div><div className="flex justify-between border-t border-black mt-1 pt-1"><span>TOTAL SALDO:</span> <strong>{formatRp(rekap?.saldoAkhir)}</strong></div></div>
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">OMSET PERIODE INI</h3><div className="flex justify-between"><span>Total Penjualan:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div><div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Prs</strong></div><div className="flex justify-between"><span>Piutang Baru:</span> <strong>{formatRp(rekap?.totalPiutangBaru)}</strong></div></div>
        </div>

        <h3>A. TRANSAKSI PENJUALAN</h3>
        <table>
          <thead><tr><th className="w-6 text-center">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>KATEGORI</th><th>VIA</th><th>QTY</th><th className="text-right">OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[9px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td>{c.category}</td><td>{c.paymentMethod}</td><td>{(c?.items || []).join(', ')}</td><td className="text-right font-medium">{formatRp(c.total)}</td></tr>))}
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) && <tr><td colSpan="7" className="text-center italic">Nihil.</td></tr>}
          </tbody>
        </table>

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3>B. BUKU KAS (PENGELUARAN & CLOSING)</h3>
            <table>
              <thead><tr><th className="w-6 text-center">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th>VIA</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td>{formatDate(o.date)}</td><td className="font-bold uppercase">{o.category}</td><td>{o.description}</td><td>{o.paymentMethod}</td><td className="text-right font-bold">{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td></tr>))}</tbody>
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
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="font-bold uppercase">Laporan Operasional {user?.name}</h1>
            <p className="text-gray-700">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
        </div>
        <div className="grid-summary">
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">RINGKASAN PENJUALAN</h3><div className="flex justify-between"><span>Omset Kotor:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div><div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Porsi</strong></div></div>
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">SETORAN PUSAT</h3><div className="flex justify-between"><span>Total Disetor:</span> <strong>{formatRp(rekap?.setoranKePusat)}</strong></div><div className="flex justify-between"><span>Status:</span> <strong>Transfer Bank</strong></div></div>
        </div>

        <h3>A. TRANSAKSI INVOICE CABANG</h3>
        <table>
          <thead><tr><th className="w-6 text-center">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>{(rekap?.listOrders || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[9px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td>{c.paymentMethod}</td><td>{(c?.items||[]).join(', ')}</td><td className="text-right font-medium">{formatRp(c.total)}</td></tr>))}</tbody>
        </table>

        <h3>B. LAPORAN HARIAN & STOK</h3>
        <table>
            <thead><tr><th className="w-6 text-center">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>{(rekap?.listReports || []).map((p, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td>{formatDate(p.date)}</td><td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td><td className="font-bold uppercase">{p.stokFreezer}</td><td className="text-center">{p.transferDestination || 'BCA (WASTAM)'}</td><td className="text-right font-bold">{formatRp(p.nominal)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
