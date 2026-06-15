import React from 'react';
import { Printer, X } from 'lucide-react';

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
  if (!printData) return null;

  const handlePrint = () => window.print();
  const docType = printData.type || 'INVOICE'; 
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[95vh] print:shadow-none print:border-none print:w-full print:max-h-none print:rounded-none">
        
        {/* HEADER MODAL PREVIEW */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0 no-print">
          <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
            <Printer size={16} className="text-blue-600" />
            Pratinjau Kertas 3-Ply LX-310 ({docType})
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* AREA KERTAS (YANG AKAN MASUK PRINTER) */}
        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-200 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          <div id="print-section" className="bg-white shadow-md border border-slate-300 p-6 text-black font-sans w-full max-w-[21.5cm] relative print:shadow-none print:border-none print:p-0 print:m-0 print:w-full">
            
            {/* CSS SAKTI ANTI BLANK PUTIH */}
            <style type="text/css" media="print">
              {`
                @page { size: 21.5cm 14cm; margin: 5mm; }
                body { background-color: #ffffff !important; margin: 0; padding: 0; color: #000 !important; }
                
                /* Sembunyikan semua elemen UI React */
                body * { visibility: hidden; }
                
                /* Cabut paksa area print dan letakkan di pojok atas kertas */
                #print-section, #print-section * { 
                  visibility: visible; 
                  color: #000 !important; 
                  background-color: transparent !important;
                }
                #print-section { 
                  position: fixed; 
                  left: 0; 
                  top: 0; 
                  width: 100vw; 
                  margin: 0; 
                  padding: 0; 
                }
                
                .no-print { display: none !important; }
              `}
            </style>

            {/* KOP SURAT GLOBAL */}
            <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-wide leading-none text-black">Dimsum Aditya</h1>
                <p className="text-xs font-bold tracking-widest mt-0.5 text-black">Distributor Dimsum Ayam</p>
              </div>
              <div className="text-right text-[10px] font-bold leading-tight text-black max-w-[280px]">
                {docType === 'WO' && <h2 className="text-xl font-black mb-1 border-2 border-black px-2 py-0.5 uppercase inline-block">Work Order</h2>}
                {docType === 'DO' && <h2 className="text-xl font-black mb-1 border-2 border-black px-2 py-0.5 uppercase inline-block">Surat Jalan</h2>}
                {docType === 'CASH_VOUCHER' && <h2 className="text-lg font-black mb-1 border-2 border-black px-2 py-0.5 uppercase inline-block">Voucher Kas</h2>}
                {docType === 'PO' && <h2 className="text-lg font-black mb-1 border-2 border-black px-2 py-0.5 uppercase inline-block">Terima Barang</h2>}
                {docType === 'WITHDRAWAL' && <h2 className="text-lg font-black mb-1 border-2 border-black px-2 py-0.5 uppercase inline-block">Kwitansi Tunai</h2>}
                
                {showContactAndBank && (
                  <div className="mt-1">
                    <p>Jl. Thamrin Kp. Ketapang No.97,</p>
                    <p>Cipondoh, Tangerang 15147</p>
                    <p className="mt-0.5 font-black text-xs">Tlp/Wa : 0878 0902 0931</p>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================== */}
            {/* RENDER INVOICE / PO / DO / WO              */}
            {/* ========================================== */}
            {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-0.5 w-1/2">
                    <div className="flex gap-2 text-xs"><span className="w-24 font-black uppercase">NO REFERENSI</span><span className="font-bold uppercase">: {printData.id}</span></div>
                    <div className="flex gap-2 text-xs"><span className="w-24 font-black uppercase">TANGGAL</span><span className="font-bold uppercase">: {printData.date}</span></div>
                    <div className="flex gap-2 text-xs"><span className="w-24 font-black uppercase">ADMIN/OPR</span><span className="font-bold uppercase">: {printData.admin_name}</span></div>
                    
                    {docType === 'WO' && printData.targetDate && (
                      <div className="flex gap-2 text-xs mt-1 p-1 border-2 border-black inline-block">
                        <span className="w-24 font-black uppercase">TARGET SELESAI</span>
                        <span className="font-black uppercase text-sm">: {printData.targetDate}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-1/2 flex justify-end">
                    <div className="border-2 border-black p-2 rounded-lg min-w-[220px] max-w-xs">
                      {docType === 'INVOICE' && <div className="text-[9px] font-bold uppercase mb-0.5">Pelanggan/Agen:</div>}
                      {docType === 'PO' && <div className="text-[9px] font-bold uppercase mb-0.5">Nama Supplier:</div>}
                      {docType === 'DO' && <div className="text-[9px] font-bold uppercase mb-0.5">Dikirim Ke Tujuan:</div>}
                      {docType === 'WO' && <div className="text-[9px] font-bold uppercase mb-0.5">Atas Nama Pesanan:</div>}
                      <div className="text-sm font-black uppercase break-words leading-tight">
                        {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM / INTERNAL'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABEL ITEM (Desain Murni Hitam Putih Kotak) */}
                <table className="w-full text-xs border-collapse border-2 border-black mb-3">
                  <thead className="border-b-2 border-black">
                    <tr>
                      <th className="py-1.5 px-2 text-left border-r-2 border-black font-black w-8">NO</th>
                      <th className="py-1.5 px-2 text-left border-r-2 border-black font-black">NAMA BARANG / ITEM</th>
                      <th className="py-1.5 px-2 text-center border-r-2 border-black font-black w-24">QTY</th>
                      {['INVOICE', 'PO'].includes(docType) && (
                        <>
                          <th className="py-1.5 px-2 text-right border-r-2 border-black font-black w-32">HARGA</th>
                          <th className="py-1.5 px-2 text-right font-black w-36">SUBTOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="font-bold border-b-2 border-black">
                    {printData.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-black border-dashed last:border-none">
                        <td className="py-1.5 px-2 border-r-2 border-black text-center align-top">{idx + 1}</td>
                        <td className="py-1.5 px-2 border-r-2 border-black align-top">{item.name}</td>
                        
                        {/* KONVERSI PCS & PORSI */}
                        <td className="py-1.5 px-2 text-center border-r-2 border-black align-top">
                          <div className="font-black">{formatNumber(item.qty)} {item.unit || 'Pcs'}</div>
                          {(!item.unit || item.unit === 'Pcs') && (
                            <div className="text-[9px] mt-0.5">({formatNumber(item.qty / 4)} Porsi)</div>
                          )}
                        </td>

                        {['INVOICE', 'PO'].includes(docType) && (
                          <>
                            <td className="py-1.5 px-2 text-right border-r-2 border-black align-top">
                              {item.price ? formatRupiah(item.price) : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-black align-top">
                              {formatRupiah(item.subtotal)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ========================================== */}
            {/* RENDER CASH VOUCHER / KWITANSI             */}
            {/* ========================================== */}
            {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
              <div className="border-2 border-black p-4 rounded-lg space-y-4 mb-6">
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs">NO REFERENSI</div>
                  <div className="flex-1 font-bold text-sm uppercase">: {printData.id} | TGL: {printData.date}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
                  <div className="flex-1 font-bold text-sm uppercase">: {printData.customer_name || printData.person_name || '-'}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-1">
                  <div className="w-40 font-black uppercase text-xs">UANG SEJUMLAH</div>
                  <div className="flex-1 font-black text-lg uppercase">: {formatRupiah(printData.amount)}</div>
                </div>
                <div className="flex gap-4 items-start border-b border-dashed border-black pb-1 p-2 border-2 border-black mt-3">
                  <div className="w-40 font-black uppercase text-xs mt-0.5">TERBILANG</div>
                  <div className="flex-1 font-black text-sm uppercase italic text-black leading-tight"># {angkaTerbilang(printData.amount)} #</div>
                </div>
                <div className="flex gap-4 items-start pt-1">
                  <div className="w-40 font-black uppercase text-xs">UNTUK PEMBAYARAN</div>
                  <div className="flex-1 font-bold text-xs uppercase break-words">: {printData.notes || printData.description || '-'}</div>
                </div>
              </div>
            )}


            {/* ========================================== */}
            {/* FOOTER: METODE, REKENING & TOTAL           */}
            {/* ========================================== */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                
                {/* CATATAN & METODE (Hitam Putih Murni) */}
                {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
                  <div className="border-2 border-black p-2 rounded-lg text-[10px] font-bold min-h-[40px]">
                    <p className="uppercase mb-0.5 underline font-black">CATATAN TRANSAKSI / METODE:</p>
                    <p className="uppercase font-black whitespace-pre-wrap">{printData.notes || printData.paymentMethod}</p>
                  </div>
                )}

                {/* INFO REKENING BANK */}
                {showContactAndBank && (
                  <div className="text-[10px] font-black uppercase space-y-0.5 border-2 border-black p-2 inline-block">
                    <p className="border-b border-black pb-0.5 mb-0.5">PEMBAYARAN RESMI DITRANSFER MELALUI:</p>
                    <p>BCA : 1320552261 ( WASTAM )</p>
                    <p>BRI : 775301006132536 ( WASTAM )</p>
                  </div>
                )}
              </div>

              {/* RINCIAN TOTAL (INVOICE / PO) */}
              {['INVOICE', 'PO'].includes(docType) && (
                <div className="w-[300px]">
                  
                  {/* TEKNIK KLIP NOTA (RIWAYAT PEMBAYARAN) */}
                  {printData.paymentHistory && printData.paymentHistory.length > 0 && (
                    <div className="border-2 border-black border-b-0 text-[9px]">
                      <div className="text-center font-black py-1 border-b-2 border-black uppercase">Riwayat Pembayaran</div>
                      <div className="p-1.5 font-bold uppercase space-y-1">
                        {printData.paymentHistory.map((hist, i) => (
                          <div key={i} className="flex justify-between border-b border-dashed border-black pb-0.5 mb-0.5 last:border-0 last:mb-0 last:pb-0">
                            <span className="w-24 leading-tight">{hist.date} <br/> <span className="font-mono text-[8px]">{hist.refId}</span></span>
                            <span className="flex-1 px-1 break-words">{hist.method}</span>
                            <span className="w-20 text-right">{safeRupiah(hist.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KOTAK REKAP TOTAL (Bebas warna abu-abu) */}
                  <div className="border-2 border-black text-[11px]">
                    {printData.history ? (
                      <>
                        <div className="flex justify-between py-1.5 px-2 border-b border-black font-black uppercase">
                          <span>{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                          <span>{safeRupiah(printData.history.nominalLama)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 px-2 border-b border-black font-black uppercase">
                          <span>{printData.history.labelAksi || 'TOTAL SUDAH DIBAYAR'}</span>
                          <span>{safeRupiah(printData.history.nominalAksi)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-2 text-sm font-black uppercase">
                          <span>{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                          <span>{safeRupiah(printData.history.nominalBaru)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-2 px-3 font-black text-sm uppercase">
                        <span>GRAND TOTAL</span>
                        <span>{formatRupiah(printData.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* TANDA TANGAN (Dikurangi marginnya biar hemat kertas) */}
            {/* ========================================== */}
            <div className="flex justify-between items-end mt-6 px-2 text-black">
              
              <div className="text-center w-36">
                <div className="font-bold text-[10px] mb-12 uppercase">
                  {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
                  {docType === 'WO' ? 'Kepala Dapur' : ''}
                  {docType === 'PO' ? 'Supir Supplier' : ''}
                  {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
                </div>
                <div className="border-b-2 border-black w-full mb-1"></div>
                <div className="text-[9px] font-black uppercase">Ttd & Nama Jelas</div>
              </div>
              
              {docType === 'DO' ? (
                <div className="text-center w-36">
                  <div className="font-bold text-[10px] mb-12 uppercase">Supir / Kurir</div>
                  <div className="border-b-2 border-black w-full mb-1"></div>
                  <div className="text-[9px] font-black uppercase">{printData.driver_name || '................'}</div>
                </div>
              ) : (
                <div className="text-center w-56 space-y-1 mb-1">
                  {docType === 'INVOICE' && (
                    <p className="text-[9px] font-bold italic text-center">"Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami."</p>
                  )}
                  <p className="font-black text-[10px] uppercase">www.dimsumaditya.id</p>
                </div>
              )}

              <div className="text-center w-36">
                <div className="font-bold text-[10px] mb-12 uppercase">
                  {docType === 'DO' ? 'Bagian Gudang' : 'Admin / Kasir'}
                </div>
                <div className="border-b-2 border-black w-full mb-1"></div>
                <div className="text-[9px] font-black uppercase">{printData.admin_name}</div>
              </div>

            </div>

          </div>
        </div>

        {/* FOOTER MODAL (TOMBOL CETAK) */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0 no-print">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors text-sm border border-slate-300 cursor-pointer">
            Tutup Preview
          </button>
          <button onClick={handlePrint} className="flex-1 py-3.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer">
            <Printer size={18} /> Cetak ke Epson LX-310
          </button>
        </div>

      </div>
    </div>
  );
}
