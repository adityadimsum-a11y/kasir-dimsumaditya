import React from 'react';
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
  if (!printData) return null;

  const handlePrint = () => window.print();
  const docType = printData.type || 'INVOICE'; 
  const showContactAndBank = docType === 'INVOICE' || docType === 'WITHDRAWAL';

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:static print:bg-transparent print:p-0 print:backdrop-blur-none">
      
      {/* SUNTIKAN CSS GLOBAL KHUSUS PRINT
        Ini obat anti layar blank! Mematikan semua constraint overflow dari Tailwind.
      */}
      <style type="text/css" media="print">
        {`
          @page { size: 21.5cm 14cm; margin: 5mm; }
          html, body { height: auto !important; overflow: visible !important; background-color: white !important; }
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 21.5cm; /* Ukuran pas untuk kertas setengah (NCR) */
            margin: 0; 
            padding: 0; 
          }
          .no-print { display: none !important; }
        `}
      </style>

      <div className="bg-slate-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden max-h-[95vh] print:shadow-none print:border-none print:w-full print:max-h-none print:overflow-visible">
        
        {/* HEADER MODAL PREVIEW */}
        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 no-print">
          <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm normal-case">
            <Receipt size={18} className="text-blue-600" />
            Pratinjau Cetak {docType === 'INVOICE' ? 'Invoice' : docType}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* AREA SCROLL PREVIEW (Kertas ada di dalam sini) */}
        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 flex justify-center print:p-0 print:overflow-visible">
          
          {/* ========================================================= */}
          {/* AREA KERTAS (YANG AKAN MASUK PRINTER)                       */}
          {/* Desain Modern Clean Ala Startup                           */}
          {/* ========================================================= */}
          <div id="print-section" className="bg-white shadow-md p-8 text-black font-sans w-full max-w-[21.5cm] relative print:shadow-none print:p-2">
            
            {/* KOP SURAT */}
            <div className="flex justify-between items-end border-b-[3px] border-slate-800 pb-3 mb-4">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-slate-900">Dimsum Aditya</h1>
                <p className="text-[11px] font-bold tracking-widest mt-1 text-slate-500 uppercase">Distributor Dimsum Ayam</p>
              </div>
              <div className="text-right text-[10px] font-bold leading-relaxed text-slate-700 max-w-[280px]">
                {docType === 'WO' && <h2 className="text-lg font-black mb-1 bg-slate-800 text-white px-3 py-0.5 uppercase inline-block rounded">Work Order</h2>}
                {docType === 'DO' && <h2 className="text-lg font-black mb-1 bg-slate-800 text-white px-3 py-0.5 uppercase inline-block rounded">Surat Jalan</h2>}
                {docType === 'CASH_VOUCHER' && <h2 className="text-lg font-black mb-1 bg-slate-800 text-white px-3 py-0.5 uppercase inline-block rounded">Voucher Kas</h2>}
                {docType === 'PO' && <h2 className="text-lg font-black mb-1 bg-slate-800 text-white px-3 py-0.5 uppercase inline-block rounded">Terima Barang</h2>}
                {docType === 'WITHDRAWAL' && <h2 className="text-lg font-black mb-1 bg-slate-800 text-white px-3 py-0.5 uppercase inline-block rounded">Kwitansi Tunai</h2>}
                
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
                {/* INFO TRANSAKSI */}
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <div className="flex gap-4 text-xs"><span className="w-24 font-bold text-slate-500 uppercase">NO REF</span><span className="font-black uppercase text-slate-900">: {printData.id}</span></div>
                    <div className="flex gap-4 text-xs"><span className="w-24 font-bold text-slate-500 uppercase">TANGGAL</span><span className="font-black uppercase text-slate-900">: {printData.date}</span></div>
                    <div className="flex gap-4 text-xs"><span className="w-24 font-bold text-slate-500 uppercase">ADMIN</span><span className="font-black uppercase text-slate-900">: {printData.admin_name}</span></div>
                    
                    {docType === 'WO' && printData.targetDate && (
                      <div className="flex gap-4 text-xs mt-2 bg-red-50 px-2 py-1 rounded border border-red-100">
                        <span className="w-24 font-black uppercase text-red-600">DEADLINE</span>
                        <span className="font-black uppercase text-sm text-red-700">: {printData.targetDate}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase mb-0.5 text-slate-400">
                      {docType === 'INVOICE' && 'PELANGGAN / AGEN'}
                      {docType === 'PO' && 'SUPPLIER'}
                      {docType === 'DO' && 'DIKIRIM KE TUJUAN'}
                      {docType === 'WO' && 'ATAS NAMA PESANAN'}
                    </div>
                    <div className="text-base font-black uppercase text-slate-900 max-w-[250px] leading-tight">
                      {printData.customer_name || printData.supplier_name || printData.destination || 'UMUM'}
                    </div>
                  </div>
                </div>

                {/* TABEL ITEM (CLEAN LOOK, NO VERTICAL LINES) */}
                <table className="w-full text-xs border-collapse mb-6">
                  <thead>
                    <tr className="border-y-2 border-slate-800 bg-slate-50 print:bg-transparent">
                      <th className="py-2.5 px-2 text-left font-black w-8">NO</th>
                      <th className="py-2.5 px-2 text-left font-black">DESKRIPSI ITEM</th>
                      <th className="py-2.5 px-2 text-center font-black w-24">QTY</th>
                      {['INVOICE', 'PO'].includes(docType) && (
                        <>
                          <th className="py-2.5 px-2 text-right font-black w-32">HARGA</th>
                          <th className="py-2.5 px-2 text-right font-black w-36">SUBTOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items?.map((item, idx) => {
                      // Logic otomatis cari harga satuan jika tidak ada di data
                      const hargaSatuan = item.price ? item.price : (item.subtotal && item.qty ? item.subtotal / item.qty : 0);
                      
                      return (
                        <tr key={idx} className="border-b border-slate-300 border-dashed last:border-b-2 last:border-slate-800">
                          <td className="py-3 px-2 text-center align-top font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-2 align-top font-bold text-slate-900">{item.name}</td>
                          
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-black text-sm text-slate-900">{formatNumber(item.qty)} <span className="text-[10px] font-bold text-slate-500">{item.unit || 'Pcs'}</span></div>
                            {(!item.unit || item.unit === 'Pcs') && (
                              <div className="text-[9px] font-bold text-slate-500 mt-0.5">({formatNumber(item.qty / 4)} Porsi)</div>
                            )}
                          </td>

                          {['INVOICE', 'PO'].includes(docType) && (
                            <>
                              <td className="py-3 px-2 text-right align-top font-bold text-slate-700">
                                {formatRupiah(hargaSatuan)}
                              </td>
                              <td className="py-3 px-2 text-right font-black text-slate-900 text-sm">
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
              <div className="border-2 border-slate-800 p-6 rounded-xl space-y-5 mb-8 bg-white shadow-sm print:shadow-none print:rounded-none">
                <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-2">
                  <div className="w-40 font-bold uppercase text-xs text-slate-500">NO REFERENSI</div>
                  <div className="flex-1 font-black text-sm uppercase text-slate-900">: {printData.id} <span className="text-slate-400 font-bold mx-2">|</span> TGL: {printData.date}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-2">
                  <div className="w-40 font-bold uppercase text-xs text-slate-500">{printData.flowType === 'IN' ? 'DITERIMA DARI' : 'DIBAYARKAN KEPADA'}</div>
                  <div className="flex-1 font-black text-sm uppercase text-slate-900">: {printData.customer_name || printData.person_name || '-'}</div>
                </div>
                <div className="flex gap-4 items-end border-b border-dashed border-slate-300 pb-2">
                  <div className="w-40 font-bold uppercase text-xs text-slate-500">UANG SEJUMLAH</div>
                  <div className="flex-1 font-black text-xl uppercase text-slate-900">: {formatRupiah(printData.amount)}</div>
                </div>
                <div className="flex gap-4 items-start border-b border-dashed border-slate-300 pb-2 p-3 bg-slate-50 border border-slate-200 rounded-lg mt-4 print:bg-transparent print:border-slate-800 print:rounded-none">
                  <div className="w-36 font-bold uppercase text-xs mt-0.5 text-slate-500">TERBILANG</div>
                  <div className="flex-1 font-black text-sm uppercase italic text-slate-800 leading-tight"># {angkaTerbilang(printData.amount)} #</div>
                </div>
                <div className="flex gap-4 items-start pt-2">
                  <div className="w-40 font-bold uppercase text-xs text-slate-500">UNTUK KEPERLUAN</div>
                  <div className="flex-1 font-bold text-sm uppercase text-slate-900 break-words">: {printData.notes || printData.description || '-'}</div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* AREA BAWAH: METODE, REKENING & RINGKASAN   */}
            {/* ========================================== */}
            <div className="flex justify-between items-start gap-8">
              
              {/* KIRI: METODE & REKENING */}
              <div className="flex-1 space-y-4">
                {(printData.notes || printData.paymentMethod) && !['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Catatan / Metode:</div>
                    <div className="font-bold text-xs uppercase text-slate-800 whitespace-pre-wrap">{printData.notes || printData.paymentMethod}</div>
                  </div>
                )}

                {showContactAndBank && (
                  <div className="text-[10px] font-bold uppercase space-y-1 mt-4 pt-3 border-t border-slate-300 text-slate-600">
                    <p className="font-black text-slate-900">INFO REKENING PEMBAYARAN:</p>
                    <p>BCA : <span className="font-black text-slate-900 text-xs">1320552261</span> ( WASTAM )</p>
                    <p>BRI : <span className="font-black text-slate-900 text-xs">775301006132536</span> ( WASTAM )</p>
                  </div>
                )}
              </div>

              {/* KANAN: RINGKASAN TOTAL (Gabung Metode biar gampang dibaca) */}
              {['INVOICE', 'PO'].includes(docType) && (
                <div className="w-[340px]">
                  
                  <div className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden print:bg-transparent print:rounded-none print:border-slate-800">
                    {printData.history ? (
                      <>
                        <div className="flex justify-between py-2.5 px-4 border-b border-slate-200 text-xs font-bold text-slate-600">
                          <span className="uppercase">{printData.history.labelLama || 'TOTAL BELANJA'}</span>
                          <span className="font-black text-slate-900">{safeRupiah(printData.history.nominalLama)}</span>
                        </div>
                        
                        {/* Jika ada metode bayar dicicil, gabungkan di sini */}
                        <div className="flex justify-between items-center py-2.5 px-4 border-b border-slate-200 bg-emerald-50/50 print:bg-transparent">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase text-emerald-800 print:text-black">{printData.history.labelAksi || 'SUDAH DIBAYAR'}</span>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase print:text-black">VIA: {printData.paymentMethod?.split('+')[0] || 'TUNAI/TRANSFER'}</span>
                          </div>
                          <span className="font-black text-emerald-700 text-sm print:text-black">{safeRupiah(printData.history.nominalAksi)}</span>
                        </div>

                        <div className="flex justify-between py-3 px-4 text-sm font-black uppercase bg-red-50/50 print:bg-transparent">
                          <span className="text-red-800 print:text-black">{printData.history.labelBaru || 'SISA TAGIHAN'}</span>
                          <span className="text-red-600 text-base print:text-black">{safeRupiah(printData.history.nominalBaru)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-4 px-4 font-black text-lg uppercase bg-blue-50/50 print:bg-transparent text-blue-900 print:text-black">
                        <span>TOTAL</span>
                        <span>{formatRupiah(printData.amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* RIWAYAT CICILAN MUNCUL DI BAWAH TOTAL */}
                  {printData.paymentHistory && printData.paymentHistory.length > 0 && (
                    <div className="mt-3 text-[9px]">
                      <div className="font-black text-slate-500 uppercase mb-1 border-b border-slate-300 pb-1">Riwayat Pembayaran Sebelumnya:</div>
                      <div className="space-y-1">
                        {printData.paymentHistory.map((hist, i) => (
                          <div key={i} className="flex justify-between font-bold text-slate-700">
                            <span className="w-20">{hist.date}</span>
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
            <div className="flex justify-between items-end mt-10 text-slate-800">
              
              <div className="text-center w-36">
                <div className="font-bold text-[10px] mb-12 uppercase">
                  {docType === 'INVOICE' || docType === 'DO' ? 'Penerima / Pelanggan' : ''}
                  {docType === 'WO' ? 'Kepala Dapur' : ''}
                  {docType === 'PO' ? 'Supir Supplier' : ''}
                  {['CASH_VOUCHER', 'WITHDRAWAL'].includes(docType) ? 'Penerima Dana' : ''}
                </div>
                <div className="border-b border-slate-800 w-full mb-1"></div>
                <div className="text-[9px] font-bold uppercase">Ttd & Nama Jelas</div>
              </div>
              
              {docType === 'DO' ? (
                <div className="text-center w-36">
                  <div className="font-bold text-[10px] mb-12 uppercase">Supir / Kurir</div>
                  <div className="border-b border-slate-800 w-full mb-1"></div>
                  <div className="text-[9px] font-bold uppercase">{printData.driver_name || '................'}</div>
                </div>
              ) : (
                <div className="text-center w-64 space-y-1 mb-1">
                  {docType === 'INVOICE' && (
                    <p className="text-[10px] font-bold italic text-slate-500">"Terima kasih telah berbelanja di kami,<br/>kepuasan Anda adalah prioritas kami."</p>
                  )}
                  <p className="font-black text-xs uppercase tracking-widest text-slate-900 mt-2">www.dimsumaditya.id</p>
                </div>
              )}

              <div className="text-center w-36">
                <div className="font-bold text-[10px] mb-12 uppercase">
                  {docType === 'DO' ? 'Bagian Gudang' : 'Admin / Kasir'}
                </div>
                <div className="border-b border-slate-800 w-full mb-1"></div>
                <div className="text-[9px] font-bold uppercase">{printData.admin_name}</div>
              </div>

            </div>

          </div>
        </div>

        {/* FOOTER MODAL & TOMBOL */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 no-print">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs border border-slate-200 cursor-pointer">
            Batal & Tutup
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs shadow-md cursor-pointer">
            <Printer size={16} /> Cetak ke Printer LX-310
          </button>
        </div>

      </div>
    </div>
  );
}
