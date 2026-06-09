import React from 'react';
import { createRoot } from 'react-dom/client';

// Format Rupiah Standar
const rp = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

// Komponen Template Cetak Nota Dot Matrix (Epson LX 310)
const DotMatrixInvoice = ({ data }) => {
  return (
    <div className="print-dot-matrix">
      <div style={{ textAlign: 'center', borderBottom: '1px dashed black', paddingBottom: '5px', marginBottom: '5px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>DIMSUM ADITYA</h2>
        <div style={{ fontSize: '11px' }}>TERMINAL {data.branch_name || 'PUSAT'}</div>
      </div>
      
      <table style={{ width: '100%', marginBottom: '5px', fontSize: '11px' }}>
        <tbody>
          <tr><td width="60%">NOTA : {data.id || '-'}</td><td width="40%">TGL  : {data.date || '-'}</td></tr>
          <tr><td>KLIEN: {data.customer_name || 'UMUM'}</td><td>KASIR: {data.admin_name || 'ADMIN'}</td></tr>
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '3px 0', marginBottom: '5px', fontSize: '11px', fontWeight: 'bold' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '50%' }}>NAMA BARANG</div>
          <div style={{ width: '15%', textAlign: 'center' }}>QTY</div>
          <div style={{ width: '35%', textAlign: 'right' }}>SUBTOTAL</div>
        </div>
      </div>

      <div style={{ minHeight: '80px', fontSize: '11px' }}>
        {data.items && data.items.length > 0 ? data.items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', marginBottom: '3px' }}>
            <div style={{ width: '50%' }}>{item.name}</div>
            <div style={{ width: '15%', textAlign: 'center' }}>{item.qty}</div>
            <div style={{ width: '35%', textAlign: 'right' }}>{rp(item.subtotal)}</div>
          </div>
        )) : (
           <div style={{ display: 'flex', marginBottom: '3px' }}>
             <div style={{ width: '50%' }}>{data.item_name || data.description || 'TRANSAKSI KAS/DO'}</div>
             <div style={{ width: '15%', textAlign: 'center' }}>{data.qty || 1}</div>
             <div style={{ width: '35%', textAlign: 'right' }}>{rp(data.amount || data.total)}</div>
           </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed black', paddingTop: '5px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>TOTAL TRANSAKSI :</span><span>{rp(data.total || data.amount)}</span>
        </div>
      </div>

      {/* TRACK RECORD HISTORI (DP & HUTANG PIUTANG) */}
      <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0', margin: '5px 0', fontSize: '11px' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '3px' }}>--- RINCIAN PEMBAYARAN ---</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>PIUTANG/TAGIHAN LAMA:</span><span>{rp(data.previous_debt)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>DIBAYAR/DP SEKARANG :</span><span>{rp(data.paid_amount || data.amount)} ({data.paymentMethod || 'CASH'})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '3px' }}>
          <span>SISA HUTANG/PIUTANG :</span><span>{rp(data.remaining_balance || 0)}</span>
        </div>
      </div>

      <table style={{ width: '100%', marginTop: '15px', textAlign: 'center', fontSize: '11px' }}>
        <tbody>
          <tr><td width="50%">TANDA TERIMA,</td><td width="50%">HORMAT KAMI,</td></tr>
          <tr><td height="40"></td><td></td></tr>
          <tr><td>(................)</td><td>( {data.admin_name || 'ADMIN'} )</td></tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px' }}>-- Terima kasih atas kepercayaannya --</div>
    </div>
  );
};

// Komponen Template Cetak Rekap A4
const A4RecapReport = ({ data }) => {
  return (
    <div className="print-a4-recap">
      <div style={{ borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', textTransform: 'uppercase' }}>LAPORAN REKAPITULASI OPERASIONAL</h1>
        <div>Cabang: {data.branch_name} | Tanggal: {data.date_range}</div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}>
          <strong>💰 TOTAL KAS (CASH)</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_cash)}</span>
        </div>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}>
          <strong>💳 TOTAL BANK (ATM)</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_atm)}</span>
        </div>
        <div style={{ flex: 1, border: '1px solid black', padding: '10px' }}>
          <strong>📝 TOTAL PIUTANG</strong><br/><span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rp(data.total_piutang)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px' }}>
        {/* Kolom Kiri: Adukan & Stok */}
        <div style={{ width: '40%' }}>
          <h3 style={{ borderBottom: '1px solid #ccc' }}>📦 REKAP STOK & ADUKAN</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid black', padding: '5px' }}>ITEM</th>
                <th style={{ border: '1px solid black', padding: '5px' }}>SISA QTY</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ border: '1px solid black', padding: '5px' }}>ADUKAN AYAM (KG)</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{data.stok_adukan} Kg</td></tr>
              <tr><td style={{ border: '1px solid black', padding: '5px' }}>DIMSUM FREEZER (PCS)</td><td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{data.stok_dimsum} Pcs</td></tr>
            </tbody>
          </table>
        </div>

        {/* Kolom Kanan: Rincian Transaksi */}
        <div style={{ width: '60%' }}>
          <h3 style={{ borderBottom: '1px solid #ccc' }}>🛒 RINCIAN TRANSAKSI (QTY ORDER)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid black', padding: '5px' }}>ID TRANSAKSI</th>
                <th style={{ border: '1px solid black', padding: '5px' }}>KLIEN</th>
                <th style={{ border: '1px solid black', padding: '5px' }}>METODE</th>
                <th style={{ border: '1px solid black', padding: '5px' }}>NOMINAL</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions && data.transactions.map((trx, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid black', padding: '5px' }}>{trx.id}</td>
                  <td style={{ border: '1px solid black', padding: '5px' }}>{trx.customer_name}</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{trx.paymentMethod}</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>{rp(trx.total || trx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// FUNGSI TRIGGER CETAK UNIVERSAL
export const triggerPrint = (type, data) => {
  let printRootEl = document.getElementById('print-root');
  if (!printRootEl) {
    printRootEl = document.createElement('div');
    printRootEl.id = 'print-root';
    document.body.appendChild(printRootEl);
  }

  const root = createRoot(printRootEl);
  
  const content = type === 'NOTA_DOTMATRIX' 
    ? <DotMatrixInvoice data={data} /> 
    : <A4RecapReport data={data} />;

  root.render(content);

  setTimeout(() => {
    window.print();
    setTimeout(() => { root.unmount(); }, 1000);
  }, 300);
};
