import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Receipt } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// 🔥 FIX 1: Pertahankan tanda minus (-) untuk akuntansi yang ada diskon / retur
const safeRupiah = (val) => {
  if (val === 0 || val === '0') return 'Rp 0';
  if (!val) return 'Rp 0';
  const str = String(val);
  if (str.includes('Rp')) return str;
  // Ubah regex untuk mengizinkan digit dan tanda minus
  const num = Number(str.replace(/[^\d-]/g, ''));
  return formatRupiah(num);
};

// ENGINE ANGKA TERBILANG OTOMATIS
function angkaTerbilang(angka) {
  const bilangan = Number(angka);
  if (isNaN(bilangan) || bilangan === 0) return "Nol Rupiah";
  // Menangani angka minus pada terbilang
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
    return () => { 
      if (typeof document !== 'undefined') document.body.style.overflow = 'unset'; 
    };
  }, [printData]);

  if (!printData) return null;

  const handlePrint = () => {
    window.print();
  };

  const docType = printData.type || 'INVOICE'; 
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  const renderDocument = () => (
    <div className="text-black font-sans w-full relative">
      
      {/* KOP SURAT */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-slate-900">Dimsum Aditya</h1>
          <p className="text-[10px] font-bold tracking-widest mt-0.5 text-slate-600 uppercase">Distributor Dimsum Ayam</p>
        </div>
        <div className="text-right text-[9px] font-bold leading-tight text-slate-800 max-w-[280px]">
          {docType === 'WO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Work Order</h2>}
          {docType === 'DO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Surat Jalan</h2>}
          {docType === 'CASH_VOUCHER' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Voucher Kas</h2>}
          {docType === 'PO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Terima Barang</h2>}
          {docType === 'WITHDRAWAL' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Kwitansi Tunai</h2>}
          {docType === 'PURCHASE' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Bukti Kas Keluar</h2>}
          
          {showContactAndBank && (
            <div className="mt-1">
              <p>Jl. Thamrin Kp. Ketapang No.97,</p>
              <p>Cipondoh, Tangerang 15147</p>
              <p className="mt-0.5 font-black text-xs text-slate-900">WA : 0878 0902 0931</p>
            </div>
          )}
        </div>
      </div>

      {['INVOICE', 'PO', 'DO', 'WO', 'PURCHASE'].includes(docType) && (
        <>
          {/* INFO TRANSAKSI */}
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-0.5 w-1/2">
              <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-slate-500 uppercase">NO REF</span><span className="font-black uppercase text-slate-900">: {printData.id}</span></div>
              <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-slate-500 uppercase">TANGGAL</span><span className="font-black uppercase text-slate-900">: {printData.date}</span></div>
              
              {docType === 'WO' && printData.targetDate && (
                <div className="flex gap-2 text-xs mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100 print:border-black print:bg-transparent">
                  <span className="w-20 font-black uppercase text-red-600 print:text-black">DEADLINE</span>
                  <span className="font-black uppercase text-sm text-red-700 print:text-black">: {printData.targetDate}</span>
                </div>
              )}
            </div>
            
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase text-slate-500">
                {docType === 'INVOICE' && 'PELANGGAN / AGEN:'}
                {docType === 'PO' && 'SUPPLIER:'}
                {docType === 'DO' && 'DIKIRIM KE TUJUAN:'}
                {docType === 'WO' && 'ATAS NAMA PESANAN:'}
                {docType === 'PURCHASE' && 'SUPPLIER / REKANAN:'}
              </div>
              <div className="text-base font-black uppercase text-slate-900 max-w-[250px] leading-none mt-0.5">
                {/* 🔥 FIX 4: Tambahkan person_name agar Purchase Kas tidak lari ke UMUM */}
                {printData.customer_name || printData.supplier_name || printData.destination || printData.person_name || 'UMUM'}
              </div>
            </div>
          </div>

          {/* TABEL ITEM */}
          <table className="w-full text-xs border-collapse mb-3">
            <thead>
              <tr className="border-y-2 border-slate-800 bg-slate-50 print:bg-transparent">
                <th className="py-1.5 px-2 text-left font-black w-8">NO</th>
                <th className="py-1.5 px-2 text-left font-black">DESKRIPSI ITEM</th>
                <th className="py-1.5 px-2 text-center font-black w-24">QTY</th>
                {['INVOICE', 'PO', 'PURCHASE'].includes(docType) && (
                  <>
                    <th className="py-1.5 px-2 text-right font-black w-28">HARGA</th>
                    <th className="py-1.5 px-2 text-right font-black w-32">SUBTOTAL</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {printData.items?.map((item, idx) => {
                // 🔥 FIX 2 & 3: Kalkulasi aman untuk Hindari Infinity pembagian 0 & Subtotal kosong
                const safeQty = Number(item.qty) || 0;
                const hargaSatuan = item.price !== undefined ? item.price : (item.subtotal && safeQty ? item.subtotal / safeQty : 0);
                const subtotalAkhir = item.subtotal !== undefined ? item.subtotal : (hargaSatuan * safeQty);
                
                return (
                  <tr key={idx} className="border-b border-slate-300 border-dashed last:border-b-2 last:border-slate-800">
                    <td className="py-2 px-2 text-center align-top font-bold text-slate-600">{idx + 1}</td>
                    <td className="py-2 px-2 align-top font-bold text-slate-900">{item.name}</td>
                    
                    <td className="py-2 px-2 text-center align-top">
                      <div className="font-black text-sm text-slate-900">{formatNumber(item.qty)} <span className="text-[9px] font-bold text-slate-600">{item.unit || 'Pcs'}</span></div>
                      {(!item.unit || item.unit === 'Pcs') && safeQty > 0 && (
                        <div className="text-[8px] font-bold text-slate-500">({formatNumber(safeQty / 4)} Porsi)</div>
                      )}
                    </td>

                    {['INVOICE', 'PO', 'PURCHASE'].includes(docType) && (
                      <>
                        <td className="py-2 px-2 text-right align-top font-bold text-slate-800">
                          {formatRupiah(hargaSatuan)}
                        </td>
                        <td className="py-2 px-2 text-right font-black text-slate-900 text-sm">
                          {formatRupiah(subtotalAkhir)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
        <div className="border-2 border-slate-800 p-4 rounded-xl space-y-4 mb-6 bg-white print:rounded-none print:border-black">
          <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-1 print:border-slate-800">
            <div className="w-40 font-bold uppercase text-xs text-slate-500 print:text-black">NO REFERENSI</div>
            <div className="flex-1 font-black text-sm uppercase text-slate-900 print:text-black">: {printData.id} <span className="text-slate-400 font-bold mx-2 print:text-black">|</span> TGL: {printData.date}</div>
          </div>
          <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-1 print:border-slate-800">
            <div className="w-40 font-bold uppercase text-xs text-slate-500 print:text-black">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
            <div className="flex-1 font-black text-sm uppercase text-slate-900 print:text-black">: {printData.customer_name || printData.person_name || '-'}</div>
          </div>
          <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-1 print:border-slate-800">
            <div className="w-40 font-bold uppercase text-xs text-slate-500 print:text-black">UANG SEJUMLAH</div>
            <div className="flex-1 font-black text-lg uppercase text-slate-900 print:text-black">: {formatRupiah(printData.amount)}</div>
          </div>
          <div className="flex gap-4 items-start border-b border-dashed border-slate-300 pb-1 p-2 bg-slate-50 border border-slate-200 rounded-lg mt-3 print:bg-transparent print:border-slate-800 print:border-b-dashed print:border-t-0 print:border-x-0 print:rounded-none">
            <div className="w-36 font-bold uppercase text-xs mt-0.5 text-slate-500 print:text-black">TERBILANG</div>
            <div className="flex-1 font-black text-sm uppercase italic text-slate-800 leading-tight print:text-black">&quot;{angkaTerbilang(printData.amount)}&quot;</div>
          </div>
          <div className="flex gap-4 items-start pt-1">
            <div className="w-40 font-bold uppercase text-xs text-slate-500 print:text-black">UNTUK KEPERLUAN</div>
            <div className="flex-1 font-bold text-xs uppercase text-slate-900 break-words print:text-black">: {printData.notes || printData.description || '-'}</div>
          </div>
        </div>
      )}

      {/* METODE & TOTAL */}
      <div className="flex justify-between items-start gap-4">
        
        <div className="flex-1 space-y-2">
          {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase">Catatan / Metode:</div>
              <div className="font-bold text-xs uppercase text-slate-900 whitespace-pre-wrap leading-tight mt-0.5">{printData.notes || printData.paymentMethod}</div>
            </div>
          )}
          {showContactAndBank && (
            <div className="text-[9px] font-bold uppercase space-y-0.5 mt-2 pt-2 border-t border-slate-300 text-slate-600 print:border-slate-800 print:text-black">
              <p className="font-black text-slate-900 mb-0.5">INFO REKENING PEMBAYARAN:</p>
              <p>BCA : <span className="font-black text-slate-900 text-[10px]">1320552261</span> ( WASTAM )</p>
              <p>BRI : <span className="font-black text-slate-900 text-[10px]">775301006132536</span> ( WASTAM )</p>
            </div>
          )}
        </div>

        {['INVOICE', 'PO', 'PURCHASE'].includes(docType) && (
          <div className="w-[280px]">
            <div className="bg-slate-50 border border-slate-300 rounded-lg overflow-hidden print:bg-transparent print:rounded-none print:border-2 print:border-slate-800">
              {printData.history ? (
                <>
                  <div className="flex justify-between py-1.5 px-3 border-b border-slate-200 text-[10px] font-bold text-slate-600 print:border-slate-800 print:text-black">
                    <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                    <span className="font-black text-slate-900">{safeRupiah(printData.history.nominalLama)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1.5 px-3 border-b border-slate-200 bg-emerald-50/50 print:bg-transparent print:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 print:text-black">{printData.history.labelAksi || 'SUDAH DIBAYAR'}</span>
                      <span className="text-[8px] font-bold text-emerald-600 uppercase print:text-slate-600">VIA: {printData.paymentMethod?.split('+')[0] || 'TUNAI/TRANSFER'}</span>
                    </div>
                    <span className="font-black text-emerald-700 text-xs print:text-black">{safeRupiah(printData.history.nominalAksi)}</span>
                  </div>

                  <div className="flex justify-between py-2 px-3 text-xs font-black uppercase bg-red-50/50 print:bg-transparent">
                    <span className="text-red-800 print:text-black">{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                    <span className="text-red-600 text-sm print:text-black">{safeRupiah(printData.history.nominalBaru)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-2 px-3 font-black text-sm uppercase bg-blue-50/50 print:bg-transparent text-blue-900 print:text-black">
                  <span>TOTAL</span>
                  <span>{formatRupiah(printData.amount)}</span>
                </div>
              )}
            </div>

            {printData.paymentHistory && printData.paymentHistory.length > 0 && (
              <div className="mt-2 text-[8px] print:text-black">
                <div className="font-black text-slate-500 uppercase mb-0.5 border-b border-slate-300 pb-0.5 print:text-black print:border-slate-800">Riwayat Pembayaran:</div>
                <div className="space-y-0.5">
                  {printData.paymentHistory.map((hist, i) => (
                    <div key={i} className="flex justify-between font-bold text-slate-700 print:text-black">
                      <span className="w-16">{hist.date}</span>
                      <span className="flex-1 truncate px-1">{hist.method}</span>
                      <span className="text-right font-black">{safeRupiah(hist.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TANDA TANGAN */}
      <div className="flex justify-between items-end mt-4 text-slate-800 print:text-black">
        <div className="text-center w-32">
          <div className="font-bold text-[9px] mb-8 uppercase">
            {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
            {docType === 'WO' ? 'Kepala Dapur' : ''}
            {docType === 'PO' ? 'Supir Supplier' : ''}
            {['CASH_VOUCHER', 'WITHDRAWAL', 'PURCHASE'].includes(docType) ? 'Penerima Dana' : ''}
          </div>
          <div className="border-b border-slate-800 w-full mb-1"></div>
          <div className="text-[8px] font-bold uppercase print:hidden">Ttd &amp; Nama Jelas</div>
          {/* 🔥 FIX: Khusus cetakan asli supir supplier PO bisa ditulis namanya juga kalau ada data supirnya */}
          <div className="text-[8px] font-bold uppercase hidden print:block">{docType === 'PO' && printData.driver_name ? printData.driver_name : 'Ttd & Nama Jelas'}</div>
        </div>
        
        {docType === 'DO' ? (
          <div className="text-center w-32">
            <div className="font-bold text-[9px] mb-8 uppercase">Supir / Kurir</div>
            <div className="border-b border-slate-800 w-full mb-1"></div>
            <div className="text-[8px] font-bold uppercase">{printData.driver_name || '................'}</div>
          </div>
        ) : (
          <div className="text-center w-56 space-y-0.5">
            {docType === 'INVOICE' && (
              <p className="text-[9px] font-bold italic text-slate-500 print:text-black">&quot;Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami.&quot;</p>
            )}
            <p className="font-black text-[10px] uppercase tracking-widest text-slate-900 mt-1">www.dimsumaditya.id</p>
          </div>
        )}

        <div className="text-center w-32">
          <div className="font-bold text-[9px] mb-8 uppercase">
            {docType === 'DO' ? 'Bagian Gudang' : 'Admin Kasir'}
          </div>
          <div className="border-b border-slate-800 w-full mb-1"></div>
          <div className="text-[8px] font-bold uppercase">{printData.admin_name || '................'}</div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* 1. LAYER PREVIEW DI LAYAR MONITOR */}
      <div className="fixed inset-0 z-[99998] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:hidden">
        <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[98vh]">
          
          <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
              <Receipt size={18} className="text-blue-600" />
              Pratinjau Kertas 3-Ply LX-310 ({docType})
            </h3>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="p-2 md:p-6 overflow-y-auto custom-scrollbar flex-1 flex justify-center">
            <div className="bg-white shadow-md border border-slate-300 p-6 md:p-8 w-full max-w-[21.49cm]">
              {renderDocument()}
            </div>
          </div>

          <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs border border-slate-200 cursor-pointer">
              Batal &amp; Tutup
            </button>
            <button onClick={handlePrint} className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs shadow-md cursor-pointer">
              <Printer size={16} /> Cetak ke Printer LX-310
            </button>
          </div>

        </div>
      </div>

      {/* 2. LAYER KHUSUS PRINTER (DI-PORTAL LANGSUNG KE BODY) */}
      {isMounted && createPortal(
        <div id="print-portal-container" className="hidden print:block absolute left-0 top-0 bg-white m-0 z-[999999]" style={{ width: '21.49cm', height: '13.97cm', padding: '4mm 6mm', boxSizing: 'border-box', overflow: 'hidden' }}>
          <style type="text/css" media="print">
            {`
              @page { size: 21.49cm 13.97cm; margin: 0; }
              body { background-color: white !important; margin: 0; padding: 0; }
              body > *:not(#print-portal-container) { display: none !important; }
            `}
          </style>
          {renderDocument()}
        </div>,
        document.body
      )}
    </>
  );
}
