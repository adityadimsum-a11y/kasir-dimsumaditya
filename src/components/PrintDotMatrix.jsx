import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Receipt } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

const safeRupiah = (val) => {
  if (!val) return 'Rp 0';
  const str = String(val);
  if (str.includes('Rp')) return str;
  const num = Number(str.replace(/\D/g, ''));
  return formatRupiah(num);
};

// ENGINE ANGKA TERBILANG OTOMATIS
function terbilang(angka) {
  const bilangan = Number(angka);
  if (isNaN(bilangan) || bilangan === 0) return "Nol";
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";
  if (bilangan < 12) hasil = huruf[bilangan];
  else if (bilangan < 20) hasil = terbilang(bilangan - 10) + " Belas";
  else if (bilangan < 100) hasil = terbilang(Math.floor(bilangan / 10)) + " Puluh " + terbilang(bilangan % 10);
  else if (bilangan < 200) hasil = "Seratus " + terbilang(bilangan - 100);
  else if (bilangan < 1000) hasil = terbilang(Math.floor(bilangan / 100)) + " Ratus " + terbilang(bilangan % 100);
  else if (bilangan < 2000) hasil = "Seribu " + terbilang(bilangan - 1000);
  else if (bilangan < 1000000) hasil = terbilang(Math.floor(bilangan / 1000)) + " Ribu " + terbilang(bilangan % 1000);
  else if (bilangan < 1000000000) hasil = terbilang(Math.floor(bilangan / 1000000)) + " Juta " + terbilang(bilangan % 1000000);
  return hasil.trim();
}

function angkaTerbilang(angka) {
  return terbilang(angka) + " Rupiah";
}

