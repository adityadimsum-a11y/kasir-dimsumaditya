export const rpFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const formatRp = (angka) => {
  const num = Number(angka);
  if (isNaN(num) || num === 0) return 'Rp 0';
  return rpFormatter.format(num);
};

export const parseRp = (str) => {
  if (typeof str === 'number') return str;
  const num = Number(String(str || '').replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
};

export const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getFirstDayOfMonthStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

export const getLocalYMD = (dateVal) => {
  if (!dateVal) return '';

  const str = String(dateVal);

  // Jika format sudah YYYY-MM-DD murni, langsung kembalikan
  if (str.length === 10 && str[4] === '-') return str;

  const d = new Date(dateVal);

  // Fallback jika tanggal tidak valid
  if (isNaN(d.getTime())) {
    return str.split('T')[0].substring(0, 10);
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
};

export const formatDate = (date) => {
  if (!date) return '-';

  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return String(date).split('T')[0];
  }

  return dateFormatter.format(d);
};

// ✅ Tambahan penting agar import formatTime tidak bikin Vercel gagal build
export const formatTime = (date) => {
  if (!date) return '-';

  const d = new Date(date);

  if (isNaN(d.getTime())) return '-';

  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format tanggal + jam, aman jika suatu modul butuh timestamp lengkap
export const formatDateTime = (date) => {
  if (!date) return '-';

  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return String(date);
  }

  return `${formatDate(d)} ${formatTime(d)}`;
};

export const generateId = (prefix, date) => {
  const d = new Date(date || Date.now());

  const mmyy = isNaN(d.getTime())
    ? 'ERR'
    : `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;

  const seq = String(Math.floor(Math.random() * 9000) + 1000);

  return `${prefix}-DMA-${mmyy}-${seq}`;
};

export const generateRequestId = () => {
  return `REQ-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
};

export const safeSort = (a, b) => {
  const da = new Date(a?.date || 0).getTime();
  const db = new Date(b?.date || 0).getTime();

  if (isNaN(da) || isNaN(db)) return -1;

  return db - da;
};

export const safeNumber = (value) => {
  const num = Number(value || 0);
  return isNaN(num) ? 0 : num;
};

export const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

export const terbilang = (angka) => {
  const num = Math.floor(Number(angka));

  if (isNaN(num) || num <= 0) return 'Nol';

  const t = (n) => {
    if (n < 12) {
      return [
        '',
        'Satu',
        'Dua',
        'Tiga',
        'Empat',
        'Lima',
        'Enam',
        'Tujuh',
        'Delapan',
        'Sembilan',
        'Sepuluh',
        'Sebelas',
      ][n];
    }

    if (n < 20) return `${t(n - 10)} Belas`;

    if (n < 100) {
      return `${t(Math.floor(n / 10))} Puluh${n % 10 === 0 ? '' : ` ${t(n % 10)}`}`;
    }

    if (n < 200) {
      return `Seratus${n - 100 === 0 ? '' : ` ${t(n - 100)}`}`;
    }

    if (n < 1000) {
      return `${t(Math.floor(n / 100))} Ratus${n % 100 === 0 ? '' : ` ${t(n % 100)}`}`;
    }

    if (n < 2000) {
      return `Seribu${n - 1000 === 0 ? '' : ` ${t(n - 1000)}`}`;
    }

    if (n < 1000000) {
      return `${t(Math.floor(n / 1000))} Ribu${n % 1000 === 0 ? '' : ` ${t(n % 1000)}`}`;
    }

    if (n < 1000000000) {
      return `${t(Math.floor(n / 1000000))} Juta${n % 1000000 === 0 ? '' : ` ${t(n % 1000000)}`}`;
    }

    if (n < 1000000000000) {
      return `${t(Math.floor(n / 1000000000))} Milyar${n % 1000000000 === 0 ? '' : ` ${t(n % 1000000000)}`}`;
    }

    return '';
  };

  return t(num);
};

export const KATEGORI_HARGA = {
  Reseller: 2125,
  Pemalang: 2250,
  Mitra: 2000,
  Eceran: 3000,
  Shopee: 0,
  Tokopedia: 0,
  TikTok: 0,
  ShopeeFood: 0,
  GoFood: 0,
};

export const SATUAN_BARANG = [
  'Kg',
  'Gram',
  'Pack',
  'Kantong',
  'Pcs',
  'Bungkus',
  'Liter',
  'Tabung',
  'Bal',
  'Dus',
  'Krat',
  'Lusin',
];

export const KATEGORI_PENGELUARAN = [
  'Operasional & Transport',
  'Konsumsi Karyawan',
  'Kasbon',
  'Jamuan',
  'Setoran / Closing Kas Harian',
  'Lainnya',
];
