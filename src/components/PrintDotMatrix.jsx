import React from 'react';
import { Printer, X } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// ENGINE ANGKA TERBILANG OTOMATIS UNTUK KWITANSI/VOUCHER
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
  else if (bilangan < 1000000000000) hasil = angkaTerbilang(Math.floor(bilangan / 1000000000)) + " Milyar " + angkaTerbilang(bilangan % 1000000000);
  return hasil.trim() + " Rupiah";
}

export default function PrintDotMatrix({ printData, onClose }) {
  if (!printData) return null;

  const handlePrint = () => window.print();

  // Jika tidak ada type yang dikirim, otomatis fallback ke INVOICE (menjaga kompatibilitas fitur lama)
  const docType = printData.type || 'INVOICE'; 

  // Kondisi apakah dokumen ini menampilkan rekening bank & kontak WA
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[95vh] print:shadow-none print:border-none print:w-full print:max-h-none">
        
        {/* HEADER MODAL PREVIEW (Disembunyikan saat print) */}
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
        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-200 flex justify-center print:p-0 print:bg-white">
          <div id="print-section" className="bg-white shadow-md border border-slate-300 p-8 text-black font-sans w-full max-w-[21.5cm] min-h-[14cm] relative print:shadow-none print:border-none print:p-2 print:m-0 print:w-full">
            
            <style type="text/css" media="print">
              {`
                @page { size: 21.5cm 14cm; margin: 3mm; }
                body { background-color: #ffffff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body * { visibility: hidden; }
                #print-section, #print-section * { visibility: visible; }
                #print-section { position: absolute; left: 0; top: 0; width: 100%; }
                .no-print { display: none !important; }
              `}
            </style>

            {/* KOP SURAT GLOBAL */}
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide leading-none text-black">Dimsum Aditya</h1>
                <p className="text-sm font-bold tracking-widest mt-1 text-black">Distributor Dimsum Ayam</p>
              </div>
              <div className="text-right text-xs font-bold leading-tight text-black max-w-[300px]">
                {docType === 'WO' && <h2 className="text-2xl font-black mb-1 border-2 border-black px-3 py-1 uppercase">Work Order</h2>}
                {docType === 'DO' && <h2 className="text-2xl font-black mb-1 border-2 border-black px-3 py-1 uppercase">Surat Jalan</h2>}
                {docType === 'CASH_VOUCHER' && <h2 className="text-xl font-black mb-1 border-2 border-black px-3 py-1 uppercase">Voucher Kas</h2>}
                {docType === 'PO' && <h2 className="text-xl font-black mb-1 border-2 border-black px-3 py-1 uppercase">Terima Barang</h2>}
                {docType === 'WITHDRAWAL' && <h2 className="text-xl font-black mb-1 border-2 border-black px-3 py-1 uppercase">Kwitansi Tunai</h2>}
                
                {/* Kontak hanya muncul jika ini dokumen penagihan uang masuk */}
                {showContactAndBank && (
                  <>
                    <p className="mt-2">Jl. Thamrin Kp. Ketapang No.97,</p>
                    <p>Cipondoh, Tangerang 15147</p>
                    <p className="mt-1 font-black text-sm">Tlp/Wa : 0878 0902 0931</p>
                  </>
                )}
              </div>
            </div>

            {/* ========================================== */}
            {/* RENDER DOKUMEN: INVOICE / PO / DO / WO     */}
            {/* ========================================== */}
            {['INVOICE', 'PO', 'DO', 'WO'].includes(docType) && (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1 w-1/2">
                    <div className="flex gap-2 text-sm"><span className="w-24 font-black uppercase">NO REFERENSI</span><span className="font-bold uppercase">: {printData.id}</span></div>
                    <div className="flex gap-2 text-sm"><span className="w-24 font-black uppercase">TANGGAL</span><span className="font-bold uppercase">: {printData.date}</span></div>
                    <div className="flex gap-2 text-sm"><span className="w-24 font-black uppercase">ADMIN/OPR</span><span className="font-bold uppercase">: {printData.admin_name}</span></div>
                    
                    {/* Tanggal Target Khusus WO Dapur */}
                    {docType === 'WO' && printData.targetDate && (
                      <div className="flex gap-2 text-sm mt-2 p-1 border border-black inline-block bg-slate-100">
                        <span className="w-24 font-black uppercase text-red-600">TARGET SELESAI</span>
                        <span className="font-black uppercase text-xl">: {printData.targetDate}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-1/2 flex justify-end">
                    <div className="border-2 border-black p-3 rounded-xl min-w-[250px] max-w-xs">
                      {docType === 'INVOICE' && <div className="text-[10px] font-bold uppercase mb-1">Pelanggan/Agen:</div>}
                      {docType === 'PO' && <div className="text-[10px] font-bold uppercase mb-1">Nama Supplier:</div>}
                      {docType === 'DO' && <div className="text-[10px] font-bold uppercase mb-1">Dikirim Ke Tujuan:</div>}
                      {docType === 'WO' && <div className="text-[10px] font-bold uppercase mb-1">Atas Nama Pesanan:</div>}
                      
                      <div className="text-base font-black uppercase break-words leading-tight">
                        {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM / INTERNAL'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABEL ITEM */}
                <table className="w-full text-sm border-collapse border-2 border-black mb-4">
                  <thead className="border-b-2 border-black">
                    <tr>
                      <th className="py-2.5 px-3 text-left border-r-2 border-black font-black w-10">NO</th>
                      <th className="py-2.5 px-3 text-left border-r-2 border-black font-black">NAMA BARANG / ITEM</th>
                      <th className="py-2.5 px-3 text-center border-r-2 border-black font-black w-24">QTY</th>
                      {['INVOICE', 'PO'].includes(docType) && (
                        <>
                          <th className="py-2.5 px-3 text-right border-r-2 border-black font-black w-32">HARGA</th>
                          <th className="py-2.5 px-3 text-right font-black w-40">SUBTOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="font-bold border-b-2 border-black">
                    {printData.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-black border-dashed last:border-none">
                        <td className="py-2.5 px-3 border-r-2 border-black text-center">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-r-2 border-black">{item.name}</td>
                        <td className="py-2.5 px-3 text-center border-r-2 border-black">{formatNumber(item.qty)} {item.unit || ''}</td>
                        {['INVOICE', 'PO'].includes(docType) && (
                          <>
                            <td className="py-2.5 px-3 text-right border-r-2 border-black">{item.price ? formatNumber(item.price) : '-'}</td>
                            <td className="py-2.5 px-3 text-right font-black">{formatNumber(item.subtotal)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ========================================== */}
            {/* RENDER DOKUMEN: CASH VOUCHER / KWITANSI    */}
            {/* ========================================== */}
            {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
              <div className="border-2 border-black p-6 rounded-xl space-y-5 mb-8">
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-2">
                  <div className="w-48 font-black uppercase text-sm">NO REFERENSI</div>
                  <div className="flex-1 font-bold text-base uppercase">: {printData.id} | TGL: {printData.date}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-2">
                  <div className="w-48 font-black uppercase text-sm">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
                  <div className="flex-1 font-bold text-base uppercase">: {printData.customer_name || printData.person_name || '-'}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-black pb-2">
                  <div className="w-48 font-black uppercase text-sm">UANG SEJUMLAH</div>
                  <div className="flex-1 font-black text-xl uppercase">: {formatRupiah(printData.amount)}</div>
                </div>
                <div className="flex gap-4 items-start border-b border-dashed border-black pb-2 bg-slate-100 p-2 border-2 border-black mt-4">
                  <div className="w-48 font-black uppercase text-sm mt-1">TERBILANG</div>
                  <div className="flex-1 font-black text-lg uppercase italic text-black leading-tight"># {angkaTerbilang(printData.amount)} #</div>
                </div>
                <div className="flex gap-4 items-start pt-2">
                  <div className="w-48 font-black uppercase text-sm">UNTUK PEMBAYARAN</div>
                  <div className="flex-1 font-bold text-sm uppercase break-words">: {printData.notes || printData.description || '-'}</div>
                </div>
              </div>
            )}


            {/* ========================================== */}
            {/* AREA BAWAH: METODE, CATATAN BESAR, REKENING */}
            {/* ========================================== */}
            <div className="flex justify-between items-start gap-8">
              <div className="flex-1 space-y-4">
                
                {/* Catatan / Keterangan Besar (Sangat berguna untuk Surat Jalan dan Work Order) */}
                {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
                  <div className="border-2 border-black p-3 rounded-xl text-xs font-bold min-h-[60px]">
                    <p className="uppercase mb-1 underline font-black">CATATAN TRANSAKSI / METODE:</p>
                    <p className="uppercase text-sm font-black whitespace-pre-wrap">{printData.notes || printData.paymentMethod}</p>
                  </div>
                )}

                {/* Informasi Rekening Bank */}
                {showContactAndBank && (
                  <div className="text-[11px] font-black uppercase space-y-0.5 mt-2 bg-slate-100 border border-black p-2 inline-block">
                    <p className="border-b border-black pb-1 mb-1">PEMBAYARAN RESMI DITRANSFER MELALUI:</p>
                    <p>BCA : 1320552261 ( WASTAM )</p>
                    <p>BRI : 775301006132536 ( WASTAM )</p>
                  </div>
                )}
              </div>

              {/* Rincian Total Khusus Invoice & PO */}
              {['INVOICE', 'PO'].includes(docType) && (
                <div className="w-[340px]">
                  <div className="border-2 border-black rounded-xl overflow-hidden">
                    
                    {/* TEKNIK KLIP NOTA (RIWAYAT CICILAN/DP) */}
                    {printData.paymentHistory && printData.paymentHistory.length > 0 ? (
                      <>
                        <div className="bg-black text-white text-center font-black text-xs py-1.5 uppercase">Riwayat Pembayaran (Klip Nota)</div>
                        <div className="p-2 border-b-2 border-black text-[9px] font-bold uppercase space-y-1 bg-slate-50">
                          {printData.paymentHistory.map((hist, i) => (
                            <div key={i} className="flex justify-between border-b border-dashed border-slate-300 pb-1 mb-1 last:border-0 last:mb-0 last:pb-0">
                              <span className="w-32">{hist.date} <br/> <span className="font-mono text-[8px]">{hist.refId}</span></span>
                              <span className="flex-1 px-1 break-words">{hist.method}</span>
                              <span className="w-20 text-right">{formatRupiah(hist.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {/* REKAP GRAND TOTAL */}
                    {printData.history ? (
                      <>
                        <div className="flex justify-between py-2 px-3 border-b-2 border-black text-xs font-black bg-white">
                          <span className="uppercase">{printData.history.labelLama || 'TOTAL KESELURUHAN'}</span>
                          <span>{printData.history.nominalLama}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 border-b-2 border-black text-xs font-black bg-slate-100">
                          <span className="uppercase">{printData.history.labelAksi || 'TELAH DIBAYAR'}</span>
                          <span className="text-emerald-700">{printData.history.nominalAksi}</span>
                        </div>
                        <div className="flex justify-between py-3 px-3 text-sm font-black uppercase bg-white">
                          <span>{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                          <span className="text-red-600">{printData.history.nominalBaru}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-3 px-4 font-black text-lg uppercase bg-slate-100">
                        <span>GRAND TOTAL</span>
                        <span>{formatRupiah(printData.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* TANDA TANGAN DINAMIS SESUAI TYPE           */}
            {/* ========================================== */}
            <div className="flex justify-between items-end mt-12 px-2">
              
              {/* TANDA TANGAN KIRI */}
              <div className="text-center w-40">
                <div className="font-bold text-xs mb-16 uppercase">
                  {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
                  {docType === 'WO' ? 'Kepala Dapur' : ''}
                  {docType === 'PO' ? 'Supir Supplier' : ''}
                  {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
                </div>
                <div className="border-b-2 border-black w-full mb-1.5"></div>
                <div className="text-[10px] font-black uppercase">Ttd & Nama Jelas</div>
              </div>
              
              {/* TANDA TANGAN TENGAH (KHUSUS DO / SURAT JALAN ADA SUPIR) */}
              {docType === 'DO' ? (
                <div className="text-center w-40">
                  <div className="font-bold text-xs mb-16 uppercase">Supir / Kurir</div>
                  <div className="border-b-2 border-black w-full mb-1.5"></div>
                  <div className="text-[10px] font-black uppercase">{printData.driver_name || '................'}</div>
                </div>
              ) : (
                <div className="text-center w-64 space-y-1.5 mb-2">
                  {docType === 'INVOICE' && (
                    <p className="text-[11px] font-bold italic text-center text-black">"Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami."</p>
                  )}
                  <p className="font-black text-xs uppercase text-black">www.dimsumaditya.id</p>
                </div>
              )}

              {/* TANDA TANGAN KANAN */}
              <div className="text-center w-40">
                <div className="font-bold text-xs mb-16 uppercase">
                  {docType === 'DO' ? 'Bagian Gudang' : 'Admin / Kasir'}
                </div>
                <div className="border-b-2 border-black w-full mb-1.5"></div>
                <div className="text-[10px] font-black uppercase">{printData.admin_name}</div>
              </div>

            </div>

          </div>
        </div>

        {/* FOOTER MODAL (TOMBOL) */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0 no-print">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors text-sm border border-slate-300">Tutup Preview</button>
          <button onClick={handlePrint} className="flex-1 py-3.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm shadow-md">
            <Printer size={18} /> Cetak ke Epson LX-310
          </button>
        </div>

      </div>
    </div>
  );
}
