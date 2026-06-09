import React from 'react';
import { createRoot } from 'react-dom/client';

const rp = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

// ========================================================
// 🖨️ 1. TEMPLATE CETAK DOT MATRIX (EPSON LX 310)
// ========================================================
const DotMatrixInvoice = ({ data }) => {
  return (
    <div className="print-dot-matrix">
      
      {/* 1. HEADER & JUDUL FORMAL */}
      <div style={{ textAlign: 'center', borderBottom: '2px dashed black', paddingBottom: '8px', marginBottom: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: '900', letterSpacing: '1px' }}>{data.company_name || 'DIMSUM ADITYA'}</h2>
        <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>CABANG OPERASIONAL {data.branch_name || 'PUSAT'}</div>
        <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '5px', textDecoration: 'underline' }}>{data.title || 'BUKTI TRANSAKSI'}</div>
      </div>
      
      {/* 2. IDENTITAS & PERIODE */}
      <table style={{ width: '100%', marginBottom: '10px', fontSize: '12pt', fontWeight: 'bold' }}>
        <tbody>
          <tr><td width="55%">NO. TRX : {data.id || '-'}</td><td width="45%">PERIODE : {data.periode || '-'}</td></tr>
          <tr><td>NAMA    : {data.customer_name || 'UMUM'}</td><td>TGL TRX : {data.date || '-'}</td></tr>
          <tr><td>POSISI  : {data.position || 'STAF'}</td><td>KASIR   : {data.admin_name || 'ADMIN'}</td></tr>
        </tbody>
      </table>

      {/* 3. RINCIAN GAJI / TRANSAKSI */}
      <div style={{ borderTop: '2px dashed black', borderBottom: '2px dashed black', padding: '5px 0', marginBottom: '8px', fontWeight: 'bold' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '55%' }}>KETERANGAN</div>
          <div style={{ width: '10%', textAlign: 'center' }}>QTY</div>
          <div style={{ width: '35%', textAlign: 'right' }}>SUBTOTAL</div>
        </div>
      </div>

      <div style={{ minHeight: '60px' }}>
        {data.items && data.items.length > 0 ? data.items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', marginBottom: '5px' }}>
            <div style={{ width: '55%' }}>{item.name}</div>
            <div style={{ width: '10%', textAlign: 'center' }}>{item.qty}</div>
            <div style={{ width: '35%', textAlign: 'right' }}>{rp(item.subtotal)}</div>
          </div>
        )) : (
           <div style={{ display: 'flex', marginBottom: '5px' }}>
             <div style={{ width: '55%' }}>{data.description || 'TRANSAKSI'}</div>
             <div style={{ width: '10%', textAlign: 'center' }}>{data.qty || 1}</div>
             <div style={{ width: '35%', textAlign: 'right' }}>{rp(data.amount || data.total)}</div>
           </div>
        )}
      </div>

      <div style={{ borderTop: '2px dashed black', paddingTop: '5px', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14pt' }}>
          <span>TOTAL DITERIMA (NETTO) :</span><span>{rp(data.total || data.amount)}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11pt', marginTop: '2px' }}>
          Metode Cair: {data.paymentMethod || 'CASH'}
        </div>
      </div>

      {/* 4. TRACK RECORD HISTORI KASBON & KREDIT (BIAR KARYAWAN GAK BISA NGELES!) */}
      {data.history && (
        <div style={{ border: '2px dashed black', padding: '8px', margin: '15px 0', backgroundColor: '#f9f9f9' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '8px', textDecoration: 'underline' }}>BUKU MUTASI PINJAMAN / KREDIT</div>
          
          {/* Loop Histori Transaksi Kasbon Sebelumnya */}
          {data.history.kasbonList && data.history.kasbonList.length > 0 && (
            <div style={{ marginBottom: '8px', fontSize: '11pt' }}>
              <div style={{ borderBottom: '1px solid black', marginBottom: '4px', fontWeight: 'bold' }}>Rincian Nota Berjalan:</div>
              {data.history.kasbonList.map((k, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <div style={{ width: '70%' }}>- {k.date} ({k.id})<br/><span style={{ fontSize: '9pt', color: '#555' }}>  Ket: {k.note}</span></div>
                  <div style={{ width: '30%', textAlign: 'right' }}>{rp(k.amount)}</div>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ borderTop: '1px dashed black', margin: '5px 0' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>{data.history.labelLama || 'Akumulasi Hutang Awal'}:</span>
            <span>{rp(data.history.nominalLama)}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'red' }}>
            <span>{data.history.labelAksi || 'Dipotong Cicilan Bulan Ini'}:</span>
            <span>-{rp(data.history.nominalAksi)}</span>
          </div>
          
          <div style={{ borderTop: '2px solid black', margin: '5px 0' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '13pt' }}>
            <span>{data.history.labelBaru || 'SISA KREDIT / HUTANG'}:</span>
            <span>{rp(data.history.nominalBaru)}</span>
          </div>
        </div>
      )}

      {/* 5. TANDA TANGAN */}
      <table style={{ width: '100%', marginTop: '25px', textAlign: 'center' }}>
        <tbody>
          <tr><td width="50%">PENERIMA / KARYAWAN,</td><td width="50%">HORMAT KAMI,</td></tr>
          <tr><td height="60"></td><td></td></tr>
          <tr><td style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{data.customer_name || '................'}</td><td style={{ textDecoration: 'underline' }}>{data.admin_name || 'ADMIN'}</td></tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '11pt', fontStyle: 'italic' }}>-- Dokumen ini sah dicetak oleh Sistem ERP Dimsum Aditya --</div>
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
