import { useState, useEffect } from 'react'
import { useTableCards } from '@/utils/useTableCards'
import { financeAPI } from '@/api/client'
import { getCleanErrorMessage } from '@/errors'
import { format, startOfMonth } from 'date-fns'
import { id } from 'date-fns/locale'
import { Search, Calendar, FileText, Eye, HelpCircle, User, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'

interface LedgerTransaction {
  id: string
  transaction_date: string
  account_name: string
  description: string
  transaction_type: 'IN' | 'OUT'
  amount: number
  category: string
  source_module: string
  created_by_name: string
}

const CATEGORY_LABELS: Record<string, string> = {
  SALES: 'Penjualan',
  TITIPAN_FEE: 'Jasa Titipan/Giling',
  PURCHASE_PAYMENT: 'Bayar Hutang Petani',
  BATCH_PAYMENT: 'Bayar Hutang Batch',
  LOGISTICS: 'Kuli Logistik',
  CALO_PAYOUT: 'Komisi Calo',
  SALE_DEDUCTION: 'Potongan Customer',
  DRYING_COST: 'Biaya Jemur',
  PROCESS_COST: 'Biaya Giling',
  OVERHEAD: 'Overhead / Operasional',
  CAPITAL_IN: 'Setoran Modal / Koreksi',
  CAPITAL_OUT: 'Penarikan Modal / Prive',
  TRANSFER: 'Transfer Antar Kas'
}

export default function FinanceLedger() {
    const tableCardsRef = useTableCards()

  const [ledger, setLedger] = useState<LedgerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    search: '',
    type: '',
    category: ''
  })
  
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [txDetail, setTxDetail] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    loadLedger()
  }, [filters.startDate, filters.endDate])

  const loadLedger = async () => {
    try {
      setLoading(true)
      const res = await financeAPI.getReport(filters.startDate, filters.endDate)
      setLedger(res.data.ledger || [])
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDetail = async (tx: LedgerTransaction) => {
    setSelectedTx(tx)
    setIsModalOpen(true)
    setDetailLoading(true)
    setTxDetail(null)
    try {
      const res = await financeAPI.getTransactionDetail(tx.id)
      setTxDetail(res.data)
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
  }

  // Frontend filter implementation for search, type, and category
  const filteredLedger = ledger.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      (tx.account_name || '').toLowerCase().includes(filters.search.toLowerCase())
    const matchesType = filters.type ? tx.transaction_type === filters.type : true
    const matchesCategory = filters.category ? tx.category === filters.category : true
    return matchesSearch && matchesType && matchesCategory
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Buku Besar Keuangan (General Ledger)</h1>
        <p className="text-stone-600 text-sm">Daftar lengkap transaksi kas yang telah disetujui.</p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-stone-200 border border-stone-300 p-5 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Tanggal Mulai</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-brand-light-green focus:border-brand-light-green transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Tanggal Selesai</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-brand-light-green focus:border-brand-light-green transition-all"
              />
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Cari Deskripsi / Kas</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                placeholder="Kata kunci..."
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-brand-light-green focus:border-brand-light-green transition-all"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Tipe Mutasi</label>
            <select
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-4 py-2.5 text-sm focus:ring-brand-light-green focus:border-brand-light-green"
            >
              <option value="">Semua Tipe</option>
              <option value="IN">Kas Masuk (IN)</option>
              <option value="OUT">Kas Keluar (OUT)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Kategori</label>
            <select
              value={filters.category}
              onChange={e => setFilters({ ...filters, category: e.target.value })}
              className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-4 py-2.5 text-sm focus:ring-brand-light-green focus:border-brand-light-green"
            >
              <option value="">Semua Kategori</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-stone-200 border border-stone-300/60 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-24 flex justify-center">
            <div className="spinner"></div>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="py-20 text-center text-stone-600">
            <FileText className="w-12 h-12 mx-auto text-stone-400 mb-3" />
            <p className="font-bold">Tidak ada transaksi ditemukan</p>
            <p className="text-xs text-stone-500 mt-1">Silakan sesuaikan tanggal atau filter pencarian Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableCardsRef} className="table-cards w-full md:min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/30 text-stone-600 text-[10px] font-black uppercase tracking-widest border-b border-stone-300">
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Rekening / Kas</th>
                  <th className="px-6 py-4">Deskripsi / Rincian</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4 text-center">Tipe</th>
                  <th className="px-6 py-4 text-right">Jumlah (IDR)</th>
                  <th className="px-6 py-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-300/50">
                {filteredLedger.map((tx) => {
                  const isIn = tx.transaction_type === 'IN'
                  return (
                    <tr key={tx.id} className="hover:bg-stone-300/30 transition-colors">
                      <td className="px-6 py-4.5 whitespace-nowrap text-xs text-stone-700">
                        {format(new Date(tx.transaction_date), 'd MMM yyyy, HH:mm', { locale: id })}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap font-bold text-stone-900 text-xs">
                        {tx.account_name || '—'}
                      </td>
                      <td className="px-6 py-4.5 text-xs text-stone-800">
                        {tx.description}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className="text-[10px] font-medium text-stone-700 bg-stone-300/60 px-2 py-1 rounded border border-stone-400/40">
                          {CATEGORY_LABELS[tx.category] || tx.category}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black leading-none ${
                          isIn ? 'bg-brand-light-green/10 text-brand-light-green border border-brand-light-green/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className={`px-6 py-4.5 text-right whitespace-nowrap font-mono font-bold text-sm ${
                        isIn ? 'text-brand-light-green' : 'text-rose-400'
                      }`}>
                        {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenDetail(tx)}
                          className="p-1.5 bg-stone-300 hover:bg-stone-400 text-sky-400 rounded-lg transition-all"
                          title="Lihat Hubungan Data"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Relational Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Rincian Relasi Transaksi">
        {selectedTx && (
          <div className="space-y-6 text-sm text-stone-700">
            {/* General details */}
            <div className="grid grid-cols-2 gap-4 bg-stone-100/60 p-4 rounded-xl border border-stone-300/60">
              <div>
                <span className="text-[10px] font-bold text-stone-500 uppercase block">ID Transaksi</span>
                <span className="font-mono text-xs text-stone-600 select-all">{selectedTx.id}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Modul Pengirim</span>
                <span className="text-xs text-sky-400 font-bold uppercase tracking-wider">{selectedTx.source_module || 'MANUAL'}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-stone-300/40">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Kategori Ledger</span>
                <span className="text-stone-900 font-bold">{CATEGORY_LABELS[selectedTx.category] || selectedTx.category}</span>
              </div>
            </div>

            {/* Related Operational Data (Relation display) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-light-green" /> Relasi Operasional Terkait
              </h3>
              
              {detailLoading ? (
                <div className="py-8 flex justify-center items-center gap-2 text-stone-500 text-xs">
                  <div className="spinner !w-4 !h-4"></div> Memuat relasi data...
                </div>
              ) : txDetail && txDetail.relatedData ? (
                <div className="bg-stone-100 border border-stone-300 rounded-xl p-4 space-y-4">
                  {/* Category-specific relationship metadata templates */}
                  {selectedTx.source_module === 'SALES' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Nomor Nota Penjualan:</span>
                        <span className="text-stone-900 font-bold">{txDetail.relatedData.sale_no}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Nama Pelanggan:</span>
                        <span className="text-brand-light-green font-bold">{txDetail.relatedData.customer_name || 'Umum'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Jumlah Bayar:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Metode Pembayaran:</span>
                        <span className="text-stone-900 font-medium uppercase">{txDetail.relatedData.method}</span>
                      </div>
                      {txDetail.relatedData.notes && (
                        <div className="pt-2 border-t border-stone-200 text-xs text-stone-600 italic">
                          Catatan: "{txDetail.relatedData.notes}"
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTx.source_module === 'PURCHASE' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Nama Supplier / Calo:</span>
                        <span className="text-amber-400 font-bold">{txDetail.relatedData.calo_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Tanggal Pembelian:</span>
                        <span className="text-stone-900 font-medium">
                          {format(new Date(txDetail.relatedData.tanggal_belanja), 'dd MMM yyyy', { locale: id })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Total Harga Belanja:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.total_harga)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Jumlah Dibayar:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.amount)}</span>
                      </div>
                      {txDetail.relatedData.notes && (
                        <div className="pt-2 border-t border-stone-200 text-xs text-stone-600 italic">
                          Catatan: "{txDetail.relatedData.notes}"
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTx.source_module === 'PROCESS' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Nomor Proses Giling:</span>
                        <span className="text-orange-400 font-bold">{txDetail.relatedData.process_no}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Tipe Biaya Giling:</span>
                        <span className="text-stone-900 font-bold capitalize">{txDetail.relatedData.cost_type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Jumlah Biaya:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Status Proses:</span>
                        <span className="px-2 py-0.5 bg-stone-200 rounded text-xs text-stone-700 font-medium capitalize">
                          {txDetail.relatedData.process_status}
                        </span>
                      </div>
                      {txDetail.relatedData.description && (
                        <div className="pt-2 border-t border-stone-200 text-xs text-stone-600 italic">
                          Keterangan: "{txDetail.relatedData.description}"
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTx.source_module === 'DRYING' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Sesi Pengeringan:</span>
                        <span className="text-sky-400 font-bold">{txDetail.relatedData.drying_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Tipe Biaya Jemur:</span>
                        <span className="text-stone-900 font-bold capitalize">{txDetail.relatedData.cost_type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Jumlah Biaya:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Status Jemur:</span>
                        <span className="px-2 py-0.5 bg-stone-200 rounded text-xs text-stone-700 font-medium capitalize">
                          {txDetail.relatedData.drying_status}
                        </span>
                      </div>
                      {txDetail.relatedData.description && (
                        <div className="pt-2 border-t border-stone-200 text-xs text-stone-600 italic">
                          Keterangan: "{txDetail.relatedData.description}"
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTx.source_module === 'LOGISTICS' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Nama Sopir:</span>
                        <span className="text-stone-900 font-bold">{txDetail.relatedData.driver_name || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Tipe Referensi:</span>
                        <span className="text-stone-900 font-bold uppercase">{txDetail.relatedData.reference_type || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Biaya Operasional Kuli:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.operational_cost)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Status Tugas:</span>
                        <span className="text-brand-light-green font-bold uppercase text-xs">{txDetail.relatedData.status}</span>
                      </div>
                    </div>
                  )}

                  {selectedTx.source_module === 'OVERHEAD' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Kategori Biaya:</span>
                        <span className="text-stone-900 font-bold">{txDetail.relatedData.category}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Frekuensi Biaya:</span>
                        <span className="text-stone-900 font-medium uppercase text-xs">{txDetail.relatedData.frequency}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Jumlah Biaya:</span>
                        <span className="text-stone-900 font-bold">{formatCurrency(txDetail.relatedData.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500 text-xs">Metode Pembayaran:</span>
                        <span className="text-stone-900 font-medium uppercase text-xs">{txDetail.relatedData.payment_method}</span>
                      </div>
                      {txDetail.relatedData.description && (
                        <div className="pt-2 border-t border-stone-200 text-xs text-stone-600 italic">
                          Keterangan: "{txDetail.relatedData.description}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-stone-100 border border-stone-300/60 rounded-xl p-4 text-center text-xs text-stone-500">
                  <HelpCircle className="w-5 h-5 text-stone-400 mx-auto mb-1" />
                  Jurnal transaksi ini dibuat secara manual dari modul keuangan. Tidak ada data operasional eksternal.
                </div>
              )}
            </div>

            {/* Approval audit details */}
            <div className="space-y-3 pt-3 border-t border-stone-300/40">
              <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4 text-sky-400" /> Riwayat Pencatatan & Otorisasi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-stone-100/40 p-3 rounded-xl border border-stone-300/40">
                <div className="space-y-1">
                  <span className="text-stone-500 font-bold uppercase block text-[9px]">Dibuat Oleh</span>
                  <span className="text-stone-900">{selectedTx.created_by_name || 'Sistem'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-stone-500 font-bold uppercase block text-[9px]">Disetujui Oleh</span>
                  <span className="text-brand-light-green font-medium">{(txDetail?.transaction?.approved_by_name) || 'Sistem'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-stone-200 text-[10px] text-stone-500">
                  Disetujui pada: {txDetail?.transaction?.approved_at ? format(new Date(txDetail.transaction.approved_at), 'd MMMM yyyy, HH:mm', { locale: id }) : '—'}
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-stone-300 hover:bg-stone-400 text-stone-900 text-xs font-bold rounded-xl transition-all"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
