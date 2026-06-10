import React from 'react';
import { createRoot } from 'react-dom/client';

const rp = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNum = (angka) => Number(angka || 0).toLocaleString('id-ID');

// ========================================================
// 🖨️ 1. TEMPLATE CETAK DOT MATRIX (EPSON LX 310)
// ========================================================
const DotMatrixInvoice = ({ data }) => {
  // 1. IDENTIFIKASI MODE CETAK
  const isWO = data.title && (data.title.includes('WORK ORDER') || data.title.includes('MANIFEST'));
  const isProd = data.title && data.title.includes('HASIL PRODUKSI');
  const isInvoice = !isWO && !isProd;

  // 2. EKSTRAK DATA RAHASIA (BYPASS ANTI-GAGAL)
  let trueId = data.id || '-';
  let woChannel = '-', woRequest = 'STANDAR MIX', woNotes = '-', woQty = data.qty || 1;
  let pAdukan = 0, pAyam = 0, pYield = 0, pNotes = '-';

  // Deteksi jika ID menggunakan pemisah "::" (Versi Lama)
  if (typeof trueId === 'string' && trueId.includes('::')) {
    const parts = trueId.split('::');
    trueId = parts[0];
    if (isWO) { woQty = parts[1]; woChannel = parts[2]; woRequest = parts[3]; woNotes = parts[4]; }
    if (isProd) { pAdukan = parts[1]; pAyam = parts[2]; pYield = parts[3]; pNotes = parts[4]; }
  }

  // Deteksi jika Item menggunakan pemisah "@@" (Versi Baru)
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
    <div className="print-dot-matrix" style={{ boxSizing: 'border-box', overflow: 'hidden', color: '#000', fontFamily: 'monospace', padding: '10px' }}>

      {/* ========================================= */}
      {/* HEADER INVOICE CUSTOMER (SUPER BESAR) */}
      {/* ========================================= */}
      {isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '3px solid black', paddingBottom: '10px', marginBottom: '15px' }}>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '28pt', fontWeight: '900', letterSpacing: '2px' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', lineHeight: '1.4' }}>
            Alamat : Jl. Thamrin Ketapang, Cipondoh, Kota Tangerang 15147<br/>
            No Tlp : 0878 0902 0931
          </div>
          <div style={{ display: 'inline-block', border: '3px solid black', padding: '8px 15px', marginTop: '8px', fontSize: '13pt', fontWeight: '900', textAlign: 'left', backgroundColor: '#f9f9f9' }}>
            No. Rek : 1320552261 (BCA) - WASTAM<br/>
            No. Rek : 775301006132536 (BRI) - WASTAM
          </div>
        </div>
      )}

      {/* HEADER INTERNAL (UNTUK TIKET PABRIK & PRODUKSI) */}
      {!isInvoice && (
        <div style={{ textAlign: 'center', borderBottom: '2px dashed black', paddingBottom: '5px', marginBottom: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: '900' }}>DIMSUM ADITYA</h1>
          <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>CABANG OPERASIONAL {data.branch_name || 'PUSAT'}</div>
        </div>
      )}

      {/* JUDUL DOKUMEN */}
      <div style={{ textAlign: 'center', fontSize: '18pt', fontWeight: '900', textDecoration: 'underline', marginBottom: '15px', textTransform: 'uppercase' }}>
        {data.title || 'INVOICE PENJUALAN'}
      </div>

      {/* IDENTITAS TRANSAKSI */}
      <table style={{ width: '100%', marginBottom: '15px', fontSize: '12pt', fontWeight: 'bold' }}>
        <tbody>
          <tr><td width="55%">NO. TRX : {trueId}</td><td width="45%">TANGGAL : {data.date || '-'}</td></tr>
          <tr>
            <td style={{ fontSize: isWO ? '16pt' : '12pt', fontWeight: '900' }}>NAMA/PIC : {data.customer_name || 'UMUM'}</td>
            <td>KASIR : {data.admin_name || 'ADMIN'}</td>
          </tr>
        </tbody>
      </table>

      {/* ========================================= */}
      {/* MODE 1: INVOICE CUSTOMER */}
      {/* ========================================= */}
      {isInvoice && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '14pt', fontWeight: 'bold' }}>
            <thead>
              <tr style={{ borderTop: '3px dashed black', borderBottom: '3px dashed black' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', width: '60%' }}>KETERANGAN</th>
                <th style={{ padding: '8px 0', textAlign: 'center', width: '10%' }}>QTY</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: '30%' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.items && data.items.map((item, idx) => {
                 // Membersihkan nama barang dari kode rahasia jika nyangkut
                 let cleanName = item.name;
                 if(cleanName.includes('@@')) cleanName = cleanName.split('\n')[0];
                 if(cleanName.includes('::')) cleanName = cleanName.split('::')[0];

                 return (
                  <tr key={idx}>
                    <td style={{ padding: '10px 0', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>{cleanName}</td>
                    <td style={{ padding: '10px 0', textAlign: 'center', fontSize: '18pt', fontWeight: '900' }}>{item.qty}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '16pt' }}>{rp(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ borderTop: '4px solid black', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '20pt' }}>
            <span>TOTAL TAGIHAN :</span><span>{rp(data.amount || data.total)}</span>
          </div>
          
          <div style={{ textAlign: 'right', marginTop: '15px' }}>
            <span style={{ fontSize: '18pt', fontWeight: '900', padding: '8px 15px', border: '3px solid black', display: 'inline-block', backgroundColor: data.paymentMethod?.includes('BELUM') ? '#e5e5e5' : 'transparent' }}>
              STATUS: {data.paymentMethod || 'CASH'}
            </span>
          </div>
        </>
      )}

      {/* ========================================= */}
      {/* MODE 2: WORK ORDER (TIKET DAPUR KARANTINA) */}
      {/* ========================================= */}
      {isWO && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ border: '5px solid black', padding: '20px', textAlign: 'center', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
            <div style={{ fontSize: '18pt', fontWeight: '900', marginBottom: '5px' }}>JUMLAH WAJIB MASAK (QTY)</div>
            <div style={{ fontSize: '60pt', fontWeight: '900', margin: '10px 0' }}>{formatNum(woQty)} <span style={{ fontSize: '20pt' }}>PCS</span></div>
          </div>
          
          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '15px' }}>
            CHANNEL/AGEN: <span style={{ border: '2px solid black', padding: '4px 10px', fontWeight: '900' }}>{woChannel}</span>
          </div>

          <div style={{ border: '5px dashed black', padding: '20px', marginBottom: '15px' }}>
            <div style={{ fontSize: '18pt', fontWeight: '900', marginBottom: '10px' }}>⚠️ SPESIFIKASI REQUEST VARIETAS:</div>
            <div style={{ fontSize: '30pt', fontWeight: '900', textTransform: 'uppercase' }}>{woRequest}</div>
          </div>

          <div style={{ fontSize: '16pt', fontWeight: 'bold', borderLeft: '6px solid black', paddingLeft: '15px', paddingBottom: '10px' }}>
            CATATAN POS: {woNotes}
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODE 3: LAPORAN HASIL PRODUKSI (YIELD) */}
      {/* ========================================= */}
      {isProd && (
         <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
               <div style={{ flex: 1, border: '4px solid black', padding: '15px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: '900', marginBottom: '5px' }}>TOTAL ADUKAN</div>
                  <div style={{ fontSize: '40pt', fontWeight: '900' }}>{pAdukan}</div>
               </div>
               <div style={{ flex: 1, border: '4px solid black', padding: '15px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: '900', marginBottom: '5px' }}>AYAM TERPAKAI</div>
                  <div style={{ fontSize: '40pt', fontWeight: '900' }}>{pAyam} KG</div>
               </div>
            </div>
            <div style={{ border: '5px solid black', padding: '20px', textAlign: 'center', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
               <div style={{ fontSize: '18pt', fontWeight: '900', marginBottom: '5px' }}>YIELD (MASUK FREEZER)</div>
               <div style={{ fontSize: '50pt', fontWeight: '900', margin: '10px 0' }}>{formatNum(pYield)} PCS</div>
            </div>
            <div style={{ fontSize: '16pt', fontWeight: 'bold', borderLeft: '6px solid black', paddingLeft: '15px' }}>
              KETERANGAN SHIFT: {pNotes}
            </div>
         </div>
      )}

      {/* ========================================= */}
      {/* TANDA TANGAN GLOBAL */}
      {/* ========================================= */}
      <div style={{ borderTop: '3px dashed black', marginTop: '30px', paddingTop: '20px' }}>
        <table style={{ width: '100%', textAlign: 'center', fontSize: '14pt', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td width="50%">{isWO ? 'TIM DAPUR PABRIK,' : isProd ? 'KEPALA PRODUKSI,' : 'PENERIMA / KLIEN,'}</td>
              <td width="50%">HORMAT KAMI,</td>
            </tr>
            <tr><td height="80"></td><td></td></tr>
            <tr>
              <td style={{ textDecoration: 'underline', fontWeight: '900', fontSize: '16pt' }}>
                {isWO || isProd ? '_________________________' : (data.customer_name || '.......................')}
              </td>
              <td style={{ textDecoration: 'underline', fontSize: '16pt', fontWeight: '900' }}>{data.admin_name || 'ADMIN'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11pt', fontStyle: 'italic', fontWeight: 'bold', color: '#555' }}>
        -- Dokumen Otomatis Sistem ERP Dimsum Aditya --
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
