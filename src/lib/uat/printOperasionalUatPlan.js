export const printOperasionalUatPlan = {
  "title": "Print Operasional / Nota / SPK / Rekap Harian Final Check",
  "version": "Part 7F",
  "mode": "Checklist Read-Only",
  "objective": "Pastikan dokumen harian siap dipakai operasional: nota customer, SPK/WO Produksi tanpa harga, DO/surat jalan, kas masuk/keluar, slip/rekap, dan rekap harian bisa dipreview/print/export dari data live dengan print history dan source ID.",
  "scenarios": [
    {
      "id": "7F-PRE",
      "title": "Persiapan Print Operasional",
      "risk": "Low",
      "steps": [
        "Login sebagai Owner/Tangerang.",
        "Buka Print & Backup Safety, pastikan status aman.",
        "Siapkan ID UAT: Order/Invoice, Production Batch/SPK, KasIn/Payment, KasOut, Setoran jika ada.",
        "Pastikan printer LX-310 / printer biasa / Save PDF tersedia sesuai kebutuhan.",
        "Catat format dokumen mana yang sudah ada di sistem."
      ],
      "expected": [
        "Print & Backup aman.",
        "ID transaksi UAT tersedia.",
        "Mode preview/print/export bisa dibuka.",
        "Tidak perlu input ulang data untuk print."
      ]
    },
    {
      "id": "7F-01",
      "title": "Print Nota Customer / Invoice",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka invoice/order UAT dari Part 7B.",
        "Klik preview/print nota customer jika tersedia.",
        "Cek nama customer, tanggal, item, qty, harga, total, payment, sisa/piutang.",
        "Cek ukuran/format nota untuk customer.",
        "Pastikan HPP/modal/profit tidak tampil di nota customer."
      ],
      "expected": [
        "Nota customer tampil dari data live.",
        "Item, qty, harga, total benar.",
        "Status bayar/piutang jelas.",
        "HPP/modal/profit tidak tercetak.",
        "Invoice ID tampil atau bisa ditelusuri."
      ]
    },
    {
      "id": "7F-02",
      "title": "Print SPK / WO Produksi Tanpa Harga",
      "risk": "High",
      "steps": [
        "Buka Produksi / Adukan atau Antrian Produksi.",
        "Pilih Production Batch / SPK UAT.",
        "Klik preview/print SPK/WO jika tersedia.",
        "Cek produk, qty produksi, adukan, catatan produksi, tanggal, lokasi.",
        "Pastikan harga jual, HPP, profit, dan data sensitif owner tidak tampil."
      ],
      "expected": [
        "SPK/WO tampil dari data live.",
        "Jumlah produksi/adukan benar.",
        "Tidak ada harga jual/HPP/profit di SPK produksi.",
        "SPK punya ID/source jelas.",
        "Cocok dipakai leader produksi."
      ]
    },
    {
      "id": "7F-03",
      "title": "Print DO / Surat Jalan Jika Ada",
      "risk": "High",
      "steps": [
        "Buka Request & DO / Distribusi Cabang jika ada transaksi UAT.",
        "Pilih DO ID.",
        "Klik preview/print surat jalan.",
        "Cek asal, tujuan, produk, qty, penerima, tanggal, catatan.",
        "Pastikan DO tidak otomatis dianggap uang masuk."
      ],
      "expected": [
        "DO/surat jalan tampil dari data live.",
        "Qty dan lokasi asal/tujuan benar.",
        "Status pengiriman jelas.",
        "Tidak mencetak HPP/profit internal.",
        "DO punya source ID dan arsip."
      ]
    },
    {
      "id": "7F-04",
      "title": "Print Kas Masuk / Payment Receipt",
      "risk": "High",
      "steps": [
        "Buka Payment/Kas Masuk UAT.",
        "Klik preview/print bukti pembayaran jika tersedia.",
        "Cek customer/source invoice, nominal, dompet, metode, tanggal, penerima.",
        "Cek apakah receipt bisa dicari ulang dari Arsip."
      ],
      "expected": [
        "Bukti kas masuk tampil dari Payment ID.",
        "Nominal dan dompet benar.",
        "Source invoice/order jelas.",
        "Tidak ada receipt tanpa source ID.",
        "Arsip menemukan bukti payment."
      ]
    },
    {
      "id": "7F-05",
      "title": "Print Kas Keluar / Belanja",
      "risk": "High",
      "steps": [
        "Buka Kas Keluar UAT dari Part 7D.",
        "Klik preview/print bukti kas keluar.",
        "Cek kategori, toko/supplier jika ada, item/uraian, nominal, dompet, PIC, tanggal.",
        "Cek apakah bukti print tersimpan di arsip."
      ],
      "expected": [
        "Bukti kas keluar tampil dari data live.",
        "Nominal dan dompet benar.",
        "Kategori biaya jelas.",
        "Source ID tampil.",
        "Print history/arsip tersimpan jika fitur sudah ada."
      ]
    },
    {
      "id": "7F-06",
      "title": "Print Hutang Nana / Supplier Ledger",
      "risk": "High",
      "steps": [
        "Buka Hutang Nana.",
        "Pilih supplier/nota UAT.",
        "Klik print/export statement jika tersedia.",
        "Cek nota berjalan, pembayaran, selipan old debt, sisa hutang.",
        "Cek apakah current note dan old debt dipisah jelas."
      ],
      "expected": [
        "Supplier ledger tampil dari data live.",
        "Current note, payment, old debt/selipan jelas.",
        "Sisa hutang benar.",
        "Source ID pembayaran dan DROP tampil.",
        "Cocok untuk kontrol owner/supplier."
      ]
    },
    {
      "id": "7F-07",
      "title": "Print Rekap Harian Cabang / Owner",
      "risk": "High",
      "steps": [
        "Buka Laporan Harian / Papan Pantau / Closing Harian jika tersedia.",
        "Pilih tanggal UAT.",
        "Klik print/export rekap harian.",
        "Cek penjualan, payment, piutang, kas keluar, setoran, stok, catatan.",
        "Bandingkan dengan transaksi UAT."
      ],
      "expected": [
        "Rekap harian tampil dari transaksi live.",
        "Total omzet/payment/piutang/kas keluar benar.",
        "Stok masuk/keluar terbaca.",
        "Tidak ada angka dummy.",
        "Rekap bisa disimpan PDF/export."
      ]
    },
    {
      "id": "7F-08",
      "title": "Print History / Reprint Audit",
      "risk": "Medium",
      "steps": [
        "Print/preview salah satu nota atau bukti UAT.",
        "Buka detail arsip dokumen tersebut.",
        "Cek apakah ada print history: siapa, kapan, dokumen apa.",
        "Coba reprint dari transaksi yang sama jika tersedia."
      ],
      "expected": [
        "Print/reprint tidak mengubah transaksi.",
        "Print history tercatat jika fitur sudah ada.",
        "Reprint memakai data transaksi yang sama.",
        "Tidak membuat invoice/payment ganda."
      ]
    },
    {
      "id": "7F-09",
      "title": "Export PDF / CSV / JSON Safety",
      "risk": "Medium",
      "steps": [
        "Buka Print & Backup Safety.",
        "Coba export/copy ringkasan atau export CSV/JSON jika tersedia.",
        "Pastikan hasil export tidak error.",
        "Cek nama file/tanggal/export log jika ada."
      ],
      "expected": [
        "Export berjalan tanpa error.",
        "Export tidak mengubah transaksi.",
        "Data export sesuai tampilan sumber.",
        "Backup/export bisa dipakai sebelum operasional harian."
      ]
    },
    {
      "id": "7F-10",
      "title": "Print Layout Mobile/Desktop",
      "risk": "Medium",
      "steps": [
        "Buka dokumen print dari desktop.",
        "Cek preview.",
        "Buka dari mobile/tablet jika memungkinkan.",
        "Pastikan dokumen tidak melebar/terpotong.",
        "Coba Save PDF browser."
      ],
      "expected": [
        "Preview desktop rapi.",
        "Preview mobile masih bisa dibaca.",
        "PDF tidak terpotong fatal.",
        "Tabel/item tidak pecah parah."
      ]
    },
    {
      "id": "7F-11",
      "title": "Final No Sensitive Data Leak",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka nota customer.",
        "Buka SPK/WO produksi.",
        "Buka DO/surat jalan.",
        "Buka rekap internal owner.",
        "Bandingkan data yang boleh keluar vs data internal."
      ],
      "expected": [
        "Nota customer tidak menampilkan HPP/profit.",
        "SPK produksi tidak menampilkan harga jual/HPP/profit.",
        "DO tidak menampilkan profit owner.",
        "Rekap owner boleh menampilkan data internal sesuai role.",
        "Cabang tidak bisa print data payroll/owner sensitif."
      ]
    }
  ],
  "blockers": [
    "Nota customer tidak bisa diprint/preview.",
    "Nota customer mencetak HPP/modal/profit.",
    "SPK produksi mencetak harga jual/HPP/profit.",
    "Print menggunakan data dummy/statis, bukan transaksi live.",
    "Print membuat invoice/payment/order ganda.",
    "Bukti kas masuk/keluar tidak punya source ID.",
    "Rekap harian totalnya tidak sama dengan transaksi live.",
    "Export/print error total sehingga tidak bisa backup operasional.",
    "Cabang bisa mencetak data payroll/owner sensitif.",
    "Reprint mengubah transaksi lama."
  ]
};
