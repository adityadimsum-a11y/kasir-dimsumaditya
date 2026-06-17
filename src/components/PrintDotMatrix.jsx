import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Receipt } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

const safeRupiah = (val) => {
  if (val === 0 || val === '0') return 'Rp 0';
  if (!val) return 'Rp 0';
  const str = String(val);
  if (str.includes('Rp')) return str;
  const num = Number(str.replace(/[^\d-]/g, ''));
  return formatRupiah(num);
};

function angkaTerbilang(angka) {
  const bilangan = Number(angka);
  if (isNaN(bilangan) || bilangan === 0) return "Nol Rupiah";
  const isMinus = bilangan < 0;
  const absBilangan = Math.abs(bilangan);
  
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";
  if (absBilangan < 12) hasil = huruf[absBilangan];
  else if (absBilangan < 20) hasil = angkaTerbilang(absBilangan - 10).replace(" Rupiah", "") + " Belas";
  else if (absBilangan < 100) hasil = angkaTerbilang(Math.floor(absBilangan / 10)).replace(" Rupiah", "") + " Puluh " + angkaTerbilang(absBilangan % 10).replace(" Rupiah", "");
  else if (absBilangan < 200) hasil = "Seratus " + angkaTerbilang(absBilangan - 100).replace(" Rupiah", "");
  else if (absBilangan < 1000) hasil = angkaTerbilang(Math.floor(absBilangan / 100)).replace(" Rupiah", "") + " Ratus " + angkaTerbilang(absBilangan % 100).replace(" Rupiah", "");
  else if (absBilangan < 2000) hasil = "Seribu " + angkaTerbilang(absBilangan - 1000).replace(" Rupiah", "");
  else if (absBilangan < 1000000) hasil = angkaTerbilang(Math.floor(absBilangan / 1000)).replace(" Rupiah", "") + " Ribu " + angkaTerbilang(absBilangan % 1000).replace(" Rupiah", "");
  else if (absBilangan < 1000000000) hasil = angkaTerbilang(Math.floor(absBilangan / 1000000)).replace(" Rupiah", "") + " Juta " + angkaTerbilang(absBilangan % 1000000).replace(" Rupiah", "");
  
  return (isMinus ? "Minus " : "") + hasil.trim() + " Rupiah";
}

