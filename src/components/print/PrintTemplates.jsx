import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';
import { getLocalYMD } from '../../utils/helpers';

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

export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Invoice Tidak Tersedia.</div>;

  const items = data.items || [];
  const totalQtyNum = items.reduce((sum, str) => sum + (parseInt(str) || 0), 0) || Number(data.qty) || 0;
  const totalPorsi = totalQtyNum / 4;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-red-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-3">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '54px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Kec. Cipondoh, Tangerang, Banten 15147</p>
              <p className="text-[10px] font-medium text-slate-600 leading-tight mt-0.5">087809020931 | dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1 text-slate-800">INVOICE</h2>
            <p className="font-bold text-base text-slate-600">{data.id || '-'}</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">Tagihan Kepada :</p>
            <p className="text-lg font-black uppercase">{data.customer || '-'}</p>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-4">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase text-slate-500">Pembayaran</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod || '-'}</span></div>
          </div>
        </div>

        <table className="table-pro">
          <thead>
            <tr><th className="w-8">NO</th><th className="text-left">DESKRIPSI BARANG</th><th className="w-20">PORSI</th><th className="w-20">QTY</th><th className="w-28 text-right">HARGA SATUAN</th><th className="w-32 text-right">TOTAL</th></tr>
          </thead>
          <tbody>
            <tr><td className="font-bold text-slate-600">1</td><td className="text-left font-black uppercase">Dimsum Ayam Mix</td><td className="font-bold">{totalPorsi} Prs</td><td className="font-bold">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-black">{formatRp(data.totalAll || data.total)}</td></tr>
          </tbody>
        </table>

        <div className="flex justify-between items-start mt-4">
            <div className="flex-1 mr-6">
                <div className="mb-3"><span className="text-[9px] font-bold uppercase text-slate-500 block mb-0.5">Terbilang :</span><span className="font-bold italic text-[11px]"># {terbilang(data.totalAll || data.total)} Rupiah #</span></div>
                <div className="text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 w-max"><p className="uppercase mb-0.5 text-slate-800">Info Pembayaran / Transfer :</p><p>BCA : 1320552261 a/n WASTAM</p><p>BRI : 775301006132536 a/n WASTAM</p></div>
            </div>
            <div className="w-56">
                <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase text-slate-600">Subtotal</span><span className="font-black">{formatRp(data.totalAll || data.total)}</span></div>
                <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase text-slate-600">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t-2 border-black pt-1.5 mt-1.5"><span className="font-black text-sm uppercase">SISA TAGIHAN</span><span className="font-black text-sm">{formatRp(Number(data.totalAll || data.total || 0) - Number(data.paidAmount || 0))}</span></div>
            </div>
        </div>
        
        <div className="flex justify-between mt-10 text-center text-[10px] font-bold">
          <div className="w-40"><p className="uppercase text-slate-500">Penerima / Pelanggan</p><div className="h-12"></div><p className="border-t border-slate-400 pt-1 uppercase">( {data.customer || '-'} )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Hormat Kami,</p><div className="h-12"></div><p className="border-t border-slate-400 pt-1 uppercase">( Admin Kasir )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Tanda Terima Tidak Tersedia.</div>;
  const { payment, order } = data;
  
  const totalTagihan = Number(order?.totalTagihan) || Number(order?.totalAll) || 0;
  const sisaTagihanAktual = payment?.sisaAtThisPoint !== undefined ? Number(payment.sisaAtThisPoint) : (Number(order?.sisaHutang) || 0);
  const totalTerbayar = totalTagihan - sisaTagihanAktual;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-blue-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-3">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '54px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Kec. Cipondoh, Tangerang, Banten 15147</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black tracking-widest uppercase mb-1 text-slate-800">TANDA TERIMA</h2>
            <p className="font-bold text-sm text-slate-500 uppercase">{order?.tipe === 'HUTANG' ? 'PEMBAYARAN HUTANG' : 'PEMBAYARAN CICILAN'}</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <div className="flex mb-1.5 items-center"><span className="w-28 font-bold uppercase text-[10px] text-slate-500">{order?.tipe === 'HUTANG' ? 'Dibayarkan Kpd' : 'Diterima Dari'}</span><span className="font-black uppercase text-base">: {order?.customer || order?.supplier || '-'}</span></div>
            <div className="flex mb-1.5 items-center"><span className="w-28 font-bold uppercase text-[10px] text-slate-500">Uang Sejumlah</span><span className="font-black text-lg">: {formatRp(payment?.amount)}</span></div>
            <div className="flex items-start"><span className="w-28 font-bold uppercase text-[10px] text-slate-500 mt-0.5">Terbilang</span><span className="font-bold italic text-xs text-slate-700">: # {terbilang(payment?.amount)} Rupiah #</span></div>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-4">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-[10px]">{payment?.id || '-'}</span></div>
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(payment?.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-[10px]">{payment?.paymentMethod || '-'}</span></div>
          </div>
        </div>

        <div className="mt-4">
            <p className="text-[10px] font-bold uppercase mb-1.5 text-slate-500">Keterangan Pembayaran :</p>
            <p className="text-[11px] font-bold mb-3">Pembayaran untuk Invoice Referensi: <span className="font-black uppercase">{order?.id || '-'}</span></p>
            
            <table className="table-pro">
                <thead>
                    <tr><th className="text-center w-1/4">TOTAL TAGIHAN INV</th><th className="text-center w-1/4">TOTAL TERBAYAR (AKUMULASI)</th><th className="text-center w-1/4">SISA TAGIHAN AKTUAL</th><th className="text-center w-1/4">STATUS INVOICE</th></tr>
                </thead>
                <tbody>
                    <tr><td className="font-bold text-sm">{formatRp(totalTagihan)}</td><td className="font-bold text-sm text-emerald-600">{formatRp(totalTerbayar)}</td><td className="font-black text-sm text-red-600">{formatRp(sisaTagihanAktual)}</td><td className="font-black text-sm">{sisaTagihanAktual <= 0 ? 'LUNAS' : 'BELUM LUNAS'}</td></tr>
                </tbody>
            </table>
        </div>

        <div className="flex justify-between mt-12 text-center text-[10px] font-bold">
          <div className="w-40"><p className="uppercase text-slate-500">Pihak Penerima</p><div className="h-12"></div><p className="border-t border-slate-400 pt-1 uppercase">( {order?.customer || order?.supplier || '-'} )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Admin / Kasir</p><div className="h-12"></div><p className="border-t border-slate-400 pt-1 uppercase">( Dimsum Aditya )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintVoucher({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Voucher Kas Tidak Tersedia.</div>;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '54px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-0.5">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Sistem Kas Terpadu</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black tracking-widest uppercase mb-1 text-slate-800">VOUCHER KAS</h2>
            <p className="font-bold text-xs text-slate-500 uppercase">KAS KELUAR (PENGELUARAN)</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 mt-6 mb-6">
          <div className="flex-1 space-y-2.5">
            <div className="flex items-start"><span className="w-32 font-bold uppercase text-xs text-slate-500">Dibayarkan Kpd</span><span className="font-black uppercase text-base">: {data?.recipient || '-'}</span></div>
            <div className="flex items-start"><span className="w-32 font-bold uppercase text-xs text-slate-500">Uang Sejumlah</span><span className="font-black text-xl">: {formatRp(data?.total)}</span></div>
            <div className="flex items-start"><span className="w-32 font-bold uppercase text-xs text-slate-500 mt-1">Terbilang</span><span className="font-bold italic text-sm text-slate-800">: # {terbilang(data?.total)} Rupiah #</span></div>
          </div>
          <div className="w-1/3 border-l-2 border-slate-200 pl-6 space-y-2 flex flex-col justify-center">
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-xs">{data?.id || '-'}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-xs">{formatDate(data?.date)}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-xs">{data?.paymentMethod || '-'}</span></div>
          </div>
        </div>

        <table className="w-full mt-6 mb-8">
          <thead>
            <tr className="border-t-2 border-b-2 border-black">
              <th className="w-10 text-center py-2.5 text-xs font-bold uppercase">No</th>
              <th className="text-left py-2.5 text-xs font-bold uppercase w-1/3">Kategori Pengeluaran</th>
              <th className="text-left py-2.5 text-xs font-bold uppercase">Keterangan / Rincian</th>
              <th className="w-40 text-right py-2.5 text-xs font-bold uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-black">
              <td className="text-center py-4 font-bold text-slate-600">1</td>
              <td className="text-left py-4 font-bold uppercase text-sm">{data?.category || '-'}</td>
              <td className="text-left py-4 font-medium text-sm text-slate-700">
                {data?.description || '-'} 
                {Number(data?.qty) > 1 ? ` (Qty: ${data.qty})` : ''}
              </td>
              <td className="text-right py-4 font-black text-lg">{formatRp(data?.total)}</td>
            </tr>
          </tbody>
        </table>
        
        <div className="flex justify-between mt-16 text-center text-xs font-bold">
          <div className="w-40"><p className="uppercase text-slate-500">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase">( Admin Kasir )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Disetujui Oleh,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase">( Manajemen )</p></div>
          <div className="w-40"><p className="uppercase text-slate-500">Penerima,</p><div className="h-16"></div><p className="border-t border-slate-400 pt-2 uppercase">( {data?.recipient || '-'} )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintPurchase({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Pembelian Baku Tidak Tersedia.</div>;

  const totalAll = Number(data?.totalAll) || Number(data?.total) || 0;
  const paidAmount = Number(data?.paidAmount) || 0;
  const sisaHutang = totalAll - paidAmount;
  const items = data?.items || [];

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-3">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '54px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium text-slate-600 leading-tight">Divisi Pengadaan Barang</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black tracking-widest uppercase mb-1 text-slate-800">PEMBELIAN</h2>
            <p className="font-bold text-xs text-slate-500 uppercase">BUKTI RESTOCK BAHAN BAKU</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 clean-header-block">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase mb-1 text-slate-500">Nama Supplier / Toko :</p>
            <p className="text-lg font-black uppercase">{data?.supplier || '-'}</p>
          </div>
          <div className="w-1/3 flex flex-col justify-center border-l-2 border-slate-200 pl-4">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase text-slate-500">No. Bukti</span> <span className="font-bold text-[10px]">{data?.id || '-'}</span></div>
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase text-slate-500">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data?.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase text-slate-500">Metode</span> <span className="font-bold uppercase text-[10px]">{data?.paymentMethod || '-'}</span></div>
          </div>
        </div>

        <table className="table-pro">
          <thead><tr><th className="w-8">NO</th><th className="text-left">NAMA BARANG & SATUAN</th></tr></thead>
          <tbody>
              {items.length === 0 ? (
                 <tr><td colSpan="2" className="text-center italic py-4">Data tidak tersedia.</td></tr>
              ) : (
                 items.map((item, idx) => (
                    <tr key={idx}>
                        <td className="font-bold text-slate-600">{idx + 1}</td>
                        <td className="text-left font-bold uppercase">{item}</td>
                    </tr>
                 ))
              )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64">
            <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase text-slate-600">Total Belanja</span><span className="font-black">{formatRp(totalAll)}</span></div>
            <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase text-slate-600">Telah Dibayar</span><span className="font-bold">{formatRp(paidAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-black pt-1.5 mt-1.5">
                <span className="font-black text-sm uppercase">SISA HUTANG</span>
                <span className="font-black text-sm text-red-600">{formatRp(sisaHutang)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-12 text-center text-[10px] font-bold">
            <div className="w-40">
                <p className="uppercase text-slate-500">Admin Pembelian,</p>
                <div className="h-12"></div>
                <p className="border-t border-slate-400 pt-1 uppercase">( Dimsum Aditya )</p>
            </div>
        </div>
      </div>
    </div>
  );
}

export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Rekap Laporan Tidak Tersedia.</div>;
  
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e?.total)||0), 0);
  const sumTerbayar = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (Number(c?.totalTerbayar)||0), 0);
  const sumSisa = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (Number(c?.sisaTagihan)||0), 0);

  // LOGIC LIVE OPERASIONAL PUSAT TANGERANG
  const totalAdukanHarian = (rekap?.listExpenses || [])
    .filter(e => e.category === 'Setoran Kas Harian / Closing') // trick fallback or dynamic pass
    .length ? 0 : 0; // fallback safe
    
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI & OPERASIONAL</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-[10px]">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        {/* SUMMARY KEUANGAN */}
        <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">A. RINGKASAN FINANSIAL KAS</h3>
        <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Omset Penjualan</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Terjual: <strong>{rekap?.totalPcs || 0} Pcs</strong></p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Kas Masuk</p>
                <div className="flex justify-between text-[10px] font-black text-emerald-800 mt-1"><span>TOTAL:</span><span>{formatRp((rekap?.inCashPeriode||0) + (rekap?.inTfPeriode||0))}</span></div>
            </div>
            <div className="border border-red-200 p-2 rounded bg-red-50">
                <p className="text-[9px] font-bold text-red-700 uppercase mb-0.5">Kas Keluar</p>
                <div className="flex justify-between text-[10px] font-black text-red-800 mt-1"><span>TOTAL:</span><span>{formatRp((rekap?.outCashPeriode||0) + (rekap?.outTfPeriode||0))}</span></div>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Tagihan Gantung (Sisa)</p>
                <div className="flex justify-between text-[9px]"><span>Piutang:</span><span className="font-bold">{formatRp(rekap?.totalPiutangBaru)}</span></div>
            </div>
        </div>

        <h3 className="font-bold text-xs mb-1.5 text-slate-800">B. TRANSAKSI PENJUALAN DIMSUM</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi penjualan dimsum di periode ini.</td></tr>
            ) : (
                rekap.listTransaksiDetail.map((c, i) => {
                    const itemPcs = (c?.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                        <td className="font-bold uppercase">{c?.customer || '-'}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                        <td className="text-right font-medium">{formatRp(c?.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c?.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c?.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c?.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c?.status || '-'}</td>
                    </tr>
                )})
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Penjualan Dimsum :</td>
                <td className="text-center font-bold text-slate-700 bg-slate-50 text-[9px]">{rekap?.totalPcs || 0} Pcs / {rekap?.totalPorsi || 0} Prs</td>
                <td className="bg-slate-50"></td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td className="text-right font-black text-emerald-600 bg-slate-50">{formatRp(sumTerbayar)}</td>
                <td className="text-right font-black text-red-600 bg-slate-50">{formatRp(sumSisa)}</td>
                <td className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-4 text-indigo-700">C. TRANSAKSI PEMBELIAN BAHAN BAKU</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>SUPPLIER</th><th className="text-center">BARANG & QTY</th><th className="text-center">VIA</th><th className="text-right">TOTAL</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
              {(!rekap?.listPembelianDetail || rekap.listPembelianDetail.length === 0) ? (
                  <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi pembelian bahan.</td></tr>
              ) : (
                  rekap.listPembelianDetail.map((c, i) => {
                      const sisa = Number(c?.total || 0) - Number(c?.paidAmount || 0);
                      const status = sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS';
                      return (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                          <td className="font-bold uppercase">{c?.supplier || '-'}</td>
                          <td className="text-center text-[9px] uppercase">{c?.itemName || '-'} ({c?.qty || 0} {c?.satuan || '-'})</td>
                          <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                          <td className="text-right font-medium">{formatRp(c?.total)}</td>
                          <td className="text-right text-emerald-600 font-bold">{formatRp(c?.paidAmount)}</td>
                          <td className="text-right font-bold text-red-600">{formatRp(sisa)}</td>
                          <td className={`text-center font-bold text-[9px] ${status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{status}</td>
                      </tr>
                  )})
              )}
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

export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Rekap Cabang Tidak Tersedia.</div>;

  const { rekap, dateFrom, dateTo } = data;
  const sumTerbayarBranch = (rekap?.listOrders || []).reduce((s, c) => s + (Number(c?.totalTerbayar)||0), 0);
  const sumSisaBranch = (rekap?.listOrders || []).reduce((s, c) => s + (Number(c?.sisaTagihan)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI CABANG</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TERPADU</h2>
                <p className="text-gray-600 font-medium text-[10px]">CABANG: {user?.name || '-'} | Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        {/* SUMMARY KEUANGAN */}
        <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">A. RINGKASAN FINANSIAL KAS</h3>
        <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-slate-50">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Total Omset Cabang</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Total Kas Disetor</p>
                <p className="text-sm font-black text-emerald-700">{formatRp(rekap?.setoranKePusat)}</p>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Piutang Gantung (Agen)</p>
                <p className="text-sm font-black text-orange-700">{formatRp(rekap?.totalPiutangBaru)}</p>
            </div>
        </div>
        
        <h3 className="font-bold text-xs mb-1.5 text-slate-800">B. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr></thead>
          <tbody>
            {(!rekap?.listOrders || rekap.listOrders.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi penjualan cabang.</td></tr>
            ) : (
                rekap.listOrders.map((c, i) => {
                    const itemPcs = (c?.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                        <td className="font-bold uppercase">{c?.customer || '-'}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                        <td className="text-right">{formatRp(c?.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c?.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c?.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c?.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c?.status || '-'}</td>
                    </tr>
                )})
            )}
          </tbody>
        </table>

        <div className="flex justify-between mt-12 text-center text-xs">
            <div className="w-48"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( {user?.name || '-'} )</p></div>
            <div className="w-48"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintSPK({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data SPK Tidak Tersedia.</div>;

  const items = data.items || [];
  const totalQtyNum = items.reduce((sum, str) => sum + (parseInt(str) || 0), 0) || Number(data.qty) || 0;
  const totalPorsi = totalQtyNum / 4;

  const spkStyle = `
    .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.4; }
    .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .table-pro th { border-top: 2px solid black; border-bottom: 2px solid black; padding: 8px 4px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 14px; }
    .table-pro td { padding: 12px 4px; text-align: left; border-bottom: 1px dashed #ccc; font-size: 16px; }
    @media print {
      @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
      .hide-on-print { display: none !important; }
      .print-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
    }
  `;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: spkStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-orange-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <div>
            <h2 className="text-3xl font-black uppercase text-slate-800 tracking-widest mb-1">TICKET PRODUKSI</h2>
            <p className="font-bold text-lg text-slate-600">ID: {data.id}</p>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm uppercase text-slate-500 mb-1">Tanggal Order</div>
            <div className="text-lg font-black">{formatDate(data.date)}</div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-slate-50 border-2 border-slate-200 rounded-lg">
           <p className="text-xs uppercase text-slate-500 font-bold mb-1">Nama Pemesan / Pelanggan:</p>
           <p className="text-2xl font-black uppercase text-black">{data.customer || '-'}</p>
        </div>

        <table className="table-pro mb-8">
          <thead>
            <tr>
              <th className="w-2/3">NAMA BARANG / ITEM</th>
              <th className="w-1/3 text-center">JUMLAH (PORSI)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-black uppercase tracking-wide">Dimsum Ayam Mix</td>
              <td className="text-center">
                 <span className="text-2xl font-black">{totalPorsi} Prs</span>
                 <span className="text-sm font-bold text-slate-600 ml-2">({totalQtyNum} Pcs)</span>
              </td>
            </tr>
          </tbody>
        </table>

        {data.notes && (
          <div className="mb-8 p-3 border-2 border-black border-dashed">
             <p className="text-xs font-bold uppercase mb-1">Catatan Khusus:</p>
             <p className="text-lg font-bold">{data.notes}</p>
          </div>
        )}

        <div className="flex justify-between mt-10">
           <div className="text-left">
              <p className="text-xs font-bold uppercase mb-12">Admin Kasir</p>
              <p className="text-xs uppercase border-t-2 border-black pt-1 w-32 text-center">( ................... )</p>
           </div>
           <div className="text-center">
              <p className="text-xs font-bold uppercase mb-12">Tim Produksi / Dapur</p>
              <p className="text-xs uppercase border-t-2 border-black pt-1 w-48 text-center">( .................................. )</p>
              <p className="text-[10px] mt-1 italic text-slate-500">*Tempel kertas ini di keranjang saat barang READY.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
