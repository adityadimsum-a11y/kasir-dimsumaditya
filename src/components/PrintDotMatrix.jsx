import React, { useEffect } from 'react';
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

// ENGINE ANGKA TERBILANG OTOMATIS (Sudah Diperbaiki Logikanya)
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
  useEffect(() => {
    if (printData) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [printData]);

  if (!printData) return null;

  const handlePrint = () => {
    window.print();
  };

  const docType = printData.type || 'INVOICE'; 
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  // ============================================================================
  // ISI KERTAS NOTA (Font Diperbesar untuk 3-Ply NCR Dot Matrix)
  // ============================================================================
  const renderDocument = () => (
    // Memaksa font Arial agar cetakan jarum printer lebih solid dan kotak
    <div className="text-black w-full relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      
      {/* KOP SURAT */}
      <div className="flex justify-between items-end border-b-[3px] border-black pb-3 mb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none text-black">Dimsum Aditya</h1>
          <p className="text-[13px] font-black tracking-widest mt-1 text-black uppercase">Distributor Dimsum Ayam</p>
        </div>
        <div className="text-right text-[11px] font-bold leading-snug text-black max-w-[320px]">
          {docType === 'WO' && <h2 className="text-xl font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Work Order</h2>}
          {docType === 'DO' && <h2 className="text-xl font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Surat Jalan</h2>}
          {docType === 'CASH_VOUCHER' && <h2 className="text-xl font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Voucher Kas</h2>}
          {docType === 'PO' && <h2 className="text-xl font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Terima Barang</h2>}
          {docType === 'WITHDRAWAL' && <h2 className="text-xl font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Kwitansi Tunai</h2>}
          
          {showContactAndBank && (
            <div className="mt-1">
              <p>Jl. Thamrin Kp. Ketapang No.97,</p>
              <p>Cipondoh, Tangerang 15147</p>
              <p className="mt-0.5 font-black text-[13px] text-black">WA : 0878 0902 0931</p>
            </div>
          )}
        </div>
      </div>

      {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
        <>
          {/* INFO TRANSAKSI */}
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-1 w-[55%]">
              <div className="flex gap-2 text-sm"><span className="w-24 font-black text-black uppercase">NO REF</span><span className="font-black uppercase text-black">: {printData.id}</span></div>
              <div className="flex gap-2 text-sm"><span className="w-24 font-black text-black uppercase">TANGGAL</span><span className="font-black uppercase text-black">: {printData.date}</span></div>
              
              {docType === 'WO' && printData.targetDate && (
                <div className="flex gap-2 text-sm mt-2 bg-slate-100 px-2 py-1 rounded border border-black print:border-2 print:border-black print:bg-transparent">
                  <span className="w-24 font-black uppercase text-black">DEADLINE</span>
                  <span className="font-black uppercase text-base text-black">: {printData.targetDate}</span>
                </div>
              )}
            </div>
            
            <div className="text-right w-[45%]">
              <div className="text-[11px] font-black uppercase text-black">
                {docType === 'INVOICE' && 'PELANGGAN / AGEN:'}
                {docType === 'PO' && 'SUPPLIER:'}
                {docType === 'DO' && 'DIKIRIM KE TUJUAN:'}
                {docType === 'WO' && 'ATAS NAMA PESANAN:'}
              </div>
              <div className="text-xl font-black uppercase text-black max-w-[300px] leading-tight mt-0.5 ml-auto">
                {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM'}
              </div>
            </div>
          </div>

          {/* TABEL ITEM (Font diperbesar jadi text-sm) */}
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-y-[3px] border-black bg-slate-50 print:bg-transparent">
                <th className="py-2 px-2 text-left font-black w-10">NO</th>
                <th className="py-2 px-2 text-left font-black">DESKRIPSI ITEM</th>
                <th className="py-2 px-2 text-center font-black w-28">QTY</th>
                {['INVOICE', 'PO'].includes(docType) && (
                  <>
                    <th className="py-2 px-2 text-right font-black w-36">HARGA</th>
                    <th className="py-2 px-2 text-right font-black w-40">SUBTOTAL</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {printData.items?.map((item, idx) => {
                const hargaSatuan = item.price ? item.price : (item.subtotal && item.qty ? item.subtotal / item.qty : 0);
                
                return (
                  <tr key={idx} className="border-b-2 border-black border-dashed last:border-b-[3px] last:border-black">
                    <td className="py-3 px-2 text-center align-top font-bold text-black">{idx + 1}</td>
                    <td className="py-3 px-2 align-top font-black text-black">{item.name}</td>
                    
                    <td className="py-3 px-2 text-center align-top">
                      <div className="font-black text-base text-black">{formatNumber(item.qty)} <span className="text-[11px] font-bold text-black">{item.unit || 'Pcs'}</span></div>
                      {(!item.unit || item.unit === 'Pcs') && (
                        <div className="text-[10px] font-bold text-black mt-0.5">({formatNumber(item.qty / 4)} Porsi)</div>
                      )}
                    </td>

                    {['INVOICE', 'PO'].includes(docType) && (
                      <>
                        <td className="py-3 px-2 text-right align-top font-bold text-black">
                          {formatRupiah(hargaSatuan)}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-black text-base">
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
        <div className="border-[3px] border-black p-5 rounded-xl space-y-4 mb-6 bg-white print:rounded-none">
          <div className="flex gap-4 items-end border-b-2 border-dashed border-black pb-1">
            <div className="w-48 font-black uppercase text-sm text-black">NO REFERENSI</div>
            <div className="flex-1 font-black text-base uppercase text-black">: {printData.id} <span className="mx-2">|</span> TGL: {printData.date}</div>
          </div>
          <div className="flex gap-4 items-end border-b-2 border-dashed border-black pb-1">
            <div className="w-48 font-black uppercase text-sm text-black">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
            <div className="flex-1 font-black text-lg uppercase text-black">: {printData.customer_name || printData.person_name || '-'}</div>
          </div>
          <div className="flex gap-4 items-end border-b-2 border-dashed border-black pb-1">
            <div className="w-48 font-black uppercase text-sm text-black">UANG SEJUMLAH</div>
            <div className="flex-1 font-black text-2xl uppercase text-black">: {formatRupiah(printData.amount)}</div>
          </div>
          <div className="flex gap-4 items-start border-b-2 border-dashed border-black pb-2 p-3 bg-slate-100 border-[3px] border-black mt-4 print:bg-transparent print:rounded-none">
            <div className="w-44 font-black uppercase text-sm mt-0.5 text-black">TERBILANG</div>
            <div className="flex-1 font-black text-lg uppercase italic text-black leading-tight"># {angkaTerbilang(printData.amount)} #</div>
          </div>
          <div className="flex gap-4 items-start pt-2">
            <div className="w-48 font-black uppercase text-sm text-black">UNTUK KEPERLUAN</div>
            <div className="flex-1 font-bold text-sm uppercase text-black break-words">: {printData.notes || printData.description || '-'}</div>
          </div>
        </div>
      )}

      {/* METODE & TOTAL */}
      <div className="flex justify-between items-start gap-6">
        
        <div className="flex-1 space-y-3">
          {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
            <div>
              <div className="text-[11px] font-black text-black uppercase">Catatan / Metode:</div>
              <div className="font-bold text-sm uppercase text-black whitespace-pre-wrap leading-tight mt-0.5">{printData.notes || printData.paymentMethod}</div>
            </div>
          )}
          {showContactAndBank && (
            <div className="text-[11px] font-black uppercase space-y-0.5 mt-3 pt-3 border-t-2 border-black text-black">
              <p className="font-black text-black mb-1">INFO REKENING PEMBAYARAN:</p>
              <p className="text-sm">BCA : <span className="font-black">1320552261</span> ( WASTAM )</p>
              <p className="text-sm">BRI : <span className="font-black">775301006132536</span> ( WASTAM )</p>
            </div>
          )}
        </div>

        {['INVOICE', 'PO'].includes(docType) && (
          <div className="w-[340px]">
            <div className="bg-slate-100 border-[3px] border-black rounded-lg overflow-hidden print:bg-transparent print:rounded-none">
              {printData.history ? (
                <>
                  <div className="flex justify-between py-2 px-3 border-b-2 border-black text-xs font-black text-black">
                    <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                    <span className="font-black text-base text-black">{safeRupiah(printData.history.nominalLama)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 px-3 border-b-2 border-black bg-emerald-100 print:bg-transparent">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-black">{printData.history.labelAksi || 'SUDAH DIBAYAR'}</span>
                      <span className="text-[10px] font-bold text-black uppercase mt-0.5">VIA: {printData.paymentMethod?.split('+')[0] || 'TUNAI/TRANSFER'}</span>
                    </div>
                    <span className="font-black text-black text-base">{safeRupiah(printData.history.nominalAksi)}</span>
                  </div>

                  <div className="flex justify-between py-3 px-3 text-sm font-black uppercase bg-red-100 print:bg-transparent">
                    <span className="text-black">{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                    <span className="text-black text-lg">{safeRupiah(printData.history.nominalBaru)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-3 px-3 font-black text-base uppercase bg-slate-200 print:bg-transparent text-black">
                  <span>TOTAL</span>
                  <span className="text-xl">{formatRupiah(printData.amount)}</span>
                </div>
              )}
            </div>

            {printData.paymentHistory && printData.paymentHistory.length > 0 && (
              <div className="mt-3 text-[10px]">
                <div className="font-black text-black uppercase mb-1 border-b-2 border-black pb-1">Riwayat Pembayaran Sebelumnya:</div>
                <div className="space-y-1">
                  {printData.paymentHistory.map((hist, i) => (
                    <div key={i} className="flex justify-between font-bold text-black">
                      <span className="w-20 leading-tight">{hist.date}</span>
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

      {/* TANDA TANGAN (Lebih Lega dan Jelas) */}
      <div className="flex justify-between items-end mt-8 text-black">
        <div className="text-center w-40">
          <div className="font-black text-[11px] mb-14 uppercase">
            {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
            {docType === 'WO' ? 'Kepala Dapur' : ''}
            {docType === 'PO' ? 'Supir Supplier' : ''}
            {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
          </div>
          <div className="border-b-2 border-black w-full mb-1.5"></div>
          <div className="text-[10px] font-black uppercase">Ttd & Nama Jelas</div>
        </div>
        
        {docType === 'DO' ? (
          <div className="text-center w-40">
            <div className="font-black text-[11px] mb-14 uppercase">Supir / Kurir</div>
            <div className="border-b-2 border-black w-full mb-1.5"></div>
            <div className="text-[10px] font-black uppercase">{printData.driver_name || '................'}</div>
          </div>
        ) : (
          <div className="text-center w-64 space-y-1">
            {docType === 'INVOICE' && (
              <p className="text-[11px] font-bold italic text-black">&quot;Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami.&quot;</p>
            )}
            <p className="font-black text-[12px] uppercase tracking-widest text-black mt-2">www.dimsumaditya.id</p>
          </div>
        )}

        <div className="text-center w-40">
          <div className="font-black text-[11px] mb-14 uppercase">
            {docType === 'DO' ? 'Bagian Gudang' : 'Admin Kasir'}
          </div>
          <div className="border-b-2 border-black w-full mb-1.5"></div>
          <div className="text-[10px] font-black uppercase">{printData.admin_name}</div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* 1. LAYER PREVIEW DI LAYAR MONITOR */}
      <div className="fixed inset-0 z-[99998] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:hidden">
        <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[98vh]">
          
          <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
              <Receipt size={18} className="text-blue-600" />
              Pratinjau Kertas 3-Ply LX-310 ({docType})
            </h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="p-3 md:p-6 overflow-y-auto custom-scrollbar flex-1 flex justify-center">
            <div className="bg-white shadow-xl border border-slate-300 p-6 md:p-8 w-full max-w-[21.49cm]">
              {renderDocument()}
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-4 shrink-0">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm border border-slate-200 cursor-pointer">
              Batal & Tutup
            </button>
            <button onClick={handlePrint} className="px-6 py-3 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm shadow-md cursor-pointer">
              <Printer size={18} /> Cetak ke Printer LX-310
            </button>
          </div>

        </div>
      </div>

      {/* 2. LAYER KHUSUS PRINTER (DI-PORTAL LANGSUNG KE BODY) */}
      {createPortal(
        <div id="print-portal-container" className="hidden print:block absolute left-0 top-0 bg-white m-0 z-[999999]" style={{ width: '21.49cm', height: '13.97cm', padding: '5mm 8mm', boxSizing: 'border-box', overflow: 'hidden' }}>
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
