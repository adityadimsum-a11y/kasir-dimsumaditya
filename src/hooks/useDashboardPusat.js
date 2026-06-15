import { useState, useEffect, useCallback } from 'react';
// Hubungkan dengan service API Anda jika ada, contoh:
// import { getDashboardPusatData } from '../services/api';

export const useDashboardPusat = () => {
  const [stats, setStats] = useState({
    totalPengguna: 0,
    totalTransaksi: 0,
    pendapatanBulanan: 0,
    aktifWilayah: 0,
  });
  
  const [chartData, setChartData] = useState([]);
  const [regionalPerformance, setRegionalPerformance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterPeriode, setFilterPeriode] = useState('bulan_ini'); // opsi: hari_ini, minggu_ini, bulan_ini, tahun_ini

  // Fungsi simulasi mengambil data dari API
  const fetchDashboardData = useCallback(async (periode) => {
    setIsLoading(true);
    setError(null);
    try {
      // Ganti blok ini dengan call API asli Anda, contoh:
      // const response = await getDashboardPusatData(periode);
      
      // Simulasi delay jaringan
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Mock Data (Sesuaikan dengan payload dari backend Anda)
      const mockData = {
        stats: {
          totalPengguna: 12540,
          totalTransaksi: 4520,
          pendapatanBulanan: 150000000,
          aktifWilayah: 34,
        },
        chartData: [
          { name: 'Jan', pendapatan: 40000000 },
          { name: 'Feb', pendapatan: 30000000 },
          { name: 'Mar', pendapatan: 20000000 },
          { name: 'Apr', pendapatan: 60000000 },
          { name: 'Mei', pendapatan: 150000000 },
        ],
        regionalPerformance: [
          { id: 1, wilayah: 'DKI Jakarta', total: 85000000, status: 'Optimal' },
          { id: 2, wilayah: 'Jawa Barat', total: 45000000, status: 'Optimal' },
          { id: 3, wilayah: 'Jawa Timur', total: 20000000, status: 'Cukup' },
        ]
      };

      setStats(mockData.stats);
      setChartData(mockData.chartData);
      setRegionalPerformance(mockData.regionalPerformance);
    } catch (err) {
      setError(err.message || 'Gagal memuat data dashboard pusat.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memanggil data setiap kali filter periode berubah
  useEffect(() => {
    fetchDashboardData(filterPeriode);
  }, [filterPeriode, fetchDashboardData]);

  // Fungsi untuk refresh data secara manual
  const handleRefresh = () => {
    fetchDashboardData(filterPeriode);
  };

  return {
    stats,
    chartData,
    regionalPerformance,
    isLoading,
    error,
    filterPeriode,
    setFilterPeriode,
    refreshData: handleRefresh,
  };
};

export default useDashboardPusat;
