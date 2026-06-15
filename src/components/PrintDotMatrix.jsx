import React, { useEffect } from 'react';
import { Printer, X, Receipt } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// Helper untuk format "Rp" secara aman (mencegah double Rp)
const safeRupiah = (val) => {
  if (!val) return 'Rp 0';
  const str = String(val);
  if (str.includes('Rp')) return str;
  const num = Number(str.replace(/\D/g, ''));
  return formatRupiah(num);
};

// ENGINE ANGKA TERBILANG OTOMATIS
function angkaTerbilang(angka) {
  const bilangan = Number(angka);
  if (isNaN(bilangan) || bilangan === 0) return "Nol Rupiah";
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";
  if (bilangan < 12) hasil = huruf[bilangan];
  else if (bilangan < 20) hasil = angkaTerbilang(bilangan - 10) + " Belas";
  else if (bilangan < 100) hasil = angkaTerbilang(Math.floor(bilangan / 10)) + " Puluh " + angkaTerbilang(bilangan % 10);
  else if (bilangan < 200) hasil = "Seratus " + angkaTerbilang(bilangan - 100);
  else if (bilangan < 1000) hasil = angkaTerbilang(Math.floor(bilangan / 100)) + " Ratus " + angkaTerbilang(bilangan % 100);
  else if (bilangan < 2000) hasil = "Seribu " + angkaTerbilang(bilangan - 1000);
  else if (bilangan < 1000000) hasil = angkaTerbilang(Math.floor(bilangan / 1000)) + " Ribu " + angkaTerbilang(bilangan % 1000);
  else if (bilangan < 1000000000) hasil = angkaTerbilang(Math.floor(bilangan / 1000000)) + " Juta " + angkaTerbilang(bilangan % 1000000);
  return hasil.trim() + " Rupiah";
}

