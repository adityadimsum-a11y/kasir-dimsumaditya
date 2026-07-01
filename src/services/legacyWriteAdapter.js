import { apiRequest } from './erpApiClient';

const READ_ONLY_MESSAGE = 'Bridge Part 1 masih mode baca. Simpan transaksi lama belum disambungkan ke mesin baru. Lanjut di Bridge Package 2.';

export async function legacyWriteAction({ action, tableName, payload, user, sessionToken, requestId }) {
  // Guardrail: jangan biarkan UI lama menulis ke pola CRUD lama.
  // Part 2 nanti mapping write resmi ke createOrder/createCashExpense/createPayable.
  const table = String(tableName || '').trim();
  const oldAction = String(action || '').trim();

  if (oldAction === 'delete') {
    return {
      success: false,
      message: 'Void/delete dari UI lama belum aktif. Nanti diarahkan ke endpoint void/reversal baru, bukan CRUD lama.',
    };
  }

  // Placeholder endpoint opsional, hanya untuk audit/test jika backend menyediakan.
  if (table === 'bridge_test') {
    return apiRequest('legacyBridgePing', { action, tableName, payload, requestId }, sessionToken);
  }

  return {
    success: false,
    message: READ_ONLY_MESSAGE,
  };
}