export default function PrintDotMatrix({ printData, onClose }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (printData) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { if (typeof document !== 'undefined') document.body.style.overflow = 'unset'; };
  }, [printData]);

  if (!printData) return null;

  const handlePrint = () => window.print();
  const docType = printData.type || 'INVOICE'; 

  // =========================================================================
  // 📝 1. LAYOUT INVOICE (Nota Penjualan Reguler)
  // =========================================================================
  const renderInvoice = () => (
    <div className="text-black font-sans w-full">
      <div className="flex justify-between items-end border-b-[3px] border-black pb-2 mb-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-black">Dimsum Aditya</h1>
          <p className="text-[10px] font-bold tracking-widest mt-0.5 text-black uppercase">Pabrik &amp; Distributor Dimsum Ayam</p>
        </div>
        <div className="text-right text-[10px] font-bold leading-tight text-black">
          <h2 className="text-lg font-black mb-1 text-black border-2 border-black px-2 py-0.5 uppercase inline-block">INVOICE PENJUALAN</h2>
          <p className="mt-1">Jl. Thamrin Kp. Ketapang No.97, Cipondoh, Tangerang</p>
          <p className="font-black text-xs text-black">WA: 0878 0902 0931</p>
        </div>
      </div>

      <div className="flex justify-between items-start mb-3 border-b border-black pb-2">
        <div className="space-y-0.5 text-xs text-black font-bold">
          <div className="flex"><span className="w-20 uppercase">NO. INVOICE</span><span>: {printData.id}</span></div>
          <div className="flex"><span className="w-20 uppercase">TANGGAL</span><span>: {printData.date}</span></div>
          <div className="flex"><span className="w-20 uppercase">KASIR</span><span>: {printData.admin_name}</span></div>
        </div>
        <div className="text-right text-black border-2 border-black p-2 max-w-[250px]">
          <div className="text-[10px] font-bold uppercase">PELANGGAN / AGEN:</div>
          <div className="text-sm font-black uppercase leading-tight mt-0.5">{printData.customer_name || 'UMUM'}</div>
        </div>
      </div>

      <table className="w-full text-xs border-collapse mb-3 border-b-[3px] border-black">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-1.5 px-2 text-left font-black w-8 border-r border-black">NO</th>
            <th className="py-1.5 px-2 text-left font-black border-r border-black">NAMA PRODUK</th>
            <th className="py-1.5 px-2 text-center font-black w-20 border-r border-black">QTY</th>
            <th className="py-1.5 px-2 text-right font-black w-24 border-r border-black">HARGA</th>
            <th className="py-1.5 px-2 text-right font-black w-28">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          {printData.items?.map((item, idx) => {
            const safeQty = Number(item.qty) || 0;
            const hargaSatuan = item.price !== undefined ? item.price : (item.subtotal && safeQty ? item.subtotal / safeQty : 0);
            const subtotalAkhir = item.subtotal !== undefined ? item.subtotal : (hargaSatuan * safeQty);
            return (
              <tr key={idx} className="border-b border-dashed border-black">
                <td className="py-1 px-2 text-center align-top font-bold border-r border-black">{idx + 1}</td>
                <td className="py-1 px-2 align-top font-bold uppercase">{item.name}</td>
                <td className="py-1 px-2 text-center align-top font-black border-l border-r border-black">{formatNumber(item.qty)} <span className="text-[9px]">{item.unit || 'Pcs'}</span></td>
                <td className="py-1 px-2 text-right align-top font-bold border-r border-black">{formatRupiah(hargaSatuan)}</td>
                <td className="py-1 px-2 text-right font-black text-sm">{formatRupiah(subtotalAkhir)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-between items-start gap-4 text-black">
        <div className="flex-1 space-y-1">
          {printData.notes && (
            <div className="border border-black p-1.5 min-h-[50px]">
              <div className="text-[9px] font-bold uppercase border-b border-black pb-0.5 mb-1">Catatan Pesanan:</div>
              <div className="font-bold text-[10px] uppercase leading-tight">{printData.notes}</div>
            </div>
          )}
          <div className="text-[9px] font-bold uppercase space-y-0.5 pt-1">
            <p className="font-black mb-0.5 text-xs">INFO REKENING PEMBAYARAN:</p>
            <p>BCA : <span className="font-black text-[11px]">1320552261</span> ( A.N WASTAM )</p>
            <p>BRI : <span className="font-black text-[11px]">775301006132536</span> ( A.N WASTAM )</p>
          </div>
        </div>

        <div className="w-[280px] border-2 border-black p-0">
          {printData.history ? (
            <>
              <div className="flex justify-between py-1 px-2 border-b border-black text-[11px] font-bold">
                <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                <span className="font-black">{safeRupiah(printData.history.nominalLama)}</span>
              </div>
              <div className="flex justify-between py-1 px-2 border-b border-black text-[11px] font-bold">
                <span className="uppercase">{printData.history.labelAksi || 'SUDAH DIBAYAR'} ({printData.paymentMethod?.split('+')[0]})</span>
                <span className="font-black">{safeRupiah(printData.history.nominalAksi)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2 text-sm font-black uppercase">
                <span>{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                <span>{safeRupiah(printData.history.nominalBaru)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-2 px-2 font-black text-sm uppercase">
              <span>TOTAL BAYAR</span><span>{formatRupiah(printData.amount)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mt-4 text-black text-center text-[10px] font-bold uppercase">
        <div className="w-32"><div className="mb-8">Tanda Terima,</div><div className="border-b border-black w-full mb-1"></div><div>Pelanggan / Agen</div></div>
        <div className="w-32"><div className="mb-8">Hormat Kami,</div><div className="border-b border-black w-full mb-1"></div><div>{printData.admin_name}</div></div>
      </div>
    </div>
  );

  // =========================================================================
  // 🚚 2. LAYOUT DO (Surat Jalan / Delivery Order) - TANPA HARGA
  // =========================================================================
  const renderDO = () => (
    <div className="text-black font-sans w-full">
      <div className="text-center border-b-[3px] border-black pb-2 mb-3">
        <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-black">Dimsum Aditya</h1>
        <h2 className="text-lg font-black mt-1 text-black border-2 border-black px-4 py-1 uppercase inline-block">SURAT JALAN / DELIVERY ORDER</h2>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div className="space-y-0.5 text-xs text-black font-bold">
          <div className="flex"><span className="w-24 uppercase">NO. D.O</span><span>: {printData.id}</span></div>
          <div className="flex"><span className="w-24 uppercase">TANGGAL KIRIM</span><span>: {printData.date}</span></div>
        </div>
        <div className="text-left text-black border-2 border-black p-2 min-w-[250px]">
          <div className="text-[10px] font-bold uppercase">ALAMAT TUJUAN PENGIRIMAN:</div>
          <div className="text-sm font-black uppercase mt-0.5">{printData.customer_name}</div>
        </div>
      </div>

      <table className="w-full text-sm border-collapse mb-4 border-b-[3px] border-black">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-2 px-2 text-center font-black w-10 border-r border-black">NO</th>
            <th className="py-2 px-2 text-center font-black w-32 border-r border-black">KTS (QTY)</th>
            <th className="py-2 px-2 text-center font-black w-24 border-r border-black">SATUAN</th>
            <th className="py-2 px-2 text-left font-black">NAMA BARANG / DESKRIPSI</th>
          </tr>
        </thead>
        <tbody>
          {printData.items?.map((item, idx) => (
            <tr key={idx} className="border-b border-black">
              <td className="py-2 px-2 text-center font-bold border-r border-black">{idx + 1}</td>
              <td className="py-2 px-2 text-center font-black text-lg border-r border-black">{formatNumber(item.qty)}</td>
              <td className="py-2 px-2 text-center font-bold border-r border-black uppercase">{item.suffix || item.unit || 'Pcs'}</td>
              <td className="py-2 px-2 text-left font-bold uppercase">{item.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {printData.notes && (
        <div className="mb-4 text-xs font-bold uppercase border border-black p-2">
          <strong>CATATAN PENGIRIMAN:</strong> {printData.notes}
        </div>
      )}

      <div className="flex justify-between items-end mt-10 text-black text-center text-[10px] font-bold uppercase">
        <div className="w-32"><div className="mb-10">Penerima,</div><div className="border-b border-black w-full mb-1"></div><div>Nama Jelas / Cap Toko</div></div>
        <div className="w-32"><div className="mb-10">Supir / Kurir,</div><div className="border-b border-black w-full mb-1"></div><div>{printData.driver_name || '................'}</div></div>
        <div className="w-32"><div className="mb-10">Bag. Gudang / Logistik,</div><div className="border-b border-black w-full mb-1"></div><div>{printData.admin_name}</div></div>
      </div>
    </div>
  );

  // =========================================================================
  // 👨‍🍳 3. LAYOUT WO (Work Order Dapur) - FONT BESAR
  // =========================================================================
  const renderWO = () => (
    <div className="text-black font-sans w-full">
      <div className="flex justify-between items-center border-b-[3px] border-black pb-2 mb-3">
        <div>
          <h1 className="text-3xl font-black uppercase text-black">WORK ORDER</h1>
          <p className="text-xs font-bold uppercase text-black mt-1">Surat Perintah Produksi Dapur</p>
        </div>
        <div className="text-right text-xs font-bold border-2 border-black p-2">
          <div className="uppercase">TARGET SELESAI:</div>
          <div className="text-xl font-black text-black">{printData.targetDate || 'SEGERA'}</div>
        </div>
      </div>

      <div className="flex text-sm text-black font-bold mb-3 gap-6">
        <div><span className="uppercase">NO. WO:</span> {printData.id}</div>
        <div><span className="uppercase">PEMESAN:</span> {printData.customer_name}</div>
      </div>

      <table className="w-full text-base border-collapse mb-4 border-[3px] border-black">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 px-2 text-center font-black w-10 border-r border-black">NO</th>
            <th className="py-2 px-2 text-left font-black border-r border-black">ITEM MENU YANG DIMASAK</th>
            <th className="py-2 px-2 text-center font-black w-32 border-l border-black">TOTAL BIKIN</th>
          </tr>
        </thead>
        <tbody>
          {printData.items?.map((item, idx) => (
            <tr key={idx} className="border-b border-black">
              <td className="py-3 px-2 text-center font-bold border-r border-black">{idx + 1}</td>
              <td className="py-3 px-2 text-left font-black uppercase text-xl">{item.name}</td>
              <td className="py-3 px-2 text-center font-black text-2xl border-l border-black">{formatNumber(item.qty)} <span className="text-xs font-bold">{item.unit || 'Pcs'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {printData.notes && (
        <div className="border-2 border-black p-3 text-sm font-black uppercase mt-4">
          <div className="underline mb-1">REQ KHUSUS DAPUR:</div>
          <div className="text-lg leading-tight">{printData.notes}</div>
        </div>
      )}

      <div className="flex justify-end items-end mt-10 text-black text-center text-[10px] font-bold uppercase">
        <div className="w-40"><div className="mb-10">Kepala Dapur Produksi,</div><div className="border-b border-black w-full mb-1"></div><div>Ttd & Nama Jelas</div></div>
      </div>
    </div>
  );

  // =========================================================================
  // 💵 4. LAYOUT KAS KELUAR & PAYSLIP (VOUCHER KEUANGAN)
  // =========================================================================
  const renderVoucher = () => (
    <div className="text-black font-sans w-full border-[3px] border-black p-4">
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-2xl font-black uppercase text-black tracking-widest">{docType === 'PAYSLIP' ? 'SLIP GAJI KARYAWAN' : 'VOUCHER KAS KELUAR'}</h1>
        <p className="text-xs font-bold mt-1">PT. DIMSUM ADITYA INDONESIA</p>
      </div>

      <div className="space-y-3 text-sm font-bold">
        <div className="flex"><div className="w-40 uppercase">NO. REFERENSI</div><div className="uppercase">: {printData.id}</div></div>
        <div className="flex"><div className="w-40 uppercase">TANGGAL</div><div className="uppercase">: {printData.date}</div></div>
        <div className="flex"><div className="w-40 uppercase">{docType === 'PAYSLIP' ? 'DIBAYARKAN KEPADA' : 'PENERIMA DANA'}</div><div className="uppercase font-black">: {printData.customer_name || printData.person_name}</div></div>
        {printData.position && <div className="flex"><div className="w-40 uppercase">JABATAN / DIVISI</div><div className="uppercase">: {printData.position}</div></div>}
      </div>

      {/* Jika Ada Rincian (Seperti di Slip Gaji) */}
      {printData.items && printData.items.length > 0 && (
        <table className="w-full text-xs border-collapse mt-4 mb-2 border-y-2 border-black">
           <thead>
             <tr>
               <th className="py-1.5 text-left uppercase border-b border-black">Keterangan / Komponen</th>
               <th className="py-1.5 text-right uppercase border-b border-black">Nominal Rupiah</th>
             </tr>
           </thead>
           <tbody>
             {printData.items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-1 uppercase">{it.name}</td>
                  <td className="py-1 text-right font-black">{formatRupiah(it.subtotal)}</td>
                </tr>
             ))}
           </tbody>
        </table>
      )}

      <div className="mt-4 border-2 border-black p-3 bg-gray-100 print:bg-transparent">
        <div className="flex justify-between items-center text-lg font-black uppercase">
          <span>{docType === 'PAYSLIP' ? 'TOTAL TAKE HOME PAY' : 'TOTAL UANG KELUAR'}</span>
          <span>{formatRupiah(printData.amount)}</span>
        </div>
      </div>
      
      <div className="mt-2 text-xs font-bold uppercase italic">
        Terbilang: "{angkaTerbilang(printData.amount)}"
      </div>

      {printData.history?.labelBaru && (
         <div className="mt-2 text-[10px] font-bold border border-black p-1.5 inline-block uppercase">
            {printData.history.labelBaru}: {formatRupiah(printData.history.nominalBaru)}
         </div>
      )}

      <div className="flex justify-between items-end mt-12 text-black text-center text-[10px] font-bold uppercase">
        <div className="w-32"><div className="mb-10">Penerima,</div><div className="border-b border-black w-full mb-1"></div><div>{printData.customer_name || printData.person_name}</div></div>
        <div className="w-32"><div className="mb-10">Bag. Keuangan / HRD,</div><div className="border-b border-black w-full mb-1"></div><div>{printData.admin_name}</div></div>
      </div>
    </div>
  );

  // =========================================================================
  // 📑 5. LAYOUT REPORT A4 (Rekapan untuk Bos)
  // =========================================================================
  const renderReportA4 = () => {
    return (
      <div className="text-black font-sans w-full">
         <div className="text-center border-b-[3px] border-black pb-3 mb-4">
           <h1 className="text-2xl font-black uppercase text-black">LAPORAN REKAPITULASI DIMSUM ADITYA</h1>
           <p className="text-sm font-bold uppercase mt-1">Periode: {printData.data?.dateFrom} s/d {printData.data?.dateTo} | Cabang: {printData.data?.branchName}</p>
         </div>
         {/* Konten A4 bisa kita buat generik menggunakan JSON.stringify jika tidak ada format khusus, 
             tapi karena file ini fokus Dot Matrix, Report A4 ini jadi bonus fallback. */}
         <div className="text-sm font-bold">
           Laporan berhasil di-generate. Silakan gunakan printer laser/inkjet standar untuk layout ini.
           <pre className="mt-4 text-xs font-mono">{JSON.stringify(printData.data?.rekap, null, 2)}</pre>
         </div>
      </div>
    );
  };

  // 🎯 SELECTOR MESIN RENDER
  const SelectRender = () => {
    if (docType === 'INVOICE') return renderInvoice();
    if (docType === 'DO') return renderDO();
    if (docType === 'WO') return renderWO();
    if (['CASH_VOUCHER', 'WITHDRAWAL', 'PURCHASE', 'PAYSLIP'].includes(docType)) return renderVoucher();
    if (docType === 'reportBranch') return renderReportA4();
    return renderInvoice(); // Fallback
  };

  return (
    <>
      <div className="fixed inset-0 z-[99998] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:hidden">
        <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[98vh]">
          <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
              <Receipt size={18} className="text-blue-600" />
              Pratinjau Kertas 3-Ply LX-310 ({docType})
            </h3>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer"><X size={16} /></button>
          </div>

          <div className="p-2 md:p-6 overflow-y-auto custom-scrollbar flex-1 flex justify-center">
            <div className="bg-white shadow-md border border-slate-300 p-6 md:p-8 w-full max-w-[21.59cm]">
              <SelectRender />
            </div>
          </div>

          <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs border border-slate-200 cursor-pointer">Batal &amp; Tutup</button>
            <button onClick={handlePrint} className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs shadow-md cursor-pointer"><Printer size={16} /> Cetak ke Printer LX-310</button>
          </div>
        </div>
      </div>

      {isMounted && createPortal(
        <div id="print-portal-container" className="hidden print:block absolute left-0 top-0 bg-white m-0 z-[999999]" style={{ width: '21.59cm', height: '13.97cm', padding: '5mm 10mm', boxSizing: 'border-box', overflow: 'hidden' }}>
          {/* CSS INJECTOR KHUSUS PRINT */}
          <style type="text/css" media="print">
            {`
              @page { size: 21.59cm 13.97cm; margin: 0; }
              body { 
                background-color: white !important; 
                margin: 0; padding: 0; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
                color: black !important;
                text-rendering: optimizeLegibility;
                -webkit-font-smoothing: antialiased;
              }
              body > *:not(#print-portal-container) { display: none !important; }
              
              /* Force All Elements to Black and White for Dot Matrix Sharpness */
              #print-portal-container * {
                color: black !important;
                border-color: black !important;
                box-shadow: none !important;
                text-shadow: none !important;
                font-family: Arial, sans-serif !important;
              }
              /* Strip backgrounds but keep specific light grays if absolutely needed (Dot matrix ignores anyway) */
              .bg-slate-50, .bg-emerald-50, .bg-red-50, .bg-blue-50 { background-color: transparent !important; }
            `}
          </style>
          <SelectRender />
        </div>,
        document.body
      )}
    </>
  );
}
