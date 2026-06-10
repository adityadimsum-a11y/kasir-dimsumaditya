import React from 'react';
import { createRoot } from 'react-dom/client';

const rp = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNum = (angka) => Number(angka || 0).toLocaleString('id-ID');

// ========================================================
// 🖨️ 1. TEMPLATE CETAK DOT MATRIX (EPSON LX 310)
// ========================================================
const DotMatrixInvoice = ({ data }) => {
  const isWO = data.title && (data.title.includes('WORK ORDER') || data.title.includes('MANIFEST'));
  const isProd = data.title && data.title.includes('HASIL PRODUKSI');
  const isInvoice = !isWO && !isProd;

  let trueId = data.id || '-';
  let woChannel = '-', woRequest = 'STANDAR MIX', woNotes = '-', woQty = data.qty || 1;
  let pAdukan = 0, pAyam = 0, pYield = 0, pNotes = '-';

  if (typeof trueId === 'string' && trueId.includes('::')) {
    const parts = trueId.split('::');
    trueId = parts[0];
    if (isWO) { woQty = parts[1]; woChannel = parts[2]; woRequest = parts[3]; woNotes = parts[4]; }
    if (isProd) { pAdukan = parts[1]; pAyam = parts[2]; pYield = parts[3]; pNotes = parts[4]; }
  }

  if (data.items && data.items.length > 0 && typeof data.items[0].name === 'string') {
    const firstItem = data.items[0].name;
    if (firstItem.startsWith('@@WORK_ORDER@@')) {
        const parts = firstItem.split('||');
        woChannel = parts[1]; woRequest = parts[2]; woNotes = parts[3]; woQty = data.items[0].qty;
    } else if (firstItem.startsWith('@@PRODUCTION@@')) {
        const parts = firstItem.split('||');
        pAdukan = parts[1]; pAyam = parts[2]; pYield = parts[3]; pNotes = parts[4];
    }
  }

  return (
    <div className="print-dot-matrix" style={{ boxSizing: 'border-box', color: '#000', fontFamily: 'monospace', padding: '0px' }}>
      {/* CSS KHUSUS MEMAKSA 1 HALAMAN */}
      <style>{`
        @media print {
          @page { size: auto; margin: 3mm; }
          body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
        }
      `}</style>

      {/* HEADER CUSTOMER INVOICE */}
      {isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '5px', marginBottom: '8px' }}>
          <h1 style={{ margin: '0 0 3px 0', fontSize: '24pt', fontWeight: '900', letterSpacing: '1px' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: '1.2' }}>
            Alamat : Jl. Thamrin Ketapang, Cipondoh, Kota Tangerang 15147<br/>
            No Tlp : 0878 0902 0931
          </div>
        </div>
      )}

      {/* HEADER INTERNAL PABRIK */}
      {!isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '2px dashed black', paddingBottom: '3px', marginBottom: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '20pt', fontWeight: '900' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>CABANG OPERASIONAL {data.branch_name || 'PUSAT'}</div>
        </div>
      )}

      {/* JUDUL DOKUMEN */}
      <div style={{ textAlign: 'center', fontSize: '16pt', fontWeight: '900', textDecoration: 'underline', marginBottom: '8px', textTransform: 'uppercase' }}>
        {data.title || 'INVOICE PENJUALAN'}
      </div>

      {/* IDENTITAS */}
      <table style={{ width: '100%', marginBottom: '10px', fontSize: '11pt', fontWeight: 'bold', lineHeight: '1.2' }}>
        <tbody>
          <tr><td width="55%">NO. TRX : {trueId}</td><td width="45%">TANGGAL : {data.date || '-'}</td></tr>
          <tr>
            <td style={{ fontSize: isWO ? '13pt' : '11pt', fontWeight: '900' }}>NAMA/PIC : {data.customer_name || 'UMUM'}</td>
            <td>KASIR : {data.admin_name || 'ADMIN'}</td>
          </tr>
        </tbody>
      </table>

      {/* ============================== */}
      {/* MODE 1: INVOICE KLIEN */}
      {/* ============================== */}
      {isInvoice && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '12pt', fontWeight: 'bold' }}>
            <thead>
              <tr style={{ borderTop: '2px dashed black', borderBottom: '2px dashed black' }}>
                <th style={{ padding: '4px 0', textAlign: 'left', width: '60%' }}>KETERANGAN</th>
                <th style={{ padding: '4px 0', textAlign: 'center', width: '10%' }}>QTY</th>
                <th style={{ padding: '4px 0', textAlign: 'right', width: '30%' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.items && data.items.map((item, idx) => {
                 let cleanName = item.name;
                 if(cleanName.includes('@@')) cleanName = cleanName.split('\n')[0];
                 if(cleanName.includes('::')) cleanName = cleanName.split('::')[0];
                 return (
                  <tr key={idx}>
                    <td style={{ padding: '6px 0', whiteSpace: 'pre-wrap', textTransform: 'uppercase', lineHeight: '1.2' }}>{cleanName}</td>
                    <td style={{ padding: '6px 0', textAlign: 'center', fontSize: '14pt', fontWeight: '900' }}>{item.qty}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '14pt' }}>{rp(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ borderTop: '2px solid black', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16pt' }}>
            <span>TOTAL TAGIHAN :</span><span>{rp(data.amount || data.total)}</span>
          </div>
          
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <span style={{ fontSize: '14pt', fontWeight: '900', padding: '4px 10px', border: '2px solid black', display: 'inline-block' }}>
              STATUS: {data.paymentMethod || 'CASH'}
            </span>
          </div>
        </>
      )}

      {/* ============================== */}
      {/* MODE 2: WORK ORDER PABRIK */}
      {/* ============================== */}
      {isWO && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ border: '3px solid black', padding: '8px', textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '14pt', fontWeight: '900' }}>JUMLAH WAJIB MASAK (QTY)</div>
            <div style={{ fontSize: '45pt', fontWeight: '900', margin: '0' }}>{formatNum(woQty)} <span style={{ fontSize: '16pt' }}>PCS</span></div>
          </div>
          
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '8px' }}>
            CHANNEL/AGEN: <span style={{ border: '2px solid black', padding: '2px 8px', fontWeight: '900' }}>{woChannel}</span>
          </div>

          <div style={{ border: '3px dashed black', padding: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '14pt', fontWeight: '900', marginBottom: '4px' }}>SPESIFIKASI REQUEST VARIETAS:</div>
            <div style={{ fontSize: '24pt', fontWeight: '900', textTransform: 'uppercase', lineHeight: '1.1' }}>{woRequest}</div>
          </div>

          <div style={{ fontSize: '12pt', fontWeight: 'bold', borderLeft: '4px solid black', paddingLeft: '10px' }}>
            CATATAN POS: {woNotes}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* MODE 3: LAPORAN PRODUKSI */}
      {/* ============================== */}
      {isProd && (
         <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
               <div style={{ flex: 1, border: '3px solid black', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12pt', fontWeight: '900' }}>TOTAL ADUKAN</div>
                  <div style={{ fontSize: '32pt', fontWeight: '900' }}>{pAdukan}</div>
               </div>
               <div style={{ flex: 1, border: '3px solid black', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12pt', fontWeight: '900' }}>AYAM TERPAKAI</div>
                  <div style={{ fontSize: '32pt', fontWeight: '900' }}>{pAyam} KG</div>
               </div>
            </div>
            <div style={{ border: '3px solid black', padding: '10px', textAlign: 'center', marginBottom: '10px' }}>
               <div style={{ fontSize: '14pt', fontWeight: '900' }}>YIELD (MASUK FREEZER)</div>
               <div style={{ fontSize: '40pt', fontWeight: '900', margin: '0' }}>{formatNum(pYield)} PCS</div>
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', borderLeft: '4px solid black', paddingLeft: '10px' }}>
              KETERANGAN: {pNotes}
            </div>
         </div>
      )}

      {/* ============================== */}
      {/* INFO REKENING (HANYA INVOICE - FOOTER) */}
      {/* ============================== */}
      {isInvoice && (
        <div style={{ marginTop: '10px', borderTop: '2px dashed black', paddingTop: '8px', fontSize: '11pt', fontWeight: '900', textAlign: 'center', lineHeight: '1.3' }}>
          <div>INFO PEMBAYARAN TRANSFER :</div>
          <div>BCA: 1320552261 (WASTAM) | BRI: 775301006132536 (WASTAM)</div>
        </div>
      )}

      {/* TANDA TANGAN (Kecil agar muat 1 lembar) */}
      <div style={{ borderTop: '2px dashed black', marginTop: '10px', paddingTop: '10px' }}>
        <table style={{ width: '100%', textAlign: 'center', fontSize: '11pt', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td width="50%">{isWO ? 'TIM DAPUR PABRIK,' : isProd ? 'KEPALA PRODUKSI,' : 'PENERIMA / KLIEN,'}</td>
              <td width="50%">HORMAT KAMI,</td>
            </tr>
            <tr><td height="40"></td><td></td></tr>
            <tr>
              <td style={{ textDecoration: 'underline', fontWeight: '900' }}>
                {isWO || isProd ? '_______________________' : (data.customer_name || '.......................')}
              </td>
              <td style={{ textDecoration: 'underline', fontWeight: '900' }}>{data.admin_name || 'ADMIN'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9pt', fontStyle: 'italic', fontWeight: 'bold' }}>
        -- Dokumen Otomatis Sistem ERP Dimsum Aditya --
      </div>
    </div>
  );
};

export const triggerPrint = (type, data) => {
  let printRootEl = document.getElementById('print-root');
  if (!printRootEl) { printRootEl = document.createElement('div'); printRootEl.id = 'print-root'; document.body.appendChild(printRootEl); }
  const root = createRoot(printRootEl);
  const content = <DotMatrixInvoice data={data} />;
  root.render(content);
  setTimeout(() => { window.print(); setTimeout(() => { root.unmount(); }, 1000); }, 300);
};