export default function PrintDotMatrix({ printData, onClose }) {
  // STATE SAKTI ANTI-ERROR VERCEL SSR
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Menandakan aplikasi sudah di-render di browser
    
    if (printData) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    
    return () => { 
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset'; 
      }
    };
  }, [printData]);

  if (!printData) return null;

  const handlePrint = () => {
    window.print();
  };

  const docType = printData.type || 'INVOICE'; 
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  // ============================================================================
  // ISI KERTAS NOTA
  // ============================================================================
  const renderDocument = () => (
    <div className="text-black font-sans w-full relative">
      
      {/* KOP SURAT */}
      <div className="flex justify-between items-end border-b-[3px] border-black pb-1.5 mb-2">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-black">Dimsum Aditya</h1>
          <p className="text-[10px] font-bold tracking-widest mt-0.5 text-black uppercase">Distributor Dimsum Ayam</p>
        </div>
        <div className="text-right text-[9px] font-bold leading-tight text-black max-w-[280px]">
          {docType === 'WO' && <h2 className="text-base font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Work Order</h2>}
          {docType === 'DO' && <h2 className="text-base font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Surat Jalan</h2>}
          {docType === 'CASH_VOUCHER' && <h2 className="text-base font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Voucher Kas</h2>}
          {docType === 'PO' && <h2 className="text-base font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Terima Barang</h2>}
          {docType === 'WITHDRAWAL' && <h2 className="text-base font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Kwitansi Tunai</h2>}
          
          {showContactAndBank && (
            <div className="mt-1">
              <p>Jl. Thamrin Kp. Ketapang No.97,</p>
              <p>Cipondoh, Tangerang 15147</p>
              <p className="mt-0.5 font-black text-xs text-black">WA : 0878 0902 0931</p>
            </div>
          )}
        </div>
      </div>

      {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
        <>
          {/* INFO TRANSAKSI */}
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-0.5 w-[55%]">
              <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-black uppercase">NO REF</span><span className="font-black uppercase text-black">: {printData.id}</span></div>
              <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-black uppercase">TANGGAL</span><span className="font-black uppercase text-black">: {printData.date}</span></div>
              
              {docType === 'WO' && printData.targetDate && (
                <div className="flex gap-2 text-xs mt-1 bg-slate-100 px-2 py-0.5 rounded border border-black print:border-2 print:border-black print:bg-transparent">
                  <span className="w-20 font-black uppercase text-black">DEADLINE</span>
                  <span className="font-black uppercase text-sm text-black">: {printData.targetDate}</span>
                </div>
              )}
            </div>
            
            <div className="text-right w-[45%]">
              <div className="text-[9px] font-bold uppercase text-black">
                {docType === 'INVOICE' && 'PELANGGAN / AGEN:'}
                {docType === 'PO' && 'SUPPLIER:'}
                {docType === 'DO' && 'DIKIRIM KE TUJUAN:'}
                {docType === 'WO' && 'ATAS NAMA PESANAN:'}
              </div>
              <div className="text-sm font-black uppercase text-black max-w-[250px] leading-tight mt-0.5 ml-auto">
                {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM'}
              </div>
            </div>
          </div>

          {/* TABEL ITEM */}
          <table className="w-full text-xs border-collapse mb-3">
            <thead>
              <tr className="border-y-2 border-black bg-slate-50 print:bg-transparent">
                <th className="py-1 px-1 text-left font-black w-8">NO</th>
                <th className="py-1 px-1 text-left font-black">DESKRIPSI ITEM</th>
                <th className="py-1 px-1 text-center font-black w-20">QTY</th>
                {['INVOICE', 'PO'].includes(docType) && (
                  <>
                    <th className="py-1 px-1 text-right font-black w-24">HARGA</th>
                    <th className="py-1 px-1 text-right font-black w-28">SUBTOTAL</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {printData.items?.map((item, idx) => {
                const hargaSatuan = item.price ? item.price : (item.subtotal && item.qty ? item.subtotal / item.qty : 0);
                
                return (
                  <tr key={idx} className="border-b border-black border-dashed last:border-b-2 last:border-black">
                    <td className="py-1 px-1 text-center align-top font-bold text-black">{idx + 1}</td>
                    <td className="py-1 px-1 align-top font-bold text-black">{item.name}</td>
                    
                    <td className="py-1 px-1 text-center align-top">
                      <div className="font-black text-xs text-black">{formatNumber(item.qty)} <span className="text-[9px] font-bold text-black">{item.unit || 'Pcs'}</span></div>
                      {(!item.unit || item.unit === 'Pcs') && (
                        <div className="text-[8px] font-bold text-black">({formatNumber(item.qty / 4)} Porsi)</div>
                      )}
                    </td>

                    {['INVOICE', 'PO'].includes(docType) && (
                      <>
                        <td className="py-1 px-1 text-right align-top font-bold text-black">
                          {formatRupiah(hargaSatuan)}
                        </td>
                        <td className="py-1 px-1 text-right font-black text-black text-xs">
                          {formatRupiah(item.subtotal)}
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
        <div className="border-2 border-black p-3 rounded-xl space-y-2 mb-4 bg-white print:rounded-none">
          <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
            <div className="w-32 font-bold uppercase text-xs text-black">NO REFERENSI</div>
            <div className="flex-1 font-black text-sm uppercase text-black">: {printData.id} <span className="mx-2">|</span> TGL: {printData.date}</div>
          </div>
          <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
            <div className="w-32 font-bold uppercase text-xs text-black">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
            <div className="flex-1 font-black text-sm uppercase text-black">: {printData.customer_name || printData.person_name || '-'}</div>
          </div>
          <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
            <div className="w-32 font-bold uppercase text-xs text-black">UANG SEJUMLAH</div>
            <div className="flex-1 font-black text-lg uppercase text-black">: {formatRupiah(printData.amount)}</div>
          </div>
          <div className="flex gap-4 items-start border-b border-dashed border-black pb-1 p-2 bg-slate-50 border border-black mt-2 print:bg-transparent print:border-black print:border-2 print:rounded-none">
            <div className="w-28 font-bold uppercase text-xs mt-0.5 text-black">TERBILANG</div>
            <div className="flex-1 font-black text-sm uppercase italic text-black leading-tight">&quot;{angkaTerbilang(printData.amount)}&quot;</div>
          </div>
          <div className="flex gap-4 items-start pt-1">
            <div className="w-32 font-bold uppercase text-xs text-black">UNTUK KEPERLUAN</div>
            <div className="flex-1 font-bold text-xs uppercase text-black break-words">: {printData.notes || printData.description || '-'}</div>
          </div>
        </div>
      )}

      {/* METODE & TOTAL */}
      <div className="flex justify-between items-start gap-4">
        
        <div className="flex-1 space-y-2">
          {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
            <div>
              <div className="text-[9px] font-bold text-black uppercase">Catatan / Metode:</div>
              <div className="font-bold text-[10px] uppercase text-black whitespace-pre-wrap leading-tight mt-0.5">{printData.notes || printData.paymentMethod}</div>
            </div>
          )}
          {showContactAndBank && (
            <div className="text-[9px] font-bold uppercase space-y-0.5 mt-2 pt-2 border-t border-black text-black">
              <p className="font-black text-black mb-0.5">INFO REKENING PEMBAYARAN:</p>
              <p>BCA : <span className="font-black text-black text-[10px]">1320552261</span> ( WASTAM )</p>
              <p>BRI : <span className="font-black text-black text-[10px]">775301006132536</span> ( WASTAM )</p>
            </div>
          )}
        </div>

        {['INVOICE', 'PO'].includes(docType) && (
          <div className="w-[260px]">
            <div className="bg-slate-50 border border-black rounded-lg overflow-hidden print:bg-transparent print:rounded-none print:border-2">
              {printData.history ? (
                <>
                  <div className="flex justify-between py-1 px-2 border-b border-black text-[10px] font-bold text-black">
                    <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                    <span className="font-black text-black">{safeRupiah(printData.history.nominalLama)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1 px-2 border-b border-black bg-emerald-100 print:bg-transparent">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-black">{printData.history.labelAksi || 'SUDAH DIBAYAR'}</span>
                      <span className="text-[8px] font-bold text-black uppercase">VIA: {printData.paymentMethod?.split('+')[0] || 'TUNAI/TRANSFER'}</span>
                    </div>
                    <span className="font-black text-black text-xs">{safeRupiah(printData.history.nominalAksi)}</span>
                  </div>

                  <div className="flex justify-between py-1.5 px-2 text-xs font-black uppercase bg-red-100 print:bg-transparent">
                    <span className="text-black">{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                    <span className="text-black text-sm">{safeRupiah(printData.history.nominalBaru)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1.5 px-2 font-black text-sm uppercase bg-slate-200 print:bg-transparent text-black">
                  <span>TOTAL</span>
                  <span className="text-base">{formatRupiah(printData.amount)}</span>
                </div>
              )}
            </div>

            {printData.paymentHistory && printData.paymentHistory.length > 0 && (
              <div className="mt-2 text-[8px]">
                <div className="font-black text-black uppercase mb-0.5 border-b border-black pb-0.5">Riwayat Pembayaran Sebelumnya:</div>
                <div className="space-y-0.5">
                  {printData.paymentHistory.map((hist, i) => (
                    <div key={i} className="flex justify-between font-bold text-black">
                      <span className="w-16 leading-tight">{hist.date}</span>
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
      <div className="flex justify-between items-end mt-4 text-black">
        <div className="text-center w-32">
          <div className="font-bold text-[9px] mb-8 uppercase">
            {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
            {docType === 'WO' ? 'Kepala Dapur' : ''}
            {docType === 'PO' ? 'Supir Supplier' : ''}
            {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
          </div>
          <div className="border-b border-black w-full mb-1"></div>
          <div className="text-[8px] font-bold uppercase">Ttd &amp; Nama Jelas</div>
        </div>
        
        {docType === 'DO' ? (
          <div className="text-center w-32">
            <div className="font-bold text-[9px] mb-8 uppercase">Supir / Kurir</div>
            <div className="border-b border-black w-full mb-1"></div>
            <div className="text-[8px] font-bold uppercase">{printData.driver_name || '................'}</div>
          </div>
        ) : (
          <div className="text-center w-56 space-y-0.5">
            {docType === 'INVOICE' && (
              <p className="text-[9px] font-bold italic text-black">&quot;Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami.&quot;</p>
            )}
            <p className="font-black text-[10px] uppercase tracking-widest text-black mt-1">www.dimsumaditya.id</p>
          </div>
        )}

        <div className="text-center w-32">
          <div className="font-bold text-[9px] mb-8 uppercase">
            {docType === 'DO' ? 'Bagian Gudang' : 'Admin Kasir'}
          </div>
          <div className="border-b border-black w-full mb-1"></div>
          <div className="text-[8px] font-bold uppercase">{printData.admin_name}</div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* 1. LAYER PREVIEW DI LAYAR MONITOR */}
      <div className="fixed inset-0 z-[99998] bg-slate-900/80 flex items-center justify-center p-2 sm:p-4 print:hidden">
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
            <div className="bg-white shadow-md border border-slate-300 p-6 w-full max-w-[21.49cm]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
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

      {/* 2. LAYER KHUSUS PRINTER (DI-PORTAL LANGSUNG KE BODY HANYA JIKA CLIENT-SIDE) */}
      {isMounted && createPortal(
        <div id="print-portal-container" className="hidden print:block absolute left-0 top-0 bg-white m-0 z-[999999]" style={{ width: '21.49cm', height: '13.97cm', padding: '4mm 6mm', boxSizing: 'border-box', overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif' }}>
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
