import React, { useEffect } from 'react';
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
    // Dihapus efek backdrop-blur-sm karena itu penyebab Chrome Error Blank Putih
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 flex items-center justify-center p-2 sm:p-4 print:static print:bg-transparent print:p-0">
      
      {/* CSS SAKTI ANTI BLANK & AUTO-FIT KERTAS SETENGAH */}
      <style type="text/css" media="print">
        {`
          @page { size: 21.49cm 13.97cm; margin: 0; }
          html, body { background-color: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          
          /* Sembunyikan SEMUA elemen UI React */
          body * { visibility: hidden; }
          
          /* Tampilkan HANYA section kertas */
          #print-section, #print-section * { 
            visibility: visible; 
            color: black !important; 
          }
          
          /* Cabut paksa area print dan kunci di pojok kiri atas kertas */
          #print-section { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 21.49cm !important; 
            margin: 0 !important; 
            padding: 5mm 8mm !important; 
            background: white !important;
            border: none !important;
            box-shadow: none !important;
          }
          
          .no-print { display: none !important; }
        `}
      </style>

      {/* CONTAINER MODAL PREVIEW */}
      <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[98vh] print:shadow-none print:border-none print:w-full print:max-h-none print:overflow-visible">
        
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
          {/* Format di-press agar muat 3-4 item tanpa lompat kertas    */}
          {/* ========================================================= */}
          <div id="print-section" className="bg-white shadow-md p-6 text-black w-full max-w-[21.49cm] relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            
            {/* KOP SURAT */}
            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-2">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-black">Dimsum Aditya</h1>
                <p className="text-[10px] font-black tracking-widest mt-1 text-black uppercase">Distributor Dimsum Ayam</p>
              </div>
              <div className="text-right text-[10px] font-bold leading-tight text-black max-w-[280px]">
                {docType === 'WO' && <h2 className="text-sm font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Work Order</h2>}
                {docType === 'DO' && <h2 className="text-sm font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Surat Jalan</h2>}
                {docType === 'CASH_VOUCHER' && <h2 className="text-sm font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Voucher Kas</h2>}
                {docType === 'PO' && <h2 className="text-sm font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Terima Barang</h2>}
                {docType === 'WITHDRAWAL' && <h2 className="text-sm font-black mb-1 bg-black text-white px-2 py-0.5 uppercase inline-block rounded print:text-black print:border-2 print:border-black print:bg-transparent">Kwitansi Tunai</h2>}
                
                {showContactAndBank && (
                  <div className="mt-1">
                    <p>Jl. Thamrin Kp. Ketapang No.97,</p>
                    <p>Cipondoh, Tangerang 15147</p>
                    <p className="mt-0.5 font-black text-[11px] text-black">WA : 0878 0902 0931</p>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================== */}
            {/* RENDER INVOICE / PO / DO / WO              */}
            {/* ========================================== */}
            {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
              <>
                {/* INFO TRANSAKSI (Dihapus tulisan ADMIN di atas) */}
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-0.5 w-1/2">
                    <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-black uppercase">NO REF</span><span className="font-black uppercase text-black">: {printData.id}</span></div>
                    <div className="flex gap-2 text-xs"><span className="w-20 font-bold text-black uppercase">TANGGAL</span><span className="font-black uppercase text-black">: {printData.date}</span></div>
                    
                    {docType === 'WO' && printData.targetDate && (
                      <div className="flex gap-2 text-xs mt-1 bg-slate-100 px-2 py-0.5 rounded border border-black print:border-2 print:border-black print:bg-transparent">
                        <span className="w-20 font-black uppercase text-black">DEADLINE</span>
                        <span className="font-black uppercase text-sm text-black">: {printData.targetDate}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
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

                {/* TABEL ITEM (COMPACT: py-1.5 agar muat banyak) */}
                <table className="w-full text-xs border-collapse mb-3">
                  <thead>
                    <tr className="border-y-2 border-black bg-slate-50 print:bg-transparent">
                      <th className="py-1 px-2 text-left font-black w-8">NO</th>
                      <th className="py-1 px-2 text-left font-black">DESKRIPSI ITEM</th>
                      <th className="py-1 px-2 text-center font-black w-24">QTY</th>
                      {['INVOICE', 'PO'].includes(docType) && (
                        <>
                          <th className="py-1 px-2 text-right font-black w-28">HARGA</th>
                          <th className="py-1 px-2 text-right font-black w-32">SUBTOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items?.map((item, idx) => {
                      const hargaSatuan = item.price ? item.price : (item.subtotal && item.qty ? item.subtotal / item.qty : 0);
                      
                      return (
                        <tr key={idx} className="border-b border-black border-dashed last:border-b-2 last:border-black">
                          <td className="py-1.5 px-2 text-center align-top font-bold text-black">{idx + 1}</td>
                          <td className="py-1.5 px-2 align-top font-bold text-black">{item.name}</td>
                          
                          <td className="py-1.5 px-2 text-center align-top">
                            <div className="font-black text-sm text-black">{formatNumber(item.qty)} <span className="text-[9px] font-bold text-black">{item.unit || 'Pcs'}</span></div>
                            {(!item.unit || item.unit === 'Pcs') && (
                              <div className="text-[8px] font-bold text-black">({formatNumber(item.qty / 4)} Porsi)</div>
                            )}
                          </td>

                          {['INVOICE', 'PO'].includes(docType) && (
                            <>
                              <td className="py-1.5 px-2 text-right align-top font-bold text-black">
                                {formatRupiah(hargaSatuan)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-black text-black text-sm">
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
            {/* RENDER CASH VOUCHER / KWITANSI             */}
            {/* ========================================== */}
            {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
              <div className="border-2 border-black p-4 rounded-xl space-y-3 mb-6 bg-white print:rounded-none">
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs text-black">NO REFERENSI</div>
                  <div className="flex-1 font-black text-sm uppercase text-black">: {printData.id} <span className="mx-2">|</span> TGL: {printData.date}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs text-black">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
                  <div className="flex-1 font-black text-sm uppercase text-black">: {printData.customer_name || printData.person_name || '-'}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs text-black">UANG SEJUMLAH</div>
                  <div className="flex-1 font-black text-lg uppercase text-black">: {formatRupiah(printData.amount)}</div>
                </div>
                <div className="flex gap-4 items-start border-b border-dashed border-black pb-1 p-2 bg-slate-100 border border-black mt-3 print:bg-transparent print:border-black print:border-2 print:rounded-none">
                  <div className="w-36 font-black uppercase text-xs mt-0.5 text-black">TERBILANG</div>
                  <div className="flex-1 font-black text-sm uppercase italic text-black leading-tight"># {angkaTerbilang(printData.amount)} #</div>
                </div>
                <div className="flex gap-4 items-start pt-1">
                  <div className="w-40 font-black uppercase text-xs text-black">UNTUK KEPERLUAN</div>
                  <div className="flex-1 font-bold text-xs uppercase text-black break-words">: {printData.notes || printData.description || '-'}</div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* AREA BAWAH: METODE, REKENING & RINGKASAN   */}
            {/* ========================================== */}
            <div className="flex justify-between items-start gap-4">
              
              {/* KIRI: METODE & REKENING */}
              <div className="flex-1 space-y-2">
                {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
                  <div>
                    <div className="text-[9px] font-black text-black uppercase">Catatan / Metode:</div>
                    <div className="font-bold text-xs uppercase text-black whitespace-pre-wrap leading-tight mt-0.5">{printData.notes || printData.paymentMethod}</div>
                  </div>
                )}

                {showContactAndBank && (
                  <div className="text-[9px] font-black uppercase space-y-0.5 mt-2 pt-2 border-t border-black text-black">
                    <p className="font-black text-black mb-0.5">INFO REKENING PEMBAYARAN:</p>
                    <p>BCA : <span className="font-black text-black text-[10px]">1320552261</span> ( WASTAM )</p>
                    <p>BRI : <span className="font-black text-black text-[10px]">775301006132536</span> ( WASTAM )</p>
                  </div>
                )}
              </div>

              {/* KANAN: RINGKASAN TOTAL COMPACT */}
              {['INVOICE', 'PO'].includes(docType) && (
                <div className="w-[300px]">
                  
                  <div className="bg-slate-50 border-2 border-black rounded-lg overflow-hidden print:bg-transparent print:rounded-none">
                    {printData.history ? (
                      <>
                        <div className="flex justify-between py-1.5 px-2 border-b border-black text-[10px] font-black text-black">
                          <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                          <span className="font-black text-sm text-black">{safeRupiah(printData.history.nominalLama)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-1.5 px-2 border-b border-black bg-emerald-100 print:bg-transparent">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-black">{printData.history.labelAksi || 'SUDAH DIBAYAR'}</span>
                            <span className="text-[8px] font-bold text-black uppercase mt-0.5">VIA: {printData.paymentMethod?.split('+')[0] || 'TUNAI/TRANSFER'}</span>
                          </div>
                          <span className="font-black text-black text-sm">{safeRupiah(printData.history.nominalAksi)}</span>
                        </div>

                        <div className="flex justify-between py-2 px-2 text-xs font-black uppercase bg-red-100 print:bg-transparent">
                          <span className="text-black">{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                          <span className="text-black text-base">{safeRupiah(printData.history.nominalBaru)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-2 px-3 font-black text-sm uppercase bg-slate-200 print:bg-transparent text-black">
                        <span>TOTAL</span>
                        <span className="text-lg">{formatRupiah(printData.amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* RIWAYAT CICILAN KLIP NOTA */}
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

            {/* ========================================== */}
            {/* TANDA TANGAN FOOTER                        */}
            {/* ========================================== */}
            <div className="flex justify-between items-end mt-6 text-black">
              
              <div className="text-center w-32">
                <div className="font-bold text-[9px] mb-10 uppercase">
                  {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
                  {docType === 'WO' ? 'Kepala Dapur' : ''}
                  {docType === 'PO' ? 'Supir Supplier' : ''}
                  {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
                </div>
                <div className="border-b border-black w-full mb-1"></div>
                <div className="text-[8px] font-bold uppercase">Ttd & Nama Jelas</div>
              </div>
              
              {docType === 'DO' ? (
                <div className="text-center w-32">
                  <div className="font-bold text-[9px] mb-10 uppercase">Supir / Kurir</div>
                  <div className="border-b border-black w-full mb-1"></div>
                  <div className="text-[8px] font-bold uppercase">{printData.driver_name || '................'}</div>
                </div>
              ) : (
                <div className="text-center w-56 space-y-0.5">
                  {docType === 'INVOICE' && (
                    <p className="text-[9px] font-bold italic text-black">"Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami."</p>
                  )}
                  <p className="font-black text-[10px] uppercase tracking-widest text-black mt-1">www.dimsumaditya.id</p>
                </div>
              )}

              <div className="text-center w-32">
                <div className="font-bold text-[9px] mb-10 uppercase">
                  {docType === 'DO' ? 'Bagian Gudang' : 'Admin Kasir'}
                </div>
                <div className="border-b border-black w-full mb-1"></div>
                <div className="text-[8px] font-bold uppercase">{printData.admin_name}</div>
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
