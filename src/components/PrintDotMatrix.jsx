import React, { useEffect } from 'react';
import { formatDate, formatRp } from '../utils/helpers';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) { setTimeout(() => { window.print(); }, 500); }
  }, [printData]);

  if (!printData) return null;
  const { type, data } = printData;

  // 1. THERMAL 58mm RECEIPT (KASIR OUTLET)
  if (type === 'receipt' || type === 'INVOICE') {
    const isReceipt = type === 'receipt';
    const orderData = isReceipt ? data.order : data;
    const paymentData = isReceipt ? data.payment : null;

    return (
      <div className="fixed inset-0 z-[9999] bg-white text-black flex justify-center items-start pt-4 print:pt-0 thermal-58">
        <div className="w-[54mm] pb-10">
          <div className="text-center mb-2">
            <h1 className="font-bold text-sm uppercase">DIMSUM ADITYA</h1>
            <div className="text-[10px]">{orderData.branch_id === 'PUSAT' ? 'HQ FACTORY' : `NODE: ${orderData.branch_id}`}</div>
            <div className="text-[10px]">Tgl: {formatDate(orderData.date)}</div>
          </div>
          <div className="dashed-line"></div>
          <div className="text-[10px] mb-1">Inv: {orderData.id}</div>
          <div className="text-[10px] mb-2 uppercase">Plg: {orderData.customer_name || orderData.customer}</div>
          <div className="dashed-line"></div>
          
          <table className="w-full text-[10px] text-left mb-2">
            <tbody>
              <tr>
                <td colSpan="3" className="uppercase pb-1">{orderData.itemName || 'DIMSUM'}</td>
              </tr>
              <tr>
                <td>{orderData.qty}x</td>
                <td>{formatRp(orderData.price || (orderData.totalTagihan/orderData.qty)).replace('Rp','')}</td>
                <td className="text-right font-bold">{formatRp(orderData.total || orderData.totalTagihan).replace('Rp','')}</td>
              </tr>
            </tbody>
          </table>
          <div className="dashed-line"></div>
          
          <div className="flex justify-between text-[11px] font-bold mt-1">
            <span>TOTAL:</span>
            <span>{formatRp(orderData.total || orderData.totalTagihan)}</span>
          </div>

          {isReceipt && (
            <>
              <div className="flex justify-between text-[10px] mt-1">
                <span>DIBAYAR ({paymentData.paymentMethod}):</span>
                <span>{formatRp(paymentData.amount)}</span>
              </div>
              <div className="dashed-line mt-2"></div>
              <div className="flex justify-between text-[10px] font-bold">
                <span>SISA TAGIHAN:</span>
                <span>{formatRp(paymentData.sisaAtThisPoint)}</span>
              </div>
            </>
          )}

          <div className="text-center text-[9px] mt-4 pt-2 border-t border-black">
            <div>Terima Kasih!</div>
            <div>Powered by DimsumAditya ERP</div>
          </div>
        </div>
        <button onClick={onClose} className="fixed top-4 right-4 bg-red-600 text-white font-bold px-4 py-2 rounded-lg no-print">Tutup (X)</button>
      </div>
    );
  }

  // 2. A4 / SETENGAH SURAT (DO, SLIP GAJI, LAPORAN)
  return (
    <div className="fixed inset-0 z-[9999] bg-white text-black print-only-wrapper p-8">
      {type === 'DO' && (
        <div className="w-full max-w-4xl mx-auto font-mono text-sm">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
            <div><h1 className="text-2xl font-black uppercase tracking-widest">DIMSUM ADITYA</h1><p className="font-bold">Surat Jalan Logistik / Delivery Order</p></div>
            <div className="text-right"><h2 className="text-xl font-black uppercase">NO: {data.id}</h2><div className="font-bold mt-1">TGL: {formatDate(data.date)}</div></div>
          </div>
          <div className="flex justify-between mb-8 font-bold text-base p-4 bg-gray-100 border border-black">
            <div><span className="inline-block w-32">DARI NODE:</span> {data.source_branch}</div>
            <div><span className="inline-block w-32">TUJUAN NODE:</span> {data.destination_branch}</div>
          </div>
          <table className="w-full border-collapse border border-black mb-8">
            <thead><tr className="bg-gray-200"><th className="border border-black p-3 text-left">Deskripsi Barang</th><th className="border border-black p-3 text-center">Qty (Pcs)</th></tr></thead>
            <tbody><tr><td className="border border-black p-3 font-bold uppercase">{data.item_name}</td><td className="border border-black p-3 text-center font-black text-xl">{Number(data.qty).toLocaleString('id-ID')}</td></tr></tbody>
          </table>
          <div className="grid grid-cols-3 gap-8 text-center mt-16 font-bold">
            <div><p className="mb-20">Pengirim ({data.source_branch})</p><p className="border-t border-black pt-2">( .................... )</p></div>
            <div><p className="mb-20">Driver / Ekspedisi</p><p className="border-t border-black pt-2">( .................... )</p></div>
            <div><p className="mb-20">Penerima ({data.destination_branch})</p><p className="border-t border-black pt-2">( .................... )</p></div>
          </div>
        </div>
      )}
      <button onClick={onClose} className="fixed top-4 right-4 bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow-lg no-print">Tutup Layar Cetak (X)</button>
    </div>
  );
}
