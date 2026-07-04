export const MENU_GROUPS = [
  {
    key: "pusat-kendali",
    title: "Pusat Kendali",
    visibleFor: ["OWNER", "TANGERANG"],
    items: [
      {
        key: "papan-pusat",
        label: "Papan Pantau",
        description: "Ringkasan uang masuk, stok, produksi, dan tugas penting.",
      },
      {
        key: "owner-control",
        label: "Owner Control",
        description: "Kontrol pusat untuk keputusan owner dan HO Tangerang.",
      },
      {
        key: "arsip-digital",
        label: "Arsip Digital",
        description: "Cari transaksi, bukti, audit, dan riwayat ID.",
      },
    ],
  },
  {
    key: "nyawa-produksi",
    title: "Nyawa Produksi",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG"],
    items: [
      {
        key: "drop-ayam",
        label: "DROP Ayam",
        description: "Input ayam masuk, harga aktual, nota, dan hutang Nana.",
      },
      {
        key: "stok-ayam",
        label: "Stok Ayam",
        description: "Pantau stok ayam awal, masuk, dipakai, dan sisa.",
      },
      {
        key: "produksi-adukan",
        label: "Produksi / Adukan",
        description: "Catat adukan, ayam dipakai, hasil pcs, dan barang freezer.",
      },
      {
        key: "barang-freezer",
        label: "Barang Masuk Freezer",
        description: "Hasil produksi masuk stok jadi siap jual.",
      },
      {
        key: "stok-jadi",
        label: "Stok Jadi",
        description: "Pantau stok bebas, PO, karantina, dan barang keluar.",
      },
    ],
  },
  {
    key: "penjualan",
    title: "Penjualan",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    items: [
      {
        key: "kasir-order",
        label: "Kasir / Order",
        description: "Input order, invoice, pembayaran, dan piutang.",
      },
      {
        key: "antrian-po",
        label: "Antrian PO",
        description: "Pantau PO harian, PO besar, stok ditahan, dan shortage.",
      },
    ],
  },
  {
    key: "uang-kewajiban",
    title: "Uang & Kewajiban",
    visibleFor: ["OWNER", "TANGERANG"],
    items: [
      {
        key: "uang-masuk",
        label: "Uang Masuk",
        description: "Pembayaran aktual dari customer dan cabang.",
      },
      {
        key: "kas-dompet",
        label: "Kas & Dompet",
        description: "Cash, BCA, BRI, dan mutasi uang hidup.",
      },
      {
        key: "kas-keluar",
        label: "Belanja & Kas Keluar",
        description: "Belanja harian, nota supplier, dan potong kas.",
      },
      {
        key: "hutang-nana",
        label: "Hutang Nana",
        description: "Sisa hutang ayam, nota berjalan, dan pembayaran supplier.",
      },
      {
        key: "empat-amplop",
        label: "4 Amplop",
        description: "Pembagian uang aktual: ayam, operasional, cicilan, owner.",
      },
    ],
  },
  {
    key: "cabang",
    title: "Cabang",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    items: [
      {
        key: "laporan-harian",
        label: "Laporan Harian",
        description: "Rekap harian cabang dari transaksi hidup.",
      },
      {
        key: "setoran-cabang",
        label: "Setoran Cabang",
        description: "Setoran, validasi, approval, dan bukti uang.",
      },
    ],
  },
  {
    key: "master-data",
    title: "Master Data",
    visibleFor: ["OWNER", "TANGERANG"],
    items: [
      {
        key: "master-produk",
        label: "Produk",
        description: "Data produk, harga, status jual, dan kategori.",
      },
      {
        key: "master-customer",
        label: "Customer",
        description: "Data pelanggan, harga khusus, dan riwayat order.",
      },
      {
        key: "master-supplier",
        label: "Supplier",
        description: "Data supplier, termasuk Nana Chicken.",
      },
      {
        key: "master-lokasi",
        label: "Lokasi",
        description: "Tangerang, Pemalang, Cibinong, dan titik stok.",
      },
    ],
  },
];

export const PAGE_META = MENU_GROUPS.reduce((acc, group) => {
  group.items.forEach((item) => {
    acc[item.key] = {
      ...item,
      groupTitle: group.title,
    };
  });
  return acc;
}, {});
