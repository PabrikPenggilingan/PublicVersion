import { useState, useEffect, useCallback } from 'react'
import { financeAPI, type CashVoucher } from '../api/client'
import Modal from '@/components/ui/Modal'
import { getCleanErrorMessage } from '@/errors'
import { ArrowUpRight, ArrowDownRight, Check, X, ChevronLeft, AlertCircle, CheckCircle2, Wallet, Receipt, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { confirmDialog } from '@/utils/confirmDialog'

// ── Types ────────────────────────────────────────────────────────────
interface PendingTransaction {
  id: string
  transaction_date: string
  description: string
  transaction_type: 'IN' | 'OUT'
  amount: number
  category: string
  source_module: string
  created_by_name: string
  pending_account_id?: string
  /** Cash that actually moves; 0 for non-cash entries (e.g. potongan customer) */
  cash_amount?: number | string
}

interface FinanceAccount {
  id: string
  name: string
  balance: number
}

const CATEGORY_LABELS: Record<string, { label: string; textClass: string; bgClass: string; borderClass: string }> = {
  SALES:            { label: 'Penjualan Beras', textClass: 'text-brand-light-green', bgClass: 'bg-brand-light-green/10', borderClass: 'border-brand-light-green/20' },
  SALE_PAYMENT:     { label: 'Penerimaan Bayar Beras (Kas Masuk)', textClass: 'text-brand-light-green', bgClass: 'bg-brand-light-green/10', borderClass: 'border-brand-light-green/20' },
  TITIPAN_FEE:      { label: 'Jasa Titipan/Giling (Kas Masuk)', textClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/20' },
  PURCHASE_PAYMENT: { label: 'Bayar Hutang Petani (Kas Keluar)', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' },
  BATCH_PAYMENT:    { label: 'Bayar Hutang Batch (Kas Keluar)', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' },
  PURCHASE:         { label: 'Pembelian Gabah', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' },
  LOGISTICS:        { label: 'Kuli Logistik (Kas Keluar)', textClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/20' },
  SALE_DEDUCTION:   { label: 'Potongan Customer / Kuli Bongkar (Kurangi Piutang)', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/20' },
  CALO_PAYOUT:      { label: 'Komisi Calo Penjualan (Kas Keluar)', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/20' },
  DRYING_COST:      { label: 'Biaya Jemur (Kas Keluar)', textClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/20' },
  PROCESS_COST:     { label: 'Biaya Giling (Kas Keluar)', textClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20' },
  MILLING:          { label: 'Biaya Giling (Kas Keluar)', textClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20' },
  OVERHEAD:         { label: 'Overhead / Operasional (Kas Keluar)', textClass: 'text-slate-400', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/20' },
  TRANSFER:         { label: 'Transfer Antar Rekening', textClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/20' },
  CAPITAL_OUT:      { label: 'Penarikan Modal / Prive (Kas Keluar)', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/20' },
  CAPITAL_IN:       { label: 'Setoran Modal (Kas Masuk)', textClass: 'text-brand-light-green', bgClass: 'bg-brand-light-green/10', borderClass: 'border-brand-light-green/20' },
}

export default function ApprovalManager() {
  const [pending, setPending] = useState<PendingTransaction[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('pendingApprovalAccounts')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return {}
      }
    }
    return {}
  })
  
  useEffect(() => {
    localStorage.setItem('pendingApprovalAccounts', JSON.stringify(selectedAccounts))
  }, [selectedAccounts])

  const [successCount, setSuccessCount] = useState(0)

  // Bukti kas: pilih beberapa transaksi lalu bayar/terima sekaligus (BKK/BKM)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payNotes, setPayNotes] = useState('')
  const [paying, setPaying] = useState(false)
  const [vouchers, setVouchers] = useState<CashVoucher[]>([])
  const [openVoucher, setOpenVoucher] = useState<string | null>(null)

  const filterLiquidAccounts = (rawList: any[]): FinanceAccount[] => {
    return rawList
      .filter((acc: any) => 
        ['CASH', 'BANK'].includes((acc.account_type || '').toUpperCase()) ||
        (acc.account_code && (acc.account_code.startsWith('1-1') || acc.account_code.startsWith('11')))
      )
      .filter((acc: any, idx: number, arr: any[]) =>
        idx === arr.findIndex((t: any) => t.account_code === acc.account_code)
      )
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, accountsRes] = await Promise.all([
        financeAPI.getApprovals(),
        financeAPI.getAccounts({ category: 'ASSET' }),
      ])
      const pendingTxs = (pendingRes.data as PendingTransaction[]) || []
      setPending(pendingTxs)
      setSelectedIds(prev => prev.filter(txId => pendingTxs.some(t => t.id === txId)))
      financeAPI.getVouchers().then(r => setVouchers(r.data || [])).catch(() => {})
      setAccounts(filterLiquidAccounts((accountsRes.data as any[]) || []))

      // Auto-select suggested account if available AND not already selected
      setSelectedAccounts(prev => {
        const updated = { ...prev }
        pendingTxs.forEach(tx => {
          if (tx.pending_account_id && !updated[tx.id]) {
            updated[tx.id] = tx.pending_account_id
          }
        })
        return updated
      })
    } catch (e: any) {
      toast.error(getCleanErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadAccounts = useCallback(async () => {
    try {
      const accountsRes = await financeAPI.getAccounts({ category: 'ASSET' })
      setAccounts(filterLiquidAccounts((accountsRes.data as any[]) || []))
    } catch (e) {
      console.error('Failed to reload accounts', e)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (tx: PendingTransaction) => {
    const accountId = selectedAccounts[tx.id]
    if (!accountId) {
      toast.error('Pilih rekening terlebih dahulu.')
      return
    }
    setApproving(tx.id)
    try {
      await financeAPI.approveTransaction(tx.id, accountId)
      toast.success(`Transaksi "${tx.description}" disetujui`)
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setSuccessCount(c => c + 1)
      reloadAccounts()
    } catch (e: any) {
      toast.error(`Gagal menyetujui: ${getCleanErrorMessage(e)}`)
    } finally {
      setApproving(null)
    }
  }

  const handleReject = async (tx: PendingTransaction) => {
    if (!await confirmDialog(`Yakin ingin menolak transaksi ini: "${tx.description}"?`)) return
    setApproving(tx.id)
    try {
      await financeAPI.rejectTransaction(tx.id)
      toast.success(`Transaksi "${tx.description}" ditolak`)
      setPending(prev => prev.filter(t => t.id !== tx.id))
    } catch (e: any) {
      toast.error(`Gagal menolak: ${getCleanErrorMessage(e)}`)
    } finally {
      setApproving(null)
    }
  }

  const handleApproveAll = async () => {
    const unselected = pending.filter(tx => !selectedAccounts[tx.id])
    if (unselected.length > 0) {
      toast.error(`Ada ${unselected.length} transaksi yang belum dipilih rekeningnya.`)
      return
    }
    if (!await confirmDialog(`Setujui semua ${pending.length} transaksi tertunda?`)) return
    
    setLoading(true)
    let success = 0
    for (const tx of pending) {
      try {
        const accountId = selectedAccounts[tx.id]
        await financeAPI.approveTransaction(tx.id, accountId)
        success++
      } catch (e) {
        console.error(e)
      }
    }
    toast.success(`${success} transaksi berhasil disetujui.`)
    setSuccessCount(c => c + success)
    reloadAccounts()
    load()
  }

  const selectedTxs = pending.filter(t => selectedIds.includes(t.id))
  const selectedDirection = selectedTxs[0]?.transaction_type
  // Transfers move money between our own accounts, so they never join a bukti kas
  const isCash = (t: PendingTransaction) => t.category !== 'TRANSFER' && Number(t.cash_amount ?? t.amount) > 0
  const cashOf = (t: PendingTransaction) => Number(t.cash_amount ?? t.amount) || 0
  const selectedTotal = selectedTxs.reduce((sum, t) => sum + cashOf(t), 0)

  const toggleSelect = (tx: PendingTransaction) => {
    if (selectedIds.includes(tx.id)) {
      setSelectedIds(prev => prev.filter(txId => txId !== tx.id))
      return
    }
    if (!isCash(tx)) {
      toast.error('Transaksi ini tidak memindahkan uang kas, setujui terpisah')
      return
    }
    if (selectedDirection && selectedDirection !== tx.transaction_type) {
      toast.error('Kas masuk dan kas keluar dibuat di bukti kas terpisah')
      return
    }
    setSelectedIds(prev => [...prev, tx.id])
  }

  const selectAllOf = (direction: 'IN' | 'OUT') => {
    setSelectedIds(pending.filter(t => t.transaction_type === direction && isCash(t)).map(t => t.id))
  }

  const setAccountForSelected = (accountId: string) => {
    if (!accountId) return
    setSelectedAccounts(prev => {
      const next = { ...prev }
      selectedIds.forEach(txId => { next[txId] = accountId })
      return next
    })
  }

  const handlePayBatch = async () => {
    const missing = selectedTxs.filter(t => !selectedAccounts[t.id])
    if (missing.length) {
      toast.error(`${missing.length} transaksi belum dipilih rekeningnya`)
      return
    }
    setPaying(true)
    try {
      const res = await financeAPI.payBatch({
        items: selectedTxs.map(t => ({ journalId: t.id, accountId: selectedAccounts[t.id] })),
        voucherDate: payDate,
        notes: payNotes.trim() || undefined,
      })
      toast.success(`${res.data.voucher_no} tersimpan: ${selectedTxs.length} transaksi disetujui`)
      setSuccessCount(c => c + selectedTxs.length)
      setSelectedIds([])
      setPayOpen(false)
      setPayNotes('')
      load()
    } catch (e: any) {
      toast.error(`Gagal: ${getCleanErrorMessage(e)}`)
    } finally {
      setPaying(false)
    }
  }

  // Subtotal per rekening for the selection (usually just one)
  const selectedByAccount = selectedTxs.reduce<Record<string, number>>((acc, t) => {
    const key = selectedAccounts[t.id] || ''
    acc[key] = (acc[key] || 0) + cashOf(t)
    return acc
  }, {})

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(amount)
  }

  const totalIn = pending.filter(t => t.transaction_type === 'IN').reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = pending.filter(t => t.transaction_type === 'OUT').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/finance" className="p-2 bg-stone-200 hover:bg-stone-300 text-stone-900 rounded-xl transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Approval Center</h1>
            <p className="text-stone-600 text-sm">Konfirmasi mutasi kas dari operasional harian pabrik.</p>
          </div>
        </div>
        {pending.length > 0 && (
          <button
            onClick={handleApproveAll}
            className="bg-brand-light-green hover:bg-brand-light-green text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-light-green/20 transition-all active:scale-95 text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Setujui Semua ({pending.length})
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-stone-200/50 border border-stone-300 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-light-green/10 text-brand-light-green rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-600 uppercase tracking-widest font-black">Total Kas Masuk (Pending)</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{formatCurrency(totalIn)}</h3>
          </div>
        </div>
        <div className="bg-stone-200/50 border border-stone-300 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <ArrowDownRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-600 uppercase tracking-widest font-black">Total Kas Keluar (Pending)</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{formatCurrency(totalOut)}</h3>
          </div>
        </div>
        <div className="bg-stone-200/50 border border-stone-300 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-600 uppercase tracking-widest font-black">Berhasil Disetujui (Sesi Ini)</span>
            <h3 className="text-xl font-bold text-stone-900 mt-1">{successCount} Transaksi</h3>
          </div>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-sky-100 border border-sky-300 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-sky-800 leading-relaxed">
          <strong>Cara kerja:</strong> Semua transaksi di bawah ini dicatat oleh operator lapangan namun <strong>belum memotong atau menambah saldo rekening</strong> Anda. Pilih rekening yang tepat untuk setiap transaksi lalu klik <strong>Approve</strong> untuk menjadikannya jurnal yang sah di buku besar.
        </p>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="spinner"></div>
        </div>
      ) : pending.length === 0 ? (
        /* Empty state */
        <div className="bg-stone-200 border border-stone-300/60 p-12 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-brand-light-green/10 text-brand-light-green rounded-full flex items-center justify-center mx-auto text-2xl">
            🎉
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-stone-900 font-bold text-lg">Semua Bersih!</h3>
            <p className="text-stone-600 text-sm">
              Tidak ada transaksi kas yang menunggu persetujuan saat ini. Seluruh pengeluaran dan pemasukan operasional sudah diakui.
            </p>
          </div>
        </div>
      ) : (
        /* Transactions List */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-stone-700">Daftar Transaksi Tertunda ({pending.length})</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500">Centang untuk bayar sekaligus:</span>
              {pending.some(t => t.transaction_type === 'OUT') && (
                <button onClick={() => selectAllOf('OUT')} className="px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700">Semua kas keluar</button>
              )}
              {pending.some(t => t.transaction_type === 'IN') && (
                <button onClick={() => selectAllOf('IN')} className="px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700">Semua kas masuk</button>
              )}
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} className="px-2.5 py-1 rounded-lg text-stone-500 hover:text-stone-800">Batal pilih</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {pending.map(tx => {
              const cat = CATEGORY_LABELS[tx.category] || { label: tx.category, textClass: 'text-stone-600', bgClass: 'bg-stone-300/50', borderClass: 'border-stone-300' }
              const isIn = tx.transaction_type === 'IN'

              return (
                <div key={tx.id} className={`bg-stone-200 border rounded-2xl p-5 hover:border-stone-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden group ${selectedIds.includes(tx.id) ? 'border-brand-light-green ring-1 ring-brand-light-green/40' : 'border-stone-300'}`}>
                  <div className="flex gap-4 items-start">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(tx.id)}
                      onChange={() => toggleSelect(tx)}
                      disabled={!isCash(tx)}
                      className="mt-3 w-4 h-4 accent-brand-light-green shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isCash(tx) ? 'Pilih untuk bayar sekaligus' : 'Bukan transaksi kas, setujui terpisah'}
                    />
                    {/* Indicator Icon */}
                    <div className={`p-3 rounded-xl shrink-0 ${isIn ? 'bg-brand-light-green/10 text-brand-light-green' : 'bg-rose-500/10 text-rose-400'}`}>
                      {isIn ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-stone-900 font-bold text-sm md:text-base leading-snug">{tx.description}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cat.bgClass} ${cat.textClass} ${cat.borderClass}`}>
                          {cat.label}
                        </span>
                      </div>
                      <div className="text-stone-600 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>🕐 {format(new Date(tx.transaction_date), 'd MMM yyyy, HH:mm', { locale: id })}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                        <span>Oleh: <strong className="text-stone-700 font-medium">{tx.created_by_name || '-'}</strong></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                        <span>Modul: <strong className="text-stone-700 font-medium uppercase">{tx.source_module || '-'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 shrink-0">
                    {/* Amount */}
                    <div className={`text-lg font-black tracking-tight ${isIn ? 'text-brand-light-green' : 'text-rose-400'}`}>
                      {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={selectedAccounts[tx.id] || ''}
                        onChange={e => setSelectedAccounts(prev => ({ ...prev, [tx.id]: e.target.value }))}
                        className={`bg-stone-100 text-stone-900 text-xs rounded-xl px-3 py-2 border transition-all focus:ring-brand-light-green w-full md:w-48 ${
                          selectedAccounts[tx.id] ? 'border-brand-light-green/50' : 'border-stone-300'
                        }`}
                      >
                        <option value="">— Pilih Rekening —</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({formatCurrency(acc.balance)})
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={approving === tx.id}
                        onClick={() => handleReject(tx)}
                        className="bg-red-500 hover:bg-red-600 border border-red-800 text-red-900 p-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0"
                        title="Tolak Transaksi"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <button
                        disabled={!selectedAccounts[tx.id] || approving === tx.id}
                        onClick={() => handleApprove(tx)}
                        className={`p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 disabled:opacity-50 disabled:scale-100 shrink-0 ${
                          selectedAccounts[tx.id]
                            ? 'bg-brand-light-green hover:bg-brand-light-green text-white shadow-lg shadow-brand-light-green/20'
                            : 'bg-stone-300 text-stone-500 cursor-not-allowed border border-stone-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>{approving === tx.id ? 'Memproses...' : 'Approve'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bar bayar sekaligus */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-4 z-20 bg-stone-900 text-white rounded-2xl px-5 py-3 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-bold">{selectedIds.length} transaksi dipilih</span>
            <span className="text-stone-300"> · {selectedDirection === 'IN' ? 'Kas masuk' : 'Kas keluar'} </span>
            <span className="font-mono font-bold">{formatCurrency(selectedTotal)}</span>
          </div>
          <button
            onClick={() => setPayOpen(true)}
            className="bg-brand-light-green hover:bg-brand-light-green/90 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {selectedDirection === 'IN' ? 'Terima Sekaligus' : 'Bayar Sekaligus'}
          </button>
        </div>
      )}

      <Modal
        isOpen={payOpen}
        onClose={() => { if (!paying) setPayOpen(false) }}
        title={selectedDirection === 'IN' ? 'Terima Sekaligus (Bukti Kas Masuk)' : 'Bayar Sekaligus (Bukti Kas Keluar)'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setPayOpen(false)} disabled={paying} className="px-4 py-2 text-sm rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800">Batal</button>
            <button
              onClick={handlePayBatch}
              disabled={paying || selectedTxs.length === 0}
              className="px-4 py-2 text-sm rounded-xl bg-brand-light-green hover:bg-brand-light-green/90 text-white font-bold disabled:opacity-50"
            >
              {paying ? 'Memproses…' : `Setujui ${selectedTxs.length} transaksi · ${formatCurrency(selectedTotal)}`}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Tanggal bukti kas</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Pakai satu rekening untuk semua</label>
              <select
                value=""
                onChange={e => setAccountForSelected(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">— Pilih untuk mengisi semua —</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Catatan (opsional)</label>
            <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Misal: Pembayaran truk 15 Nov" className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-sm" />
          </div>

          <div className="border border-stone-300 rounded-xl divide-y divide-stone-300 overflow-hidden">
            {selectedTxs.map(tx => (
              <div key={tx.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-stone-50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{tx.description}</div>
                  <div className="text-[11px] text-stone-500">{CATEGORY_LABELS[tx.category]?.label || tx.category}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedAccounts[tx.id] || ''}
                    onChange={e => setSelectedAccounts(prev => ({ ...prev, [tx.id]: e.target.value }))}
                    className={`bg-stone-100 text-xs rounded-lg px-2 py-1.5 border w-40 ${selectedAccounts[tx.id] ? 'border-brand-light-green/50' : 'border-red-300'}`}
                  >
                    <option value="">— Rekening —</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                  <span className="font-mono text-sm font-semibold w-32 text-right">{formatCurrency(cashOf(tx))}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-stone-100 rounded-xl p-3 space-y-1 text-sm">
            {Object.entries(selectedByAccount).map(([accId, amt]) => (
              <div key={accId || 'none'} className="flex justify-between">
                <span className={accId ? 'text-stone-600' : 'text-red-500'}>{accId ? `Dari ${accounts.find(a => a.id === accId)?.name || 'rekening'}` : 'Belum pilih rekening'}</span>
                <span className="font-mono">{formatCurrency(amt)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-stone-300 pt-1">
              <span>Total {selectedDirection === 'IN' ? 'diterima' : 'dibayar'}</span>
              <span className="font-mono">{formatCurrency(selectedTotal)}</span>
            </div>
          </div>
          <p className="text-[11px] text-stone-500">
            Semua transaksi disetujui dalam satu bukti kas. Pencatatan tetap per jenis biaya (transport, komisi, dll), jadi laporan tidak tercampur.
          </p>
        </div>
      </Modal>

      {/* Riwayat bukti kas */}
      {vouchers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-700 flex items-center gap-2"><Receipt className="w-4 h-4" /> Bukti Kas Terakhir</h3>
          <div className="bg-stone-200 border border-stone-300 rounded-2xl divide-y divide-stone-300 overflow-hidden">
            {vouchers.map(v => {
              const isOpen = openVoucher === v.id
              const isIn = v.voucher_type === 'IN'
              return (
                <div key={v.id}>
                  <button onClick={() => setOpenVoucher(isOpen ? null : v.id)} className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-stone-300/40 text-left">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-stone-900">{v.voucher_no}</div>
                      <div className="text-[11px] text-stone-500 truncate">
                        {format(new Date(v.voucher_date), 'd MMM yyyy', { locale: id })} · {v.items.length} transaksi{v.notes ? ` · ${v.notes}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono font-bold text-sm ${isIn ? 'text-brand-light-green' : 'text-rose-500'}`}>{isIn ? '+' : '-'}{formatCurrency(Number(v.total_amount))}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-1">
                      {v.items.map(it => (
                        <div key={it.journal_id} className="flex justify-between gap-3 text-xs bg-stone-100 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-stone-800 truncate">{it.description}</div>
                            <div className="text-stone-500">{CATEGORY_LABELS[it.category]?.label || it.category} · {it.account_name || '-'}{it.status !== 'APPROVED' ? ` · ${it.status}` : ''}</div>
                          </div>
                          <span className="font-mono shrink-0">{formatCurrency(Number(it.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
