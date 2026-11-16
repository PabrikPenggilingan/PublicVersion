import { useState, useEffect } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { financeAPI } from '@/api/client'
import { getCleanErrorMessage } from '@/errors'
import { Landmark, ArrowRightLeft, Plus, History, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface FinanceAccount {
  id: string
  name: string
  account_type?: string
  account_code?: string | null
  balance: number
  is_active: boolean
  updated_at: string
}

export default function FinanceAccounts() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isManualTxOpen, setIsManualTxOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Account Logs state
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Form states
  const [transferData, setTransferData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: ''
  })

  const [manualTxData, setManualTxData] = useState({
    accountId: '',
    transactionType: 'IN' as 'IN' | 'OUT',
    amount: '',
    category: 'CAPITAL_IN',
    description: ''
  })

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountLogs()
    } else {
      setLedgerTxs([])
    }
  }, [selectedAccountId])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await financeAPI.getAccounts()
      const liquid = ((res.data || []) as FinanceAccount[]).filter(acc =>
        ['CASH', 'BANK'].includes((acc.account_type || '').toUpperCase()) ||
        (acc.account_code || '').startsWith('1-1')
      )
      setAccounts(liquid)
      if (liquid.length > 0) {
        // Set defaults
        setTransferData(prev => ({
          ...prev,
          fromAccountId: prev.fromAccountId || liquid[0].id,
          toAccountId: prev.toAccountId || liquid[1]?.id || ''
        }))
        setManualTxData(prev => ({
          ...prev,
          accountId: prev.accountId || liquid[0].id
        }))
      }
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const loadAccountLogs = async () => {
    try {
      setLedgerLoading(true)
      // Load ledger for past 30 days
      const end = format(new Date(), 'yyyy-MM-dd')
      const start = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const res = await financeAPI.getReport(start, end)
      const logs = (res.data.ledger || []).filter((tx: any) => tx.account_id === selectedAccountId)
      setLedgerTxs(logs)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (transferData.fromAccountId === transferData.toAccountId) {
      toast.error('Rekening asal dan tujuan tidak boleh sama')
      return
    }
    try {
      setSubmitting(true)
      await financeAPI.transferFunds({
        ...transferData,
        amount: parseFloat(transferData.amount)
      })
      toast.success('Transfer dana berhasil dicatat')
      setIsTransferOpen(false)
      setTransferData(prev => ({ ...prev, amount: '', description: '' }))
      loadAccounts()
      if (selectedAccountId) loadAccountLogs()
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualTx = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await financeAPI.recordManualTransaction({
        ...manualTxData,
        amount: parseFloat(manualTxData.amount)
      })
      toast.success('Transaksi manual berhasil dicatat')
      setIsManualTxOpen(false)
      setManualTxData(prev => ({ ...prev, amount: '', description: '' }))
      loadAccounts()
      if (selectedAccountId) loadAccountLogs()
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
  }

  // Gradients for account card visuals
  const gradients = [
    'from-brand-light-green/20 to-sky-600/20 border-brand-light-green/30 hover:border-brand-light-green/60 shadow-[0_0_30px_-10px] shadow-brand-light-green/30',
    'from-indigo-500/20 to-purple-600/20 border-indigo-500/30 hover:border-indigo-500/60 shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)]',
    'from-amber-500/20 to-orange-600/20 border-amber-500/30 hover:border-amber-500/60 shadow-[0_0_30px_-10px_rgba(245,158,11,0.3)]',
    'from-rose-500/20 to-pink-600/20 border-rose-500/30 hover:border-rose-500/60 shadow-[0_0_30px_-10px_rgba(244,63,94,0.3)]'
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Manajemen Rekening & Transfer</h1>
          <p className="text-stone-600 text-sm">Kelola pemindahan dana antar kas dan pencatatan modal manual.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTransferOpen(true)}
            className="bg-stone-200 hover:bg-stone-300 text-stone-900 border border-stone-300 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-stone-50"
          >
            <ArrowRightLeft className="w-4 h-4 text-sky-400" />
            Transfer Dana
          </button>
          
          <button
            onClick={() => setIsManualTxOpen(true)}
            className="bg-brand-light-green hover:bg-brand-light-green text-stone-900 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-brand-light-green/20"
          >
            <Plus className="w-4 h-4" />
            Jurnal Manual
          </button>
        </div>
      </div>

      {/* Accounts List (Grid of visual cards) */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc, index) => {
            const cardStyle = gradients[index % gradients.length]
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`bg-gradient-to-br p-6 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between h-48 relative overflow-hidden group ${cardStyle} ${
                  selectedAccountId === acc.id ? 'ring-2 ring-brand-light-green scale-102 border-brand-light-green/60' : ''
                }`}
              >
                {/* Visual glow chip */}
                <div className="absolute top-4 right-4 w-12 h-8 bg-white/5 border border-white/10 rounded-lg backdrop-blur flex items-center justify-center font-bold text-[9px] text-stone-900/40 tracking-wider">
                  KAS
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-stone-700">
                    <Landmark className="w-5 h-5 text-brand-light-green group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm tracking-tight text-stone-900">{acc.name}</span>
                  </div>
                  <span className="text-[10px] text-stone-500 block uppercase tracking-widest font-black">Saldo Rekening</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-stone-900 tracking-tighter">
                    {formatCurrency(acc.balance)}
                  </h3>
                  <span className="text-[9px] text-stone-500 block">
                    Diperbarui: {acc.updated_at ? format(new Date(acc.updated_at), 'd MMM yyyy, HH:mm', { locale: id }) : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Account specific transaction history */}
      {selectedAccountId && (
        <div className="bg-stone-200 border border-stone-300/60 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-stone-300/60 pb-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-stone-900 font-bold text-sm">
                  Buku Pembantu: {accounts.find(a => a.id === selectedAccountId)?.name}
                </h3>
                <p className="text-xs text-stone-600">Histori mutasi kas 30 hari terakhir untuk rekening ini.</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedAccountId('')}
              className="text-xs text-stone-600 hover:text-stone-900 transition-colors"
            >
              Tutup Histori
            </button>
          </div>

          {ledgerLoading ? (
            <div className="py-12 flex justify-center">
              <div className="spinner !w-6 !h-6"></div>
            </div>
          ) : ledgerTxs.length === 0 ? (
            <p className="text-xs text-stone-600 text-center py-6">Tidak ada mutasi terdeteksi untuk rekening ini.</p>
          ) : (
            <div className="space-y-3">
              {ledgerTxs.map((tx) => {
                const isIn = tx.transaction_type === 'IN'
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-stone-100/60 border border-stone-200 rounded-xl hover:border-stone-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isIn ? 'bg-brand-light-green/10 text-brand-light-green' : 'bg-rose-500/10 text-rose-400'}`}>
                        {isIn ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900">{tx.description}</p>
                        <span className="text-[10px] text-stone-500">
                          {format(new Date(tx.transaction_date), 'd MMM yyyy, HH:mm', { locale: id })}
                        </span>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-xs ${isIn ? 'text-brand-light-green' : 'text-rose-400'}`}>
                      {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Transfer Dana Modal */}
      <Modal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} title="Transfer Dana Antar Rekening">
        <form onSubmit={handleTransfer} className="space-y-5 text-sm text-stone-700">
          <div className="grid grid-cols-2 gap-4">
            {/* From Account */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Rekening Asal</label>
              <select
                value={transferData.fromAccountId}
                onChange={e => setTransferData({ ...transferData, fromAccountId: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:ring-brand-light-green focus:border-brand-light-green"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            {/* To Account */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Rekening Tujuan</label>
              <select
                value={transferData.toAccountId}
                onChange={e => setTransferData({ ...transferData, toAccountId: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:ring-brand-light-green focus:border-brand-light-green"
                required
              >
                <option value="">— Pilih Tujuan —</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Jumlah Transfer (IDR)</label>
            <NumberInput ui

              placeholder="Masukkan nominal..."
              value={transferData.amount}
              onChange={e => setTransferData({ ...transferData, amount: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Keterangan / Memo</label>
            <textarea
              placeholder="Catatan transfer dana..."
              value={transferData.description}
              onChange={e => setTransferData({ ...transferData, description: e.target.value })}
              className="w-full bg-stone-100 border-stone-300 text-stone-900 text-xs rounded-xl p-3 h-20 focus:ring-brand-light-green focus:border-brand-light-green"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsTransferOpen(false)}
              className="px-5 py-2 bg-stone-300 hover:bg-stone-400 text-stone-900 text-xs font-bold rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-light-green hover:bg-brand-light-green text-stone-900 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Kirim Dana'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Jurnal Manual / Adjustment Modal */}
      <Modal isOpen={isManualTxOpen} onClose={() => setIsManualTxOpen(false)} title="Catat Jurnal Kas Manual">
        <form onSubmit={handleManualTx} className="space-y-5 text-sm text-stone-700">
          <div className="grid grid-cols-2 gap-4">
            {/* Account */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Rekening Tujuan</label>
              <select
                value={manualTxData.accountId}
                onChange={e => setManualTxData({ ...manualTxData, accountId: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:ring-brand-light-green focus:border-brand-light-green"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Tipe Jurnal</label>
              <select
                value={manualTxData.transactionType}
                onChange={e => {
                  const transactionType = e.target.value as 'IN' | 'OUT'
                  setManualTxData({ ...manualTxData, transactionType, category: transactionType === 'IN' ? 'CAPITAL_IN' : 'OVERHEAD' })
                }}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:ring-brand-light-green focus:border-brand-light-green"
                required
              >
                <option value="IN">Kas Masuk (IN)</option>
                <option value="OUT">Kas Keluar (OUT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Kategori Jurnal</label>
              <select
                value={manualTxData.category}
                onChange={e => setManualTxData({ ...manualTxData, category: e.target.value })}
                className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-xl px-3 py-2.5 text-xs focus:ring-brand-light-green focus:border-brand-light-green"
                required
              >
                {manualTxData.transactionType === 'IN' ? (
                  <option value="CAPITAL_IN">Setoran Modal Pemilik</option>
                ) : (
                  <>
                    <option value="OVERHEAD">Biaya Operasional (masuk Overhead)</option>
                    <option value="CAPITAL_OUT">Penarikan Modal / Prive</option>
                  </>
                )}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Nominal Saldo (IDR)</label>
              <NumberInput ui

                placeholder="Masukkan nominal..."
                value={manualTxData.amount}
                onChange={e => setManualTxData({ ...manualTxData, amount: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 font-bold uppercase tracking-wider">Keterangan Jurnal</label>
            <textarea
              placeholder="Deskripsi penyesuaian atau pencatatan kas harian..."
              value={manualTxData.description}
              onChange={e => setManualTxData({ ...manualTxData, description: e.target.value })}
              className="w-full bg-stone-100 border-stone-300 text-stone-900 text-xs rounded-xl p-3 h-20 focus:ring-brand-light-green focus:border-brand-light-green"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsManualTxOpen(false)}
              className="px-5 py-2 bg-stone-300 hover:bg-stone-400 text-stone-900 text-xs font-bold rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-light-green hover:bg-brand-light-green text-stone-900 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Catat Transaksi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
