export const MENU_GROUPS = [
  {
    key: "pusat-kendali",
    title: "Pusat Kendali",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: true,
    items: [
      {
        key: "papan-pusat",
        label: "Dashboard Owner",
        description: "Ringkasan keputusan harian: uang, penjualan, stok, hutang, PO, payroll, dan tindak lanjut.",
      },
      {
        key: "owner-control",
        label: "Owner Control",
        description: "Kontrol pusat cash recovery, dompet, 4 Amplop, supplier, kewajiban, dan keputusan owner.",
      },
    ],
  },
  {
    key: "produksi-stok",
    title: "Produksi & Stok",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG"],
    defaultOpen: true,
    items: [
      {
        key: "drop-ayam",
        label: "DROP Ayam",
        description: "Input ayam masuk, harga aktual, nota, lot, dan hutang Nana.",
      },
      {
        key: "stok-ayam",
        label: "Stok Ayam",
        description: "Pantau stok ayam awal, masuk, dipakai, lot aktif, dan sisa.",
      },
      {
        key: "produksi-adukan",
        label: "Produksi / Adukan",
        description: "Catat adukan, ayam dipakai, hasil pcs, HPP historis, dan posting produksi.",
      },
      {
        key: "barang-freezer",
        label: "Barang Masuk Freezer",
        description: "Hasil produksi yang sudah diposting dan masuk stok jadi.",
      },
      {
        key: "stok-jadi",
        label: "Stok Jadi",
        description: "Pantau stok bebas, reserved, PO, karantina, dan barang keluar.",
      },
    ],
  },
  {
    key: "penjualan-distribusi",
    title: "Penjualan & Distribusi",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    defaultOpen: true,
    items: [
      {
        key: "kasir-order",
        label: "Kasir / Order",
        description: "Order, invoice, pembayaran, piutang, reservasi stok, dan COGS.",
      },
      {
        key: "antrian-po",
        label: "Antrian PO",
        description: "PO harian, PO karantina, shortage, due date, dan kebutuhan produksi.",
      },
      {
        key: "request-do",
        label: "Request & DO",
        description: "Permintaan barang, approval pusat, DO, in-transit, penerimaan, dan ongkir.",
      },
    ],
  },
  {
    key: "uang-kewajiban",
    title: "Uang & Kewajiban",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: true,
    items: [
      {
        key: "uang-masuk",
        label: "Uang Masuk",
        description: "Pembayaran aktual customer, penerimaan non-sales, dan sumber mutasi dompet.",
      },
      {
        key: "kas-dompet",
        label: "Kas & Dompet",
        description: "Cash, BCA, BRI, saldo awal, transfer, dan mutasi uang hidup.",
      },
      {
        key: "kas-keluar",
        label: "Belanja & Kas Keluar",
        description: "Belanja operasional, nota, multi-item, dan Wallet OUT.",
      },
      {
        key: "hutang-nana",
        label: "Hutang Nana",
        description: "Nota berjalan, hutang lama/RECON, pembayaran supplier, dan selipan hutang lama.",
      },
      {
        key: "kewajiban-owner",
        label: "Kewajiban Owner",
        description: "Cicilan usaha, tagihan rutin, jatuh tempo, pembayaran, dan saldo kewajiban.",
      },
      {
        key: "empat-amplop",
        label: "4 Amplop",
        description: "Alokasi uang aktual ke Ayam, Operasional, Cicilan/Kewajiban, dan Owner.",
      },
    ],
  },
  {
    key: "cabang",
    title: "Cabang",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    defaultOpen: false,
    items: [
      {
        key: "laporan-harian",
        label: "Laporan Harian",
        description: "Rekap harian otomatis dari transaksi sumber per lokasi.",
      },
      {
        key: "setoran-cabang",
        label: "Setoran Cabang",
        description: "Submit, validasi, approval, transfer cabang ke pusat, dan bukti setoran.",
      },
    ],
  },
  {
    key: "karyawan",
    title: "Karyawan",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "hrd-payroll",
        label: "HRD / Payroll",
        description: "Karyawan, absensi, kasbon, pinjaman, tunjangan, payroll, closing, dan slip gaji.",
      },
    ],
  },
  {
    key: "master-data",
    title: "Master Data",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "master-produk",
        label: "Produk",
        description: "Produk, harga, status jual, unit, dan aturan proses produksi.",
      },
      {
        key: "master-customer",
        label: "Customer",
        description: "Pelanggan, jenis harga, dan referensi transaksi.",
      },
      {
        key: "master-supplier",
        label: "Supplier",
        description: "Supplier usaha, termasuk Nana Chicken dan vendor operasional.",
      },
      {
        key: "master-lokasi",
        label: "Lokasi",
        description: "Tangerang, Pemalang, Cibinong, tipe lokasi, dan kesiapan operasional.",
      },
    ],
  },
  {
    key: "laporan-arsip",
    title: "Laporan & Arsip",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "closing-owner",
        label: "Laporan Owner",
        description: "Laporan periode, snapshot, lock, revisi, dan cetak A4 owner.",
      },
      {
        key: "arsip-digital",
        label: "Arsip Digital",
        description: "Pencarian transaksi, rantai ID, dokumen, print log, dan audit trail.",
      },
    ],
  },
  {
    key: "sistem",
    title: "Sistem",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    systemGroup: true,
    items: [
      {
        key: "go-live-check",
        label: "Go-Live Control",
        description: "Opening data, kesiapan lokasi, dan siklus operasional pertama.",
      },
      {
        key: "system-health",
        label: "Data Health",
        description: "Pemeriksaan integritas data, ID, sumber transaksi, dan kesehatan relasi.",
      },
      {
        key: "permission-role-check",
        label: "Permission & Role",
        description: "Hak akses Owner, Tangerang, Pemalang, Cibinong, dan staff.",
      },
      {
        key: "print-backup",
        label: "Print & Backup",
        description: "Pusat cetak safety, export, manifest, dan kontrol backup.",
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
