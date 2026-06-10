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
    // 💡 DI SINI TEMPAT EDIT LEBAR KERTAS (Ubah '19cm' sesuai selera Bos)
    <div className="print-dot-matrix" style={{ width: '20cm', maxHeight: '13.5cm', boxSizing: 'border-box', color: '#000', fontFamily: '"Courier New", Consolas, monospace', margin: '0', overflow: 'hidden' }}>
      
      {/* 💡 DI SINI TEMPAT EDIT MARGIN BROWSER (Ubah padding: Atas Kanan Bawah Kiri) */}
      <style>{`
        @media print {
          @page { size: 22.5cm 13.9cm; margin: 0; }
          body { margin: 0; padding: 2mm 0 0 2mm; background: white; -webkit-print-color-adjust: exact; }
          .print-dot-matrix { page-break-after: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* HEADER INVOICE KLIEN */}
      {isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '3px', marginBottom: '4px' }}>
          <h1 style={{ margin: '0 0 2px 0', fontSize: '20pt', fontWeight: '900', letterSpacing: '1px' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '9pt', fontWeight: 'bold', lineHeight: '1.2' }}>
            Alamat : Jl. Thamrin Ketapang, Cipondoh, Kota Tangerang 15147 | No Tlp : 0878 0902 0931
          </div>
        </div>
      )}

      {/* HEADER INTERNAL PABRIK */}
      {!isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '2px dashed black', paddingBottom: '3px', marginBottom: '4px' }}>
          <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: '900' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>CABANG OPERASIONAL {data.branch_name || 'PUSAT'}</div>
        </div>
      )}

      {/* JUDUL DOKUMEN */}
      <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: '900', textDecoration: 'underline', marginBottom: '6px', textTransform: 'uppercase' }}>
        {data.title || 'INVOICE PENJUALAN'}
      </div>

      {/* IDENTITAS TRANSAKSI */}
      <table style={{ width: '100%', marginBottom: '6px', fontSize: '9pt', fontWeight: 'bold', lineHeight: '1.1' }}>
        <tbody>
          <tr><td width="55%">NO. TRX : {trueId}</td><td width="45%">TANGGAL : {data.date || '-'}</td></tr>
          <tr>
            <td style={{ fontSize: isWO ? '11pt' : '9pt', fontWeight: '900' }}>NAMA/PIC : {data.customer_name || 'UMUM'}</td>
            <td>KASIR : ADMIN</td>
          </tr>
        </tbody>
      </table>

      {/* ============================== */}
      {/* MODE 1: INVOICE KLIEN */}
      {/* ============================== */}
      {isInvoice && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', fontSize: '10pt', fontWeight: 'bold' }}>
            <thead>
              <tr style={{ borderTop: '2px dashed black', borderBottom: '2px dashed black' }}>
                <th style={{ padding: '3px 0', textAlign: 'left', width: '60%' }}>KETERANGAN</th>
                <th style={{ padding: '3px 0', textAlign: 'center', width: '10%' }}>QTY</th>
                <th style={{ padding: '3px 0', textAlign: 'right', width: '30%' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.items && data.items.map((item, idx) => {
                 let cleanName = item.name;
                 if(cleanName.includes('@@')) cleanName = cleanName.split('\n')[0];
                 if(cleanName.includes('::')) cleanName = cleanName.split('::')[0];
                 return (
                  <tr key={idx}>
                    <td style={{ padding: '4px 0', whiteSpace: 'pre-wrap', textTransform: 'uppercase', lineHeight: '1.1' }}>{cleanName}</td>
                    <td style={{ padding: '4px 0', textAlign: 'center', fontSize: '12pt', fontWeight: '900' }}>{item.qty}</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '12pt' }}>{rp(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ borderTop: '2px solid black', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '14pt' }}>
            <span>TOTAL TAGIHAN :</span><span>{rp(data.amount || data.total)}</span>
          </div>
          
          {/* KOTAK STATUS DIPERBAIKI (Garis Putus-Putus Tipis) */}
          <div style={{ textAlign: 'right', marginTop: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12pt', fontWeight: '900', padding: '6px 12px', border: '1px dashed black', display: 'inline-block', lineHeight: '1.2' }}>
              STATUS: {data.paymentMethod || 'CASH'}
            </span>
          </div>

          {/* REKENING DI FOOTER */}
          <div style={{ marginTop: '6px', borderTop: '2px dashed black', paddingTop: '6px', fontSize: '9pt', fontWeight: '900', textAlign: 'center', lineHeight: '1.2' }}>
            <div>INFO PEMBAYARAN TRANSFER :</div>
            <div>BCA: 1320552261 (WASTAM) | BRI: 775301006132536 (WASTAM)</div>
          </div>
        </>
      )}

      {/* ============================== */}
      {/* MODE 2: WORK ORDER PABRIK */}
      {/* ============================== */}
      {isWO && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ border: '2px solid black', padding: '4px', textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '11pt', fontWeight: '900' }}>JUMLAH WAJIB MASAK (QTY)</div>
            <div style={{ fontSize: '36pt', fontWeight: '900', margin: '0', lineHeight: '1' }}>{formatNum(woQty)} <span style={{ fontSize: '12pt' }}>PCS</span></div>
          </div>
          
          <div style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '6px' }}>
            CHANNEL/AGEN: <span style={{ border: '2px solid black', padding: '1px 6px', fontWeight: '900' }}>{woChannel}</span>
          </div>

          <div style={{ border: '2px dashed black', padding: '6px', marginBottom: '6px' }}>
            <div style={{ fontSize: '11pt', fontWeight: '900', marginBottom: '2px' }}>SPESIFIKASI REQUEST VARIETAS:</div>
            <div style={{ fontSize: '20pt', fontWeight: '900', textTransform: 'uppercase', lineHeight: '1.1' }}>{woRequest}</div>
          </div>

          <div style={{ fontSize: '10pt', fontWeight: 'bold', borderLeft: '3px solid black', paddingLeft: '8px' }}>
            CATATAN POS: {woNotes}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* MODE 3: LAPORAN PRODUKSI */}
      {/* ============================== */}
      {isProd && (
         <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
               <div style={{ flex: 1, border: '2px solid black', padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10pt', fontWeight: '900' }}>TOTAL ADUKAN</div>
                  <div style={{ fontSize: '28pt', fontWeight: '900', lineHeight: '1' }}>{pAdukan}</div>
               </div>
               <div style={{ flex: 1, border: '2px solid black', padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10pt', fontWeight: '900' }}>AYAM TERPAKAI</div>
                  <div style={{ fontSize: '28pt', fontWeight: '900', lineHeight: '1' }}>{pAyam} KG</div>
               </div>
            </div>
            <div style={{ border: '2px solid black', padding: '6px', textAlign: 'center', marginBottom: '8px' }}>
               <div style={{ fontSize: '12pt', fontWeight: '900' }}>YIELD (MASUK FREEZER)</div>
               <div style={{ fontSize: '36pt', fontWeight: '900', margin: '0', lineHeight: '1' }}>{formatNum(pYield)} PCS</div>
            </div>
            <div style={{ fontSize: '10pt', fontWeight: 'bold', borderLeft: '3px solid black', paddingLeft: '8px' }}>
              KETERANGAN: {pNotes}
            </div>
         </div>
      )}

      {/* ============================== */}
      {/* TANDA TANGAN */}
      {/* ============================== */}
      <div style={{ borderTop: '2px dashed black', marginTop: '8px', paddingTop: '6px' }}>
        <table style={{ width: '100%', textAlign: 'center', fontSize: '9pt', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td width="50%">{isWO ? 'TIM DAPUR PABRIK,' : isProd ? 'KEPALA PRODUKSI,' : 'PENERIMA / KLIEN,'}</td>
              <td width="50%">HORMAT KAMI,</td>
            </tr>
            <tr><td height="25"></td><td></td></tr>
            <tr>
              <td style={{ textDecoration: 'underline', fontWeight: '900' }}>
                {isWO || isProd ? '_______________________' : (data.customer_name || '.......................')}
              </td>
              <td style={{ textDecoration: 'underline', fontWeight: '900' }}>ADMIN</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ========================================================
// 🖨️ 2. TEMPLATE CETAK REKAP A4 (MANAJERIAL)
// ========================================================
const A4RecapReport = ({ data }) => {
  return (
    <div className="print-a4-recap">
      <div style={{ borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', textTransform: 'uppercase' }}>LAPORAN REKAPITULASI OPERASIONAL</h1>
        <div>Cabang: {data.branch_name} | Tanggal: {data.date_range}</div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}><strong>💰 TOTAL KAS (CASH)</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_cash)}</span></div>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}><strong>💳 TOTAL BANK (ATM)</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_atm)}</span></div>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}><strong>📝 TOTAL PIUTANG</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_piutang)}</span></div>
      </div>
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ width: '40%' }}>
          <h3 style={{ borderBottom: '1px solid #ccc' }}>📦 REKAP STOK & ADUKAN</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ border: '1px solid black', padding: '5px' }}>ITEM</th><th style={{ border: '1px solid black', padding: '5px' }}>SISA QTY</th></tr></thead>
            <tbody>
              <tr><td style={{ border: '1px solid black', padding: '5px' }}>ADUKAN AYAM (KG)</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{data.stok_adukan} Kg</td></tr>
              <tr><td style={{ border: '1px solid black', padding: '5px' }}>DIMSUM FREEZER (PCS)</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{data.stok_dimsum} Pcs</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ width: '60%' }}>
          <h3 style={{ borderBottom: '1px solid #ccc' }}>🛒 RINCIAN TRANSAKSI</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ border: '1px solid black', padding: '5px' }}>ID TRANSAKSI</th><th style={{ border: '1px solid black', padding: '5px' }}>KLIEN</th><th style={{ border: '1px solid black', padding: '5px' }}>METODE</th><th style={{ border: '1px solid black', padding: '5px' }}>NOMINAL</th></tr></thead>
            <tbody>
              {data.transactions && data.transactions.map((trx, idx) => (
                <tr key={idx}><td style={{ border: '1px solid black', padding: '5px' }}>{trx.id}</td><td style={{ border: '1px solid black', padding: '5px' }}>{trx.customer_name}</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{trx.paymentMethod}</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>{rp(trx.total || trx.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const triggerPrint = (type, data) => {
  let printRootEl = document.getElementById('print-root');
  if (!printRootEl) { printRootEl = document.createElement('div'); printRootEl.id = 'print-root'; document.body.appendChild(printRootEl); }
  const root = createRoot(printRootEl);
  const content = type === 'NOTA_DOTMATRIX' ? <DotMatrixInvoice data={data} /> : <A4RecapReport data={data} />;
  root.render(content);
  setTimeout(() => { window.print(); setTimeout(() => { root.unmount(); }, 1000); }, 300);
};