export default function PrintDotMatrix({ printData, onClose }) {
  // Lock scroll layar belakang saat preview terbuka
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

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-transparent print:backdrop-blur-none">
      
      {/* ========================================================================= */}
      {/* 🚀 CSS SAKTI ANTI BLANK PUTIH UNTUK PRINTER DOT MATRIX EPSON LX-310 🚀    */}
      {/* ========================================================================= */}
      <style type="text/css" media="print">
        {`
          /* Mengikuti Settingan Printer Bos: Width 21.49 cm, Height 13.97 cm, Margin 0 */
          @page { 
            size: 21.49cm 13.97cm; 
            margin: 0; 
          }
          
          /* Netralkan semua layout Tailwind yang bikin Chrome nge-blank */
          html, body, #root, .fixed, .absolute, .inset-0 { 
            position: static !important;
            overflow: visible !important; 
            height: auto !important; 
            width: auto !important;
            background-color: white !important; 
          }
          
          /* Sembunyikan SEMUA elemen di layar secara paksa */
          body * { 
            visibility: hidden; 
          }
          
          /* Tampilkan HANYA area ID print-section dan anak-anaknya */
          #print-section, #print-section * { 
            visibility: visible; 
            color: black !important;
          }
          
          /* Kunci posisi area cetak pas di pojok kiri atas kertas fisik */
          #print-section { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 21.49cm !important; 
            height: 13.97cm !important; /* Kunci tinggi biar gak tembus lembar ke-2 */
            margin: 0 !important; 
            padding: 5mm 8mm !important; /* Safe area agar jarum gak nabrak ujung kertas */
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important; 
          }
          
          /* Sembunyikan elemen modal & tombol saat print */
          .no-print { display: none !important; }
        `}
      </style>

      {/* CONTAINER MODAL DI LAYAR PC */}
      <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[98vh] print:shadow-none print:border-none print:w-full print:max-h-none print:rounded-none">
        
        {/* HEADER MODAL */}
        <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 no-print">
          <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
            <Receipt size={18} className="text-blue-600" />
            Pratinjau Kertas 3-Ply LX-310 ({docType})
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* AREA SCROLL PREVIEW */}
        <div className="p-2 md:p-6 overflow-y-auto custom-scrollbar flex-1 flex justify-center print:p-0 print:overflow-visible">
          
          {/* ========================================================= */}
          {/* 🖨️ AREA KERTAS (YANG AKAN MASUK PRINTER)                   */}
          {/* ========================================================= */}
          <div id="print-section" className="bg-white shadow-md p-6 md:p-8 text-black font-sans w-full max-w-[21.49cm] relative">
            
            {/* KOP SURAT */}
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-3">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-slate-900">Dimsum Aditya</h1>
                <p className="text-[10px] font-bold tracking-widest mt-0.5 text-slate-600 uppercase">Distributor Dimsum Ayam</p>
              </div>
              <div className="text-right text-[9px] font-bold leading-tight text-slate-800 max-w-[280px]">
                {docType === 'WO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded">Work Order</h2>}
                {docType === 'DO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded">Surat Jalan</h2>}
                {docType === 'CASH_VOUCHER' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded">Voucher Kas</h2>}
                {docType === 'PO' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded">Terima Barang</h2>}
                {docType === 'WITHDRAWAL' && <h2 className="text-base font-black mb-1 bg-slate-800 text-white px-2 py-0.5 uppercase inline-block rounded">Kwitansi Tunai</h2>}
                
                {showContactAndBank && (
                  <div className="mt-1">
                    <p>Jl. Thamrin Kp. Ketapang No.97,</p>
                    <p>Cipondoh, Tangerang 15147</p>
                    <p className="mt-0.5 font-black text-xs text-slate-900">WA : 0878 0902 0931</p>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================== */}
            {/* RENDER INVOICE / PO / DO / WO              */}
            {/* ========================================== */}
            {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
              <>
                {/* INFO TRANSAKSI (Tanpa Tulisan ADMIN di kiri) */}
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
                    </div>
                    <div className="text-base font-black uppercase text-slate-900 max-w-[250px] leading-none mt-0.5">
                      {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM'}
                    </div>
                  </div>
                </div>

                {/* TABEL ITEM (Di-press marginnya biar hemat kertas) */}
                <table className="w-full text-xs border-collapse mb-3">
                  <thead>
                    <tr className="border-y-2 border-slate-800 bg-slate-50 print:bg-transparent">
                      <th className="py-1.5 px-2 text-left font-black w-8">NO</th>
                      <th className="py-1.5 px-2 text-left font-black">DESKRIPSI ITEM</th>
                      <th className="py-1.5 px-2 text-center font-black w-24">QTY</th>
                      {['INVOICE', 'PO'].includes(docType) && (
                        <>
                          <th className="py-1.5 px-2 text-right font-black w-28">HARGA</th>
                          <th className="py-1.5 px-2 text-right font-black w-32">SUBTOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items?.map((item, idx) => {
                      // Logic pencarian Harga Satuan otomatis
                      const hargaSatuan = item.price ? item.price : (item.subtotal && item.qty ? item.subtotal / item.qty : 0);
                      
                      return (
                        <tr key={idx} className="border-b border-slate-300 border-dashed last:border-b-2 last:border-slate-800">
                          <td className="py-2 px-2 text-center align-top font-bold text-slate-600">{idx + 1}</td>
                          <td className="py-2 px-2 align-top font-bold text-slate-900">{item.name}</td>
                          
                          <td className="py-2 px-2 text-center align-top">
                            <div className="font-black text-sm text-slate-900">{formatNumber(item.qty)} <span className="text-[9px] font-bold text-slate-600">{item.unit || 'Pcs'}</span></div>
                            {(!item.unit || item.unit === 'Pcs') && (
                              <div className="text-[8px] font-bold text-slate-500">({formatNumber(item.qty / 4)} Porsi)</div>
                            )}
                          </td>

                          {['INVOICE', 'PO'].includes(docType) && (
                            <>
                              <td className="py-2 px-2 text-right align-top font-bold text-slate-800">
                                {formatRupiah(hargaSatuan)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-slate-900 text-sm">
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

            {/* ========================================== */}
            {/* AREA BAWAH: METODE, REKENING & RINGKASAN   */}
            {/* ========================================== */}
            <div className="flex justify-between items-start gap-4">
              
              {/* KIRI: METODE & REKENING */}
              <div className="flex-1 space-y-2">
                {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Catatan / Metode:</div>
                    <div className="font-bold text-xs uppercase text-slate-900 whitespace-pre-wrap leading-tight mt-0.5">{printData.notes || printData.paymentMethod}</div>
                  </div>
                )}

                {showContactAndBank && (
                  <div className="text-[9px] font-bold uppercase space-y-0.5 mt-2 pt-2 border-t border-slate-300 text-slate-600">
                    <p className="font-black text-slate-900 mb-0.5">INFO REKENING PEMBAYARAN:</p>
                    <p>BCA : <span className="font-black text-slate-900 text-[10px]">1320552261</span> ( WASTAM )</p>
                    <p>BRI : <span className="font-black text-slate-900 text-[10px]">775301006132536</span> ( WASTAM )</p>
                  </div>
                )}
              </div>

              {/* KANAN: RINGKASAN TOTAL */}
              {['INVOICE', 'PO'].includes(docType) && (
                <div className="w-[280px]">
                  <div className="bg-slate-50 border border-slate-300 rounded-lg overflow-hidden print:bg-transparent print:rounded-none print:border-slate-800">
                    {printData.history ? (
                      <>
                        <div className="flex justify-between py-1.5 px-3 border-b border-slate-200 text-[10px] font-bold text-slate-600">
                          <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                          <span className="font-black text-slate-900">{safeRupiah(printData.history.nominalLama)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-1.5 px-3 border-b border-slate-200 bg-emerald-50/50 print:bg-transparent">
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

                  {/* RIWAYAT CICILAN KLIP NOTA */}
                  {printData.paymentHistory && printData.paymentHistory.length > 0 && (
                    <div className="mt-2 text-[8px]">
                      <div className="font-black text-slate-500 uppercase mb-0.5 border-b border-slate-300 pb-0.5">Riwayat Pembayaran:</div>
                      <div className="space-y-0.5">
                        {printData.paymentHistory.map((hist, i) => (
                          <div key={i} className="flex justify-between font-bold text-slate-700">
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

            {/* ========================================== */}
            {/* TANDA TANGAN FOOTER                        */}
            {/* ========================================== */}
            <div className="flex justify-between items-end mt-6 text-slate-800">
              
              <div className="text-center w-32">
                <div className="font-bold text-[9px] mb-10 uppercase">
                  {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
                  {docType === 'WO' ? 'Kepala Dapur' : ''}
                  {docType === 'PO' ? 'Supir Supplier' : ''}
                  {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
                </div>
                <div className="border-b border-slate-800 w-full mb-1"></div>
                <div className="text-[8px] font-bold uppercase">Ttd & Nama Jelas</div>
              </div>
              
              {docType === 'DO' ? (
                <div className="text-center w-32">
                  <div className="font-bold text-[9px] mb-10 uppercase">Supir / Kurir</div>
                  <div className="border-b border-slate-800 w-full mb-1"></div>
                  <div className="text-[8px] font-bold uppercase">{printData.driver_name || '................'}</div>
                </div>
              ) : (
                <div className="text-center w-56 space-y-0.5">
                  {docType === 'INVOICE' && (
                    <p className="text-[9px] font-bold italic text-slate-500">"Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami."</p>
                  )}
                  <p className="font-black text-[10px] uppercase tracking-widest text-slate-900 mt-1">www.dimsumaditya.id</p>
                </div>
              )}

              <div className="text-center w-32">
                <div className="font-bold text-[9px] mb-10 uppercase">
                  {docType === 'DO' ? 'Bagian Gudang' : 'Admin Kasir'}
                </div>
                <div className="border-b border-slate-800 w-full mb-1"></div>
                <div className="text-[9px] font-bold uppercase">{printData.admin_name}</div>
              </div>

            </div>

          </div>
        </div>

        {/* FOOTER MODAL (TOMBOL CETAK) */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 no-print">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs border border-slate-200 cursor-pointer">
            Batal & Tutup
          </button>
          <button onClick={handlePrint} className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs shadow-md cursor-pointer">
            <Printer size={16} /> Cetak ke Printer LX-310
          </button>
        </div>

      </div>
    </div>
  );
}
