import { useState, useEffect } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import ModalPortal from '@/components/ui/ModalPortal'
import PaymentBadge from '@/components/payments/PaymentBadge'
import AddPaymentModal from '@/components/payments/AddPaymentModal'
import { getCleanErrorMessage } from '@/errors'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
    ArrowLeft, ShoppingCart, Package, CreditCard,
    RotateCcw, Trash2, Plus, CheckCircle2, XCircle,
    Calendar, User as UserIcon, AlertTriangle,
    Printer, FileText, Search, Filter, Truck
} from 'lucide-react'
import { salesV2API, inventoryAPI, customersAPI, priceListAPI, filesAPI } from '@/api/client'
import { SaleV2, SaleItem, SalePayment, SaleReturn, Customer, CustomerTier } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { confirmDialog } from '@/utils/confirmDialog'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/utils/helpers'
import { generateSalesReceiptPDF } from '@/utils/pdfGenerator'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { compressImage } from '@/utils/imageCompression'
import SaleShipmentModal from '@/components/SaleShipmentModal'

type TabType = 'items' | 'payment' | 'returns' | 'transport'

export default function SalesDetail() {
    const { id: saleId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [sale, setSale] = useState<SaleV2 | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabType>('items')

    const [inventory, setInventory] = useState<any[]>([])

    // Pengiriman (1 mobil, bisa banyak nota) that carries this nota
    const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false)

    // Potongan customer: "Total Diterima" is editable (default = nota), the difference is the deduction
    const [deductionInput, setDeductionInput] = useState<string | null>(null) // null = saved value
    // Raw text of "Total Diterima" while the user types (may be empty); null = derived from the deduction
    const [receivedInput, setReceivedInput] = useState<string | null>(null)
    const [deductionNote, setDeductionNote] = useState('')
    const [savingDeduction, setSavingDeduction] = useState(false)

    // Modal states
    const [isItemModalOpen, setIsItemModalOpen] = useState(false)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false)
    const [isChangeCustomerModalOpen, setIsChangeCustomerModalOpen] = useState(false)
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)

    // Submitting states
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchSale()
        fetchAuxData()
    }, [saleId])

    const fetchSale = async () => {
        if (!saleId) return
        try {
            setLoading(true)
            const res = await salesV2API.getById(saleId)
            setSale(res.data)
            setDeductionInput(null)
            setReceivedInput(null)
            setDeductionNote(res.data.deduction_note || '')
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal memuat nota')
            navigate('/sales')
        } finally {
            setLoading(false)
        }
    }

    const fetchAuxData = async () => {
        try {
            const invRes = await inventoryAPI.getAvailable(2000)
            // Ensure gabah titipan can never enter SalesDetail
            const nonTitipanInventory = invRes.data.filter((item: any) => !item.is_titipan)
            setInventory(nonTitipanInventory)
        } catch (err) { }
    }

    // Share of the truck's costs carried by this nota, proportional to kg (for per-nota margin only)
    const shipment = sale?.shipment || null
    const shipmentKg = shipment ? parseFloat(String(shipment.total_kg)) || 0 : 0
    const thisSaleKg = shipment
        ? parseFloat(String(shipment.sales?.find(s => s.id === sale?.id)?.total_kg ?? 0)) || 0
        : 0
    const shipmentShare = shipment
        ? (shipmentKg > 0 ? thisSaleKg / shipmentKg : 1 / Math.max(1, shipment.sales?.length || 1))
        : 0
    const transportShare = shipment ? (parseFloat(String(shipment.operational_cost)) || 0) * shipmentShare : 0
    const commissionShare = shipment ? (parseFloat(String(shipment.commission_amount)) || 0) * shipmentShare : 0

    const nilaiNota = sale ? parseFloat(String(sale.total_amount)) || 0 : 0
    const savedDeduction = sale ? parseFloat(String(sale.customer_deduction ?? 0)) || 0 : 0
    const deductionValue = deductionInput !== null ? (parseFloat(deductionInput) || 0) : savedDeduction
    const totalDiterima = nilaiNota - deductionValue
    const canEditDeduction = !!sale && ['DRAFT', 'CONFIRMED'].includes(sale.status)
    const deductionDirty = deductionInput !== null && Math.abs(deductionValue - savedDeduction) >= 0.01
        || (sale ? (deductionNote || '') !== (sale.deduction_note || '') : false)

    const handleTotalDiterimaChange = (raw: string) => {
        setReceivedInput(raw)
        // Empty while retyping: keep the last potongan until a number is entered
        if (raw === '') return
        const received = parseFloat(raw) || 0
        setDeductionInput(String(Math.max(0, Math.round((nilaiNota - received) * 100) / 100)))
    }

    const handleSaveDeduction = async () => {
        if (!sale) return
        if (deductionValue < 0) { toast.error('Potongan tidak boleh negatif'); return }
        if (deductionValue > nilaiNota) { toast.error('Potongan tidak boleh melebihi nilai nota'); return }
        try {
            setSavingDeduction(true)
            await salesV2API.setDeduction(sale.id, {
                amount: deductionValue,
                note: deductionValue > 0 ? (deductionNote.trim() || 'Kuli bongkar') : '',
            })
            toast.success(sale.status === 'DRAFT'
                ? 'Potongan disimpan, dikirim ke Keuangan saat nota dikonfirmasi'
                : 'Potongan disimpan dan dikirim ke Keuangan')
            fetchSale()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menyimpan potongan')
        } finally {
            setSavingDeduction(false)
        }
    }

    const handleConfirm = async () => {
        if (!sale || sale.status !== 'DRAFT') return

        const fmt = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const shipmentNote = shipment
            ? 'Biaya transport & komisi calo sudah tercatat di Pengiriman.'
            : 'Biaya transport & komisi calo bisa dicatat lewat tab Transportasi → Pengiriman.'
        const deductionNoteText = savedDeduction > 0
            ? ` Potongan customer Rp ${fmt(savedDeduction)} (${sale.deduction_note || 'kuli bongkar'}) ikut dikirim sebagai beban.`
            : ''
        if (!await confirmDialog(`Konfirmasi nota ini? Pendapatan final Rp ${fmt(parseFloat(String(sale.total_amount)))} akan dikirim ke Keuangan untuk persetujuan.${deductionNoteText} ${shipmentNote} Retur tidak bisa diubah lagi setelah konfirmasi.`)) return

        try {
            setIsSubmitting(true)
            await salesV2API.confirm(sale.id)
            toast.success('Nota dikonfirmasi, pendapatan dikirim ke Keuangan')
            fetchSale()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal konfirmasi nota')
            fetchSale() // status may have changed elsewhere (e.g. voided in another tab)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteReturn = async (returnId: string) => {
        if (!sale) return
        if (!await confirmDialog('Apakah Anda yakin ingin menghapus retur ini? Stok dan saldo akan dikembalikan ke kondisi sebelumnya.')) return

        try {
            setIsSubmitting(true)
            await salesV2API.deleteReturn(sale.id, returnId)
            toast.success('Retur berhasil dihapus')
            fetchSale()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menghapus retur')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (loading || !sale) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="spinner" />
                <p className="text-stone-600 animate-pulse">Memuat detail nota...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate('/sales')}
                        className="p-2 bg-stone-200 border border-stone-300 text-stone-600 hover:text-stone-900 rounded-xl transition-all shrink-0 mt-1 md:mt-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <h1 className="text-xl font-bold text-stone-900">
                                {sale.sale_no || 'Draft Nota Penjualan'}
                            </h1>
                            <StatusBadge status={sale.status} />
                            <PaymentBadge status={sale.payment_status} />
                        </div>
                        <p className="text-xs text-stone-500 mt-1 flex flex-wrap items-center gap-2">
                            <Calendar size={12} className="shrink-0" />
                            <span>Dibuat oleh <span className="text-stone-700 font-medium">{sale.created_by_name}</span> pada {format(new Date(sale.created_at), 'dd MMMM yyyy HH:mm', { locale: id })}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 md:ml-auto w-full md:w-auto">
                    <Button
                        variant="outline"
                        className="border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-300 gap-2 h-10"
                        onClick={() => generateSalesReceiptPDF(sale)}
                    >
                        <Printer size={18} />
                        Cetak Nota
                    </Button>
                    {sale.status === 'DRAFT' && (
                        <Button
                            onClick={handleConfirm}
                            disabled={isSubmitting || !sale.items?.length}
                            className="bg-brand-light-green hover:bg-brand-light-green text-white gap-2 px-6 h-10 shadow-lg shadow-brand-light-green/20"
                        >
                            <CheckCircle2 size={18} />
                            Konfirmasi Nota
                        </Button>
                    )}
                    {['CONFIRMED', 'PARTIAL_DELIVERED'].includes(sale.status) && (
                        <Button
                            onClick={() => {
                                if (Math.max(0, parseFloat(sale.outstanding.toString())) > 0) {
                                    toast.error(`Tagihan belum lunas (Sisa: Rp ${Math.max(0, parseFloat(sale.outstanding.toString())).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Tidak dapat tutup penjualan.`)
                                    return
                                }
                                setIsCloseModalOpen(true)
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-6 h-10 shadow-lg shadow-indigo-900/20"
                        >
                            <CheckCircle2 size={18} />
                            Tutup Penjualan
                        </Button>
                    )}
                    {sale.status !== 'VOID' && (
                        <Button
                            onClick={() => setIsVoidModalOpen(true)}
                            variant="ghost"
                            className="text-red-400 hover:bg-red-500/10 h-10"
                        >
                            <Trash2 size={18} />
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Details & Tabs */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Customer Info Card */}
                    <div className="bg-stone-200 border border-stone-300 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <ShoppingCart size={48} className="text-stone-300/50 -mr-4 -mt-4 opacity-20" />
                        </div>
                        <div className="flex items-start justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-brand-light-green/10 text-brand-light-green rounded-2xl flex items-center justify-center border border-brand-light-green/20">
                                    <UserIcon size={28} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-stone-900">{sale.customer_name || 'Tanpa Pelanggan'}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-stone-300 text-brand-light-green text-[10px] font-black rounded border border-brand-light-green/20 tracking-widest uppercase">
                                            {sale.tier_name || 'Umum'}
                                        </span>
                                        <span className="text-stone-500 text-xs flex items-center gap-1">
                                            <Calendar size={12} />
                                            Tanggal Nota: {format(new Date(sale.sale_date), 'dd MMM yyyy', { locale: id })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {sale.status === 'DRAFT' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-brand-light-green text-xs"
                                    onClick={() => setIsChangeCustomerModalOpen(true)}
                                >
                                    Ubah
                                </Button>
                            )}
                        </div>

                        {sale.notes && (
                            <div className="mt-4 p-3 bg-stone-100/50 rounded-xl border border-stone-300/50 text-sm text-stone-600 italic">
                                "{sale.notes}"
                            </div>
                        )}
                    </div>

                    {/* Tabs Navigation */}
                    <div className="bg-stone-200 p-1.5 rounded-2xl border border-stone-300 flex gap-1 overflow-x-auto no-scrollbar">
                        <TabButton
                            active={activeTab === 'items'}
                            onClick={() => setActiveTab('items')}
                            icon={<Package size={18} />}
                            label="Item Produk"
                            count={sale.items?.length}
                        />

                        <TabButton
                            active={activeTab === 'payment'}
                            onClick={() => setActiveTab('payment')}
                            icon={<CreditCard size={18} />}
                            label="Pendapatan"
                            count={sale.payments?.length}
                        />
                        <TabButton
                            active={activeTab === 'transport'}
                            onClick={() => setActiveTab('transport')}
                            icon={<Truck size={18} />}
                            label="Transportasi"
                            count={sale.status !== 'DRAFT' ? 1 : 0}
                        />
                        <TabButton
                            active={activeTab === 'returns'}
                            onClick={() => setActiveTab('returns')}
                            icon={<RotateCcw size={18} />}
                            label="Retur / Adjustment"
                            count={sale.returns?.length}
                        />
                    </div>

                    {/* Tab Panels */}
                    <div className="lg:min-h-[400px]">
                        {activeTab === 'items' && (
                            <ItemsPanel
                                items={sale.items || []}
                                isDraft={sale.status === 'DRAFT'}
                                onAdd={() => setIsItemModalOpen(true)}
                                saleId={sale.id}
                                refresh={() => { fetchSale(); fetchAuxData(); }}
                            />
                        )}

                        {activeTab === 'payment' && (
                            <PaymentPanel
                                payments={sale.payments || []}
                                canAdd={sale.status !== 'VOID' && sale.status !== 'COMPLETED'}
                                onAdd={() => setIsPaymentModalOpen(true)}
                                refresh={fetchSale}
                            />
                        )}
                        {activeTab === 'payment' && (
                            <MoneyFlowCard
                                sale={sale}
                                transportShare={transportShare}
                                commissionShare={commissionShare}
                                sharePct={shipment ? shipmentShare * 100 : null}
                            />
                        )}
                        {activeTab === 'transport' && (
                            <div className="bg-stone-200 border border-stone-300 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="absolute top-0 right-0 p-4">
                                    <Truck size={48} className="text-brand-light-green/50 -mr-4 -mt-4 opacity-10" />
                                </div>
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <div>
                                        <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                                            <Truck className="text-brand-light-green" size={20} />
                                            Informasi Transportasi & Logistik
                                        </h2>
                                        <p className="text-sm text-stone-600">Biaya transport & komisi calo dicatat per mobil (bisa berisi beberapa nota).</p>
                                    </div>
                                </div>

                                {shipment ? (
                                    <div className="space-y-4 relative z-10">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            <div className="p-3 bg-stone-100 border border-stone-300 rounded-xl">
                                                <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Supir & Rute</div>
                                                <div className="font-semibold text-stone-900">{shipment.driver_name || '-'}</div>
                                                <div className="text-stone-600">{shipment.origin || '-'} → {shipment.destination || '-'}</div>
                                                {shipment.crew_names && <div className="text-xs text-stone-500 mt-1">Kru: {shipment.crew_names}</div>}
                                            </div>
                                            <div className="p-3 bg-stone-100 border border-stone-300 rounded-xl">
                                                <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Muatan Mobil</div>
                                                <div className="font-semibold text-stone-900">{shipmentKg.toLocaleString('id-ID')} kg</div>
                                                <div className="text-stone-600">Nota ini: {thisSaleKg.toLocaleString('id-ID')} kg ({(shipmentShare * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)</div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-stone-100 border border-stone-300 rounded-xl text-sm">
                                            <div className="text-xs text-stone-500 uppercase tracking-wider mb-2">Nota dalam mobil ini</div>
                                            <div className="flex flex-wrap gap-2">
                                                {(shipment.sales || []).map(n => (
                                                    n.id === sale.id
                                                        ? <span key={n.id} className="px-2.5 py-1 rounded-lg bg-brand-light-green/20 text-brand-light-green font-medium">{n.sale_no} (nota ini)</span>
                                                        : <Link key={n.id} to={`/sales/${n.id}`} className="px-2.5 py-1 rounded-lg bg-stone-200 border border-stone-300 text-blue-600 hover:underline">{n.sale_no} · {n.customer_name || 'Umum'}</Link>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto border border-stone-300 rounded-xl">
                                            <table className="w-full text-sm min-w-[420px]">
                                                <thead className="bg-stone-300/50 text-stone-600 text-xs">
                                                    <tr>
                                                        <th className="text-left px-3 py-2">Biaya (dibayar pabrik)</th>
                                                        <th className="text-right px-3 py-2">Total Mobil</th>
                                                        <th className="text-right px-3 py-2">Porsi Nota Ini</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-300/60">
                                                    <tr>
                                                        <td className="px-3 py-2">Transport</td>
                                                        <td className="px-3 py-2 text-right font-mono">Rp {Math.round(parseFloat(String(shipment.operational_cost)) || 0).toLocaleString('id-ID')}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-red-600">Rp {Math.round(transportShare).toLocaleString('id-ID')}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-3 py-2">
                                                            Komisi calo{shipment.commission_recipient ? ` (${shipment.commission_recipient})` : ''}
                                                            {parseFloat(String(shipment.commission_rate_per_kg)) > 0 && (
                                                                <div className="text-xs text-stone-500">Rp {parseFloat(String(shipment.commission_rate_per_kg)).toLocaleString('id-ID')}/kg</div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono">Rp {Math.round(parseFloat(String(shipment.commission_amount)) || 0).toLocaleString('id-ID')}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-red-600">Rp {Math.round(commissionShare).toLocaleString('id-ID')}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <Link
                                                to={`/logistics?tab=SALE&shipment=${shipment.id}`}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 border border-stone-300 hover:bg-stone-300 text-stone-800 text-sm font-medium rounded-lg transition-colors"
                                            >
                                                <Truck size={16} />
                                                Ubah Pengiriman
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 relative z-10">
                                        <Truck size={48} className="mx-auto text-stone-400 mb-4" />
                                        <h3 className="text-lg font-medium text-stone-900 mb-2">Belum masuk pengiriman</h3>
                                        <p className="text-stone-600 max-w-md mx-auto mb-5 text-sm">
                                            Catat 1 mobil beserta semua nota yang diangkut, biaya transport, dan komisi calo per kg.
                                            Customer tetap membayar nota penuh.
                                        </p>
                                        {sale.status !== 'VOID' && (
                                            <button
                                                onClick={() => setIsShipmentModalOpen(true)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-white text-sm font-medium rounded-lg transition-colors"
                                            >
                                                <Plus size={16} />
                                                Buat Pengiriman
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <SaleShipmentModal
                            isOpen={isShipmentModalOpen}
                            preselectSaleId={sale.id}
                            onClose={() => setIsShipmentModalOpen(false)}
                            onSaved={() => { setIsShipmentModalOpen(false); fetchSale() }}
                        />

                        {activeTab === 'returns' && (
                            <ReturnsPanel
                                returns={sale.returns || []}
                                canAdd={sale.status === 'DRAFT'}
                                onAdd={() => setIsReturnModalOpen(true)}
                                onDelete={handleDeleteReturn}
                                refresh={fetchSale}
                            />
                        )}
                    </div>
                </div>

                {/* Right Column: Financial Summary */}
                <div className="space-y-6">
                    <div className="bg-stone-200 border border-stone-300 rounded-2xl p-6 shadow-xl sticky top-24">
                        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <FileText size={16} className="text-brand-light-green" />
                            Ringkasan Pendapatan
                        </h2>

                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-600">Subtotal Produk</span>
                                <span className="text-stone-900 font-mono">Rp {parseFloat(sale.subtotal.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-600">Adjustment / Retur</span>
                                <span className={cn("font-mono", parseFloat(sale.adjustment.toString()) < 0 ? "text-red-400" : "text-stone-700")}>
                                    {parseFloat(sale.adjustment.toString()) !== 0 && (parseFloat(sale.adjustment.toString()) < 0 ? '' : '+')}
                                    Rp {parseFloat(sale.adjustment.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="pt-4 border-t border-stone-300 flex justify-between items-end">
                                <span className="text-sm font-bold text-stone-900">TOTAL AKHIR</span>
                                <span className="text-2xl font-black text-brand-light-green font-mono">
                                    Rp {parseFloat(sale.total_amount.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Potongan customer (kuli bongkar, dll): nota stays, customer pays less */}
                            {(canEditDeduction || savedDeduction > 0) && (
                                <div className="mt-4 p-3 rounded-xl border border-stone-300 bg-stone-100 space-y-2">
                                    {canEditDeduction ? (
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">Total Diterima dari Customer</label>
                                                <CurrencyInput
                                                    value={receivedInput !== null ? receivedInput : String(Math.round(totalDiterima * 100) / 100)}
                                                    onChange={handleTotalDiterimaChange}
                                                    onBlur={() => setReceivedInput(null)}
                                                    placeholder="Ketik nominal yang diterima"
                                                    className="font-mono font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">Potongan</label>
                                                    <CurrencyInput
                                                        value={deductionInput !== null ? deductionInput : (savedDeduction ? String(savedDeduction) : '')}
                                                        onChange={v => { setDeductionInput(v); setReceivedInput(null) }}
                                                        placeholder="0"
                                                        className="font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">Keterangan</label>
                                                    <Input value={deductionNote} onChange={e => setDeductionNote(e.target.value)} placeholder="Kuli bongkar" />
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-stone-500">
                                                Isi jika customer memotong pembayaran (mis. kuli bongkar). Nota tetap, selisihnya dicatat sebagai beban dan mengurangi sisa tagihan.
                                            </p>
                                            {deductionDirty && (
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setDeductionInput(null); setReceivedInput(null); setDeductionNote(sale.deduction_note || '') }}
                                                        className="px-3 py-1.5 text-xs text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-lg"
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveDeduction}
                                                        disabled={savingDeduction}
                                                        className="px-3 py-1.5 text-xs font-medium text-white bg-brand-light-green hover:bg-brand-light-green/80 rounded-lg disabled:opacity-50"
                                                    >
                                                        {savingDeduction ? 'Menyimpan…' : 'Simpan Potongan'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-600">Potongan Customer{sale.deduction_note ? ` (${sale.deduction_note})` : ''}</span>
                                            <span className="font-mono text-red-400">-Rp {savedDeduction.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-stone-300/50 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-600">Sudah Masuk</span>
                                    <span className="text-brand-light-green font-bold font-mono">Rp {parseFloat(sale.paid_amount.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {savedDeduction > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-stone-600">Dipotong Customer</span>
                                        <span className="font-mono text-stone-700">Rp {savedDeduction.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-stone-600">
                                        {Math.max(0, parseFloat(sale.outstanding.toString())) < 0 ? 'Retur Produk' : 'Sisa Piutang (AR)'}
                                    </span>
                                    <span className={cn(
                                        Math.max(0, parseFloat(sale.outstanding.toString())) < 0
                                            ? "text-red-400 font-bold font-mono" // Like sudah dibayar but red
                                            : cn("font-black font-mono text-lg", Math.max(0, parseFloat(sale.outstanding.toString())) > 0 ? "text-red-400" : "text-brand-light-green")
                                    )}>
                                        Rp {Math.abs(Math.max(0, parseFloat(sale.outstanding.toString()))).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {Math.max(0, parseFloat(sale.outstanding.toString())) > 0 && sale.status !== 'VOID' && (
                            <Button
                                onClick={() => setActiveTab('payment')}
                                className="w-full mt-8 bg-amber-600 hover:bg-amber-500 text-white gap-2"
                            >
                                <CreditCard size={18} />
                                Bayar Piutang
                            </Button>
                        )}

                        {sale.status === 'VOID' && (
                            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase tracking-wider">
                                    <AlertTriangle size={16} />
                                    Nota Dibatalkan
                                </div>
                                <p className="text-xs text-stone-600 italic">
                                    "{sale.void_reason}"
                                </p>
                                <p className="text-[10px] text-stone-500 mt-2">
                                    Dibatalkan pada {sale.void_at && format(new Date(sale.void_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals placeholders - in real impl these would have full forms */}
            {isItemModalOpen && (
                <AddItemModal
                    onClose={() => setIsItemModalOpen(false)}
                    saleId={sale.id}
                    inventory={inventory}
                    refresh={() => { fetchSale(); fetchAuxData(); }}
                />
            )}
            {isPaymentModalOpen && (
                <AddPaymentModal
                    onClose={() => setIsPaymentModalOpen(false)}
                    submit={(data) => salesV2API.createPayment(sale.id, data)}
                    refresh={fetchSale}
                    maxAmount={Math.max(0, parseFloat(sale.outstanding.toString()))}
                    showNotes
                    notesLabel="Keterangan"
                    notesBelowBukti
                />
            )}

            {isReturnModalOpen && (
                <AddReturnModal
                    onClose={() => setIsReturnModalOpen(false)}
                    saleId={sale.id}
                    items={sale.items || []}
                    refresh={fetchSale}
                />
            )}

            {isCloseModalOpen && (
                <CloseModal
                    onClose={() => setIsCloseModalOpen(false)}
                    saleId={sale.id}
                    refresh={fetchSale}
                />
            )}

            {isVoidModalOpen && (
                <VoidModal
                    onClose={() => setIsVoidModalOpen(false)}
                    saleId={sale.id}
                    refresh={fetchSale}
                />
            )}

            {isChangeCustomerModalOpen && (
                <ChangeCustomerModal
                    onClose={() => setIsChangeCustomerModalOpen(false)}
                    saleId={sale.id}
                    currentCustomerId={sale.customer_id}
                    refresh={fetchSale}
                />
            )}
        </div>
    )
}

// ════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════

function TabButton({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-none md:flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-sm font-bold transition-all relative whitespace-nowrap',
                active
                    ? 'bg-stone-300 text-stone-900 shadow-lg'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-300/50'
            )}
        >
            {icon}
            <span>{label}</span>
            {count !== undefined && count > 0 && (
                <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    active ? "bg-brand-light-green text-white" : "bg-stone-400 text-stone-600"
                )}>
                    {count}
                </span>
            )}
            {active && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-light-green rounded-full shadow-[0_0_8px_rgba(var(--color-brand-light-green),0.8)]" />
            )}
        </button>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        DRAFT: 'bg-stone-300 text-stone-600 border-stone-400',
        CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        PARTIAL_DELIVERED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        COMPLETED: 'bg-brand-light-green/10 text-brand-light-green border-brand-light-green/20',
        CLOSED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        VOID: 'bg-red-500/10 text-red-400 border-red-500/20',
    }

    let displayStatus = status.replace('_', ' ')
    if (['CONFIRMED', 'PARTIAL_DELIVERED', 'COMPLETED'].includes(status)) {
        displayStatus = 'IN PROCESS'
    }

    return (
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-widest', styles[status] || styles.DRAFT)}>
            {displayStatus}
        </span>
    )
}

// ════════════════════════════════════════
// TAB PANELS
// ════════════════════════════════════════

function ItemsPanel({ items, isDraft, onAdd, saleId, refresh }: { items: SaleItem[], isDraft: boolean, onAdd: () => void, saleId: string, refresh: () => void }) {
    const handleRemove = async (itemId: string) => {
        if (!await confirmDialog('Hapus item ini dari nota?')) return
        try {
            await salesV2API.removeItem(saleId, itemId)
            toast.success('Item dihapus')
            refresh()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal hapus item')
        }
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Item dalam Nota</h3>
                {isDraft && (
                    <Button onClick={onAdd} variant="outline" size="sm" className="border-brand-light-green/30 text-brand-light-green hover:bg-brand-light-green/10 gap-2 h-8 text-xs">
                        <Plus size={14} /> Tambah Item
                    </Button>
                )}
            </div>

            <div className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-stone-100/30 text-stone-500 text-[10px] uppercase tracking-widest font-bold">
                            <tr>
                                <th className="px-6 py-4">Produk</th>
                                <th className="px-6 py-4">Harga Unit</th>
                                <th className="px-6 py-4">Qty Order</th>
                                <th className="px-6 py-4">Qty Dikirim</th>
                                <th className="px-6 py-4">Subtotal</th>
                                {isDraft && <th className="px-6 py-4 text-right">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-300/50">
                            {items.length > 0 ? items.map(item => (
                                <tr key={item.id} className="hover:bg-stone-300/20 group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-stone-900">{item.item_name}</div>
                                        <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">{item.category_code}</div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-stone-700">
                                        Rp {parseFloat(item.unit_price.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span className="text-[10px] text-stone-500 ml-1 uppercase">/{item.unit_type}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-black text-stone-900">{parseFloat(item.qty_ordered.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className="text-stone-500 text-[10px] ml-1">{item.unit_type === 'SACK' ? 'Karung' : 'Kg'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-stone-300 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full", parseFloat(item.qty_delivered.toString()) >= parseFloat(item.qty_ordered.toString()) ? "bg-brand-light-green" : "bg-brand-light-green")}
                                                    style={{ width: `${(parseFloat(item.qty_delivered.toString()) / parseFloat(item.qty_ordered.toString())) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-stone-700">
                                                {parseFloat(item.qty_delivered.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-black font-mono text-stone-900">
                                        Rp {parseFloat(item.subtotal.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    {isDraft && (
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleRemove(item.id)}
                                                className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-500 italic">
                                        Belum ada produk dalam nota ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

/* DeliveryPanel removed per user request
function DeliveryPanel({ deliveries, canAdd, onAdd, refresh }: { deliveries: SaleDelivery[], canAdd: boolean, onAdd: () => void, refresh: () => void }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Riwayat Pengambilan</h3>
                {canAdd && (
                    <Button onClick={onAdd} className="bg-amber-600 hover:bg-amber-500 text-stone-900 gap-2 h-8 text-xs">
                        <Truck size={14} /> Catat Pengambilan
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {deliveries.length > 0 ? deliveries.map(delivery => (
                    <div key={delivery.id} className="bg-stone-200 border border-stone-300 rounded-2xl p-5 shadow-lg group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-stone-900">
                                        Pengambilan pada {format(new Date(delivery.delivery_date), 'dd MMMM yyyy', { locale: id })}
                                    </div>
                                    <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">
                                        Dicatat oleh {delivery.created_by_name}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            {delivery.items?.map(item => (
                                <div key={item.id} className="bg-stone-100/50 p-2 rounded-lg border border-stone-300/30 flex justify-between items-center">
                                    <span className="text-xs text-stone-700">{item.item_name}</span>
                                    <span className="text-xs font-black text-stone-900">{parseFloat(item.qty_delivered.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-stone-500 font-normal uppercase text-[10px]">{item.unit_type}</span></span>
                                </div>
                            ))}
                        </div>

                        {delivery.notes && (
                            <p className="text-xs text-stone-600 italic bg-stone-300/30 p-2 rounded-lg border-l-2 border-amber-500/50">
                                "{delivery.notes}"
                            </p>
                        )}
                    </div>
                )) : (
                    <div className="bg-stone-200 border border-stone-300 border-dashed rounded-2xl py-12 text-center text-stone-500 text-sm">
                        Belum ada barang yang dikirim / diambil.
                    </div>
                )}
            </div>
        </div>
    )
}
*/

// Arus uang satu nota: uang masuk dari customer, potongan, dan bagian biaya truk (transport + komisi)
function MoneyFlowCard({ sale, transportShare, commissionShare, sharePct }: {
    sale: SaleV2
    transportShare: number
    commissionShare: number
    sharePct: number | null
}) {
    const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
    const paid = parseFloat(String(sale.paid_amount)) || 0
    const deduction = parseFloat(String(sale.customer_deduction ?? 0)) || 0
    const total = parseFloat(String(sale.total_amount)) || 0
    const outstanding = parseFloat(String(sale.outstanding)) || 0
    const flow = sale.cash_flow || {}

    const statusBadge = (key: 'transport' | 'commission' | 'deduction') => {
        const f = flow[key]
        if (!f) return <span className="text-[10px] text-stone-400">belum dicatat</span>
        if (f.status === 'APPROVED') {
            return (
                <span className="text-[10px] font-semibold text-brand-light-green">
                    ✓ {key === 'deduction' ? 'disetujui' : 'dibayar'}{f.voucher_no ? ` · ${f.voucher_no}` : ''}
                </span>
            )
        }
        if (f.status === 'PENDING') return <span className="text-[10px] font-semibold text-amber-600">menunggu Keuangan</span>
        return <span className="text-[10px] text-stone-500">{f.status.toLowerCase()}</span>
    }

    const out = transportShare + commissionShare
    const net = paid - out
    const row = 'flex items-start justify-between gap-3 py-2'

    return (
        <div className="mt-4 rounded-2xl border border-stone-300 bg-stone-100 p-4">
            <h4 className="text-sm font-bold text-stone-900 mb-1">Arus Uang Nota Ini</h4>
            <p className="text-[11px] text-stone-500 mb-2">
                Semua uang masuk dan keluar yang terkait nota ini.
                {sharePct !== null && ` Biaya truk dibagi sesuai muatan (nota ini ${sharePct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%).`}
            </p>

            <div className="divide-y divide-stone-300 text-sm">
                <div className={row}>
                    <div>
                        <div className="text-stone-800">Nilai nota</div>
                        <div className="text-[10px] text-stone-500">Tagihan resmi ke customer</div>
                    </div>
                    <span className="font-mono text-stone-700">{rp(total)}</span>
                </div>
                <div className={row}>
                    <div>
                        <div className="text-stone-800">Uang masuk dari customer</div>
                        <div className="text-[10px] text-stone-500">{sale.payments?.length || 0} Pendapatan</div>
                    </div>
                    <span className="font-mono text-brand-light-green font-semibold">+{rp(paid)}</span>
                </div>
                {deduction > 0 && (
                    <div className={row}>
                        <div>
                            <div className="text-stone-800">Dipotong customer{sale.deduction_note ? ` (${sale.deduction_note})` : ''}</div>
                            {statusBadge('deduction')}
                        </div>
                        <span className="font-mono text-stone-500">{rp(deduction)}</span>
                    </div>
                )}
                {sharePct !== null && (
                    <>
                        <div className={row}>
                            <div>
                                <div className="text-stone-800">Transport (bagian nota ini)</div>
                                {statusBadge('transport')}
                            </div>
                            <span className="font-mono text-rose-500">-{rp(transportShare)}</span>
                        </div>
                        <div className={row}>
                            <div>
                                <div className="text-stone-800">Komisi calo (bagian nota ini)</div>
                                {statusBadge('commission')}
                            </div>
                            <span className="font-mono text-rose-500">-{rp(commissionShare)}</span>
                        </div>
                    </>
                )}
                <div className={`${row} font-bold`}>
                    <span className="text-stone-900">Bersih diterima</span>
                    <span className={`font-mono ${net >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>{rp(net)}</span>
                </div>
                {outstanding > 0.009 && (
                    <div className={row}>
                        <span className="text-stone-600">Sisa tagihan belum dibayar</span>
                        <span className="font-mono text-amber-600">{rp(outstanding)}</span>
                    </div>
                )}
            </div>
            {sharePct === null && (
                <p className="text-[11px] text-stone-500 mt-2">Nota ini belum masuk pengiriman, jadi belum ada biaya transport/komisi.</p>
            )}
        </div>
    )
}

function PaymentPanel({ payments, canAdd, onAdd, refresh: _refresh }: { payments: SalePayment[], canAdd: boolean, onAdd: () => void, refresh: () => void }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Riwayat Pembayaran</h3>
                {canAdd && (
                    <Button onClick={onAdd} className="bg-brand-light-green hover:bg-brand-light-green text-white gap-2 h-8 text-xs">
                        <Plus size={14} /> Tambah Bayar
                    </Button>
                )}
            </div>

            <div className="bg-stone-200 border border-stone-300 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-stone-100/30 text-stone-500 text-[10px] uppercase tracking-widest font-bold">
                            <tr>
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4">Metode</th>
                                <th className="px-6 py-4">Referensi</th>
                                <th className="px-6 py-4">Keterangan</th>
                                <th className="px-6 py-4">Jumlah Bayar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-300/50">
                            {payments.length > 0 ? payments.map(payment => (
                                <tr key={payment.id} className="hover:bg-stone-300/20 group">
                                    <td className="px-6 py-4">
                                        <div className="text-stone-900 font-medium">{format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: id })}</div>
                                        <div className="text-[10px] text-stone-500 mt-0.5 uppercase tracking-widest">Oleh {payment.created_by_name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 bg-brand-light-green/10 text-brand-light-green text-[10px] font-bold rounded uppercase tracking-wider border border-brand-light-green/20">
                                            {payment.method}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-stone-600 text-xs">
                                        {payment.reference_no || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-stone-600 text-xs max-w-[240px] whitespace-pre-wrap break-words">
                                        {payment.notes || '-'}
                                    </td>
                                    <td className="px-6 py-4 font-black font-mono text-brand-light-green">
                                        Rp {parseFloat(payment.amount.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-stone-500 italic">
                                        Belum ada catatan pembayaran.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function ReturnsPanel({ returns, canAdd, onAdd, onDelete, refresh: _refresh }: { returns: SaleReturn[], canAdd: boolean, onAdd: () => void, onDelete: (id: string) => void, refresh: () => void }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Retur & Penyesuaian</h3>
                {canAdd && (
                    <Button onClick={onAdd} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 h-8 text-xs">
                        <RotateCcw size={14} /> Buat Retur
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {returns.length > 0 ? returns.map(retur => (
                    <div key={retur.id} className="bg-stone-200 border border-red-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />

                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center">
                                    <RotateCcw size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-stone-900 flex items-center gap-2">
                                        Retur {retur.return_type === 'PARTIAL_REFUND' ? 'Sebagian' : retur.return_type === 'FULL_REFUND' ? 'Penuh' : retur.return_type === 'PRICE_REDUCTION' ? 'Pengurangan Harga' : (retur.return_type as string || '').replace('_', ' ')}
                                        <span className="text-[10px] font-normal text-stone-500">• {format(new Date(retur.return_date), 'dd MMM yyyy', { locale: id })}</span>
                                    </div>
                                    <div className="text-xs text-red-400 font-mono mt-0.5">
                                        {/* Item returns store amount_adjusted = 0 (the bill drops via qty_ordered), so derive the value from qty × price */}
                                        Tagihan dikurangi Rp {(retur.sale_item_id
                                            ? parseFloat(String(retur.qty_returned)) * parseFloat(String(retur.unit_price ?? 0))
                                            : parseFloat(retur.amount_adjusted.toString())
                                        ).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                            {canAdd && (
                                <button
                                    onClick={() => onDelete(retur.id)}
                                    className="p-2 text-stone-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                    title="Hapus Retur"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 text-xs">
                            <div className="space-y-1">
                                <div className="text-stone-500 uppercase tracking-widest text-[9px]">Item Terkait</div>
                                <div className="text-stone-800 font-medium">{retur.item_name || 'Penyesuaian Umum'}</div>
                            </div>
                            {retur.qty_returned > 0 && (
                                <div className="space-y-1">
                                    <div className="text-stone-500 uppercase tracking-widest text-[9px]">Qty Kembali</div>
                                    <div className="text-stone-800 font-medium">
                                        {parseFloat(retur.qty_returned.toString()).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg
                                        {retur.restocked && <span className="ml-1 text-brand-light-green font-bold">(Restocked)</span>}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <div className="text-stone-500 uppercase tracking-widest text-[9px]">Alasan</div>
                                <div className="text-stone-700 italic">"{retur.reason}"</div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="bg-stone-200 border border-stone-300 border-dashed rounded-2xl py-12 text-center text-stone-500 text-sm">
                        Belum ada data retur.
                    </div>
                )}
            </div>
        </div>
    )
}

// ════════════════════════════════════════
// MODALS (Simplified for now)
// ════════════════════════════════════════

function AddItemModal({ onClose, saleId, inventory, refresh }: any) {
    const [selectedInvId, setSelectedInvId] = useState('')
    const [tempSelectedInvId, setTempSelectedInvId] = useState('')
    const [showProductModal, setShowProductModal] = useState(false)
    const [qty, setQty] = useState('')
    const [price, setPrice] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [filter, setFilter] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    const selectedItem = inventory.find((i: any) => i.id === selectedInvId)

    const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault()

        if (!selectedInvId) {
            toast.error('Silakan pilih produk')
            return
        }
        if (!qty) {
            toast.error('Qty order wajib diisi')
            return
        }
        if (!price) {
            toast.error('Harga jual wajib diisi')
            return
        }

        const qtyNum = parseFloat(qty) || 0
        const priceNum = parseFloat(price) || 0

        const availNum = Number(selectedItem?.available_weight_kg ?? selectedItem?.remaining_weight_kg ?? 0)

        if (qtyNum > availNum) {
            toast.error(`Qty (${qtyNum.toLocaleString()} Kg) melebihi stok tersedia! Maksimal: ${availNum.toLocaleString()} Kg`)
            return
        }
        if (qtyNum <= 0) {
            toast.error('Qty order harus lebih dari 0')
            return
        }
        if (priceNum < 0) {
            toast.error('Harga jual tidak boleh kurang dari 0')
            return
        }

        try {
            setIsSubmitting(true)
            await salesV2API.addItem(saleId, {
                inventoryItemId: selectedInvId,
                itemName: `${selectedItem.category_name || selectedItem.product_category_code} (${selectedItem.area || selectedItem.tanda || 'Stok'})`,
                categoryCode: selectedItem.product_category_code,
                unitType: 'KG',
                unitPrice: parseFloat(price),
                qtyOrdered: qtyNum
            })
            toast.success('Item ditambahkan')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredInventory = inventory.filter((i: any) => {
        const matchesFilter = (() => {
            if (filter === 'ALL') return true
            if (filter === 'GABAH_KERING') return i.product_category_code === 'GABAH_KERING'
            if (filter === 'GABAH_BASAH') return i.product_category_code === 'GABAH_BASAH'
            if (filter === 'BERAS') return i.product_category_code === 'BERAS'
            if (filter === 'TURUNAN') return i.product_category_code === 'TURUNAN'
            if (filter === 'LIMBAH') return i.product_category_code === 'LIMBAH'
            return i.product_category_code === filter
        })()
        if (!matchesFilter) return false
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            const name = (i.area || i.tanda || '').toLowerCase()
            const cat = (i.product_category_code || '').toLowerCase()
            return name.includes(q) || cat.includes(q)
        }
        return true
    })

    const FILTER_OPTIONS = [
        { key: 'ALL', label: 'SEMUA' },
        { key: 'GABAH_KERING', label: 'GABAH KERING' },
        { key: 'GABAH_BASAH', label: 'GABAH BASAH' },
        { key: 'BERAS', label: 'BERAS' },
        { key: 'TURUNAN', label: 'PRODUK TURUNAN' },
        { key: 'LIMBAH', label: 'LIMBAH / SEKAM' },
    ]

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col">
                    <div className="p-6 border-b border-stone-300 shrink-0">
                        <h2 className="text-xl font-bold text-stone-900">Tambah Item Produk</h2>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                        <form id="add-item-form" onSubmit={handleSubmit} noValidate className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                                    Produk / Stok Barang <span className="text-red-400">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTempSelectedInvId(selectedInvId)
                                        setShowProductModal(true)
                                    }}
                                    className="w-full h-14 bg-stone-100 hover:bg-stone-100/80 border border-stone-300 hover:border-brand-light-green/50 rounded-xl text-sm font-bold flex items-center justify-between px-4 transition-all active:scale-95 text-stone-900 shadow-inner group"
                                >
                                    <div className="flex items-center gap-3.5 overflow-hidden">
                                        <div className="w-9 h-9 rounded-lg bg-brand-light-green/10 border border-brand-light-green/20 flex items-center justify-center text-brand-light-green shrink-0 group-hover:scale-105 transition-transform">
                                            <Package size={18} />
                                        </div>
                                        <div className="text-left truncate">
                                            {selectedItem ? (
                                                <>
                                                    <div className="font-bold text-stone-900 text-sm truncate">{selectedItem.area || selectedItem.tanda || 'Stok Gudang'} <span className="text-xs font-normal text-stone-600">({selectedItem.product_category_code?.replace('_', ' ')})</span></div>
                                                    <div className="text-xs text-brand-light-green font-mono font-semibold">Tersedia: {Number(selectedItem.available_weight_kg ?? selectedItem.remaining_weight_kg ?? 0).toLocaleString()} Kg</div>
                                                </>
                                            ) : (
                                                <span className="text-stone-600 text-sm font-normal">Klik untuk memilih produk dari inventori...</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-brand-light-green bg-brand-light-green/10 px-3 py-1.5 rounded-lg border border-brand-light-green/20 group-hover:bg-brand-light-green/20 shrink-0 ml-2">
                                        {selectedItem ? 'Ganti' : 'Pilih Produk'}
                                    </span>
                                </button>
                                {selectedItem && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedInvId('')}
                                        className="mt-2 text-xs text-stone-500 hover:text-red-400 transition-colors inline-flex items-center gap-1 font-medium"
                                    >
                                        × Batalkan pilihan produk
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-300/60">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                                        Qty Order (Kg) {selectedItem && <span className="text-brand-light-green font-normal lowercase">(max: {Number(selectedItem.available_weight_kg ?? selectedItem.remaining_weight_kg ?? 0).toLocaleString()})</span>}
                                    </label>
                                    <NumberInput ui

                                        step="any"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        max={selectedItem ? (selectedItem.available_weight_kg ?? selectedItem.remaining_weight_kg) : undefined}
                                        required
                                        className="font-mono text-lg bg-stone-100 border-stone-300 focus:border-brand-light-green"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Harga Jual/Kg (Rp)</label>
                                    <CurrencyInput
                                        value={price}
                                        onChange={(val: string) => setPrice(val)}
                                        required
                                        className="font-mono text-lg bg-stone-100 border-stone-300 focus:border-brand-light-green"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="p-6 border-t border-stone-300 shrink-0 flex gap-3 bg-stone-100/50">
                        <Button type="button" variant="ghost" className="flex-1 hover:bg-stone-200" onClick={onClose}>Batal</Button>
                        <Button type="button" onClick={handleSubmit} className="flex-1 bg-brand-light-green hover:bg-brand-light-green font-bold text-white" disabled={isSubmitting || !selectedInvId}>
                            {isSubmitting ? <div className="spinner-xs" /> : <><ShoppingCart size={16} className="mr-2 text-white" /> Tambahkan ke Pesanan</>}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Product Picker Modal */}
            {showProductModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowProductModal(false)} />
                    <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-stone-300 flex items-center justify-between shrink-0 bg-stone-100/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-brand-light-green/10 border border-brand-light-green/20 text-brand-light-green">
                                    <Filter size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-stone-900">Pilih Stok Barang dari Gudang</h3>
                                    <p className="text-xs text-stone-600">Filter dan cari produk untuk dimasukkan ke pesanan</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                            {/* Search and Filters */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Cari berdasarkan lokasi gudang, tanda, atau kategori..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-stone-100 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder-stone-500 focus:outline-none focus:border-brand-light-green transition-colors shadow-inner"
                                    />
                                </div>

                                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
                                    {FILTER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setFilter(opt.key)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${filter === opt.key
                                                ? 'bg-brand-light-green/20 text-brand-light-green border-brand-light-green/60 shadow-[0_0_12px_rgba(14,165,233,0.25)] scale-[1.02]'
                                                : 'bg-stone-100/80 text-stone-600 border-stone-300 hover:border-stone-500 hover:bg-stone-200 hover:text-stone-800'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Inventory Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                {filteredInventory.map((i: any) => {
                                    const isSelected = tempSelectedInvId === i.id
                                    return (
                                        <div
                                            key={i.id}
                                            onClick={() => setTempSelectedInvId(i.id)}
                                            className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all select-none ${isSelected
                                                ? 'bg-brand-light-green/15 border-brand-light-green shadow-[0_0_20px_rgba(14,165,233,0.2)] ring-1 ring-brand-light-green'
                                                : 'bg-stone-100/90 border-stone-300/80 hover:border-stone-500 hover:bg-stone-200/80'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-stone-200 text-stone-700 border border-stone-400 tracking-wider uppercase shadow-sm">
                                                    {(i.product_category_code || '').replace('_', ' ')}
                                                </span>
                                                {isSelected && (
                                                    <span className="text-[10px] bg-brand-light-green text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                                                        ✓ Terpilih
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-bold text-stone-900 text-base mb-1 line-clamp-1">
                                                {(i.product_category_code === 'TURUNAN' || i.product_category_code === 'LIMBAH')
                                                    ? `${(i.area || i.tanda || 'Gudang Utama')} - ${i.notes?.includes(']') ? i.notes.split(']')[0].replace('[', '') : i.product_category_code}`
                                                    : (i.area || i.tanda || 'Gudang Utama')}
                                            </div>
                                            <div className="text-xs text-stone-600 flex items-center justify-between mt-auto pt-3 border-t border-stone-300/50">
                                                <span className="font-medium">Stok Tersedia:</span>
                                                <span className="text-brand-light-green font-mono font-bold text-sm bg-brand-light-green/10 px-2.5 py-0.5 rounded-lg border border-brand-light-green/20 shadow-sm">
                                                    {Number(i.available_weight_kg ?? i.remaining_weight_kg ?? 0).toLocaleString()} Kg
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                                {filteredInventory.length === 0 && (
                                    <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center py-14 bg-stone-100/40 rounded-2xl border border-stone-200 border-dashed">
                                        <Package className="text-stone-400 mb-3 animate-pulse" size={36} />
                                        <div className="text-stone-700 text-sm font-bold mb-1">Tidak Ada Produk Ditemukan</div>
                                        <div className="text-stone-500 text-xs">Coba ganti filter atau kata kunci pencarian Anda.</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-stone-300 shrink-0 flex gap-3 bg-stone-100/60">
                            <Button
                                type="button"
                                variant="ghost"
                                className="flex-1 hover:bg-stone-200"
                                onClick={() => setShowProductModal(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                className="flex-1 bg-brand-light-green hover:bg-brand-light-green font-bold shadow-lg text-white shadow-brand-light-green/20"
                                disabled={!tempSelectedInvId}
                                onClick={() => {
                                    setSelectedInvId(tempSelectedInvId)
                                    setShowProductModal(false)
                                }}
                            >
                                Pilih Produk Ini
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/* AddDeliveryModal removed per user request
function AddDeliveryModal({ onClose, saleId, items, refresh }: any) {
    const [deliveryItems, setDeliveryItems] = useState<any[]>([])
    const [notes, setNotes] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        // Initialize with 0 for all items
        setDeliveryItems(items.map((i: any) => ({
            saleItemId: i.id,
            qtyDelivered: 0,
            itemName: i.item_name,
            max: parseFloat(i.qty_ordered) - parseFloat(i.qty_delivered)
        })))
    }, [items])

    const handleQtyChange = (itemId: string, val: string) => {
        setDeliveryItems(prev => prev.map(i => 
            i.saleItemId === itemId ? { ...i, qtyDelivered: parseFloat(val) || 0 } : i
        ))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const filtered = deliveryItems.filter(i => i.qtyDelivered > 0)
        if (!filtered.length) return toast.error('Isi minimal satu qty')
        
        try {
            setIsSubmitting(true)
            await salesV2API.createDelivery(saleId, {
                notes,
                items: filtered.map(i => ({ saleItemId: i.saleItemId, qtyDelivered: i.qtyDelivered }))
            })
            toast.success('Pengambilan dicatat')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-6 animate-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2"><Truck size={24} className="text-amber-500" /> Catat Pengambilan Barang</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3">
                        {deliveryItems.map(item => (
                            <div key={item.saleItemId} className="bg-stone-100/50 p-3 rounded-xl border border-stone-300 flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-stone-900">{item.itemName}</div>
                                    <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Sisa Order: {item.max} Kg</div>
                                </div>
                                <div className="w-32">
                                    <NumberInput ui 
 
                                        step="any"
                                        placeholder="Qty" 
                                        value={item.qtyDelivered || ''} 
                                        onChange={e => handleQtyChange(item.saleItemId, e.target.value)} 
                                        max={item.max}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Catatan Pengiriman (Opsional)</label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: No Polisi Kendaraan / Nama Sopir" />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
                        <Button type="submit" className="flex-1 bg-amber-600" disabled={isSubmitting}>Simpan Pengambilan</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
*/

function VoidModal({ onClose, saleId, refresh }: any) {
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason.trim()) return toast.error('Alasan wajib diisi')
        try {
            setIsSubmitting(true)
            await salesV2API.void(saleId, reason)
            toast.success('Nota dibatalkan')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-stone-200 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-stone-900 mb-2 flex items-center gap-2"><XCircle size={24} className="text-red-500" /> Batalkan Nota</h2>
                <p className="text-sm text-stone-600 mb-6 italic">Tindakan ini tidak dapat dibatalkan. Semua pengambilan akan dihapus dan stok dikembalikan.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Alasan Pembatalan (Wajib)</label>
                        <textarea
                            className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-red-500 h-24 resize-none"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Sebutkan alasan mengapa nota ini dibatalkan..."
                            required
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
                        <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-500" disabled={isSubmitting}>Konfirmasi Batalkan</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ChangeCustomerModal({ onClose, saleId, currentCustomerId, refresh }: any) {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [tiers, setTiers] = useState<CustomerTier[]>([])
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState<string>(currentCustomerId || '')
    const [selectedTier, setSelectedTier] = useState<string>('all')

    useEffect(() => {
        const fetch = async () => {
            try {
                const [custRes, tierRes] = await Promise.all([
                    customersAPI.getAll({ isActive: true }),
                    priceListAPI.getTiers()
                ])
                setCustomers(custRes.data)
                setTiers(tierRes.data)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedCustomer) return toast.error('Pilih pelanggan')
        try {
            setIsSubmitting(true)
            await salesV2API.updateCustomer(saleId, selectedCustomer)
            toast.success('Pelanggan berhasil diubah')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err) || 'Gagal mengubah pelanggan')
        } finally {
            setIsSubmitting(false)
        }
    }

    const filtered = selectedTier === 'all' ? customers : customers.filter(c => c.tier_id === selectedTier)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-stone-200 border border-stone-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-stone-300 flex-shrink-0">
                    <h2 className="text-xl font-bold text-stone-900 mb-4">Ubah Pelanggan</h2>

                    {/* Tier Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <button
                            onClick={() => setSelectedTier('all')}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                                selectedTier === 'all'
                                    ? 'bg-brand-light-green/20 text-brand-light-green border-brand-light-green/30'
                                    : 'bg-stone-300 text-stone-600 border-stone-400 hover:text-stone-900'
                            )}
                        >
                            Semua Tier
                        </button>
                        {tiers.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTier(t.id)}
                                className={cn(
                                    'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                                    selectedTier === t.id
                                        ? 'bg-brand-light-green/20 text-brand-light-green border-brand-light-green/30'
                                        : 'bg-stone-300 text-stone-600 border-stone-400 hover:text-stone-900'
                                )}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="spinner border-t-brand-light-green" />
                        </div>
                    ) : filtered.length > 0 ? (
                        filtered.map(c => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCustomer(c.id)}
                                className={cn(
                                    "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                                    selectedCustomer === c.id
                                        ? "bg-brand-light-green/10 border-brand-light-green text-stone-900 shadow-[0_0_15px_rgba(var(--color-brand-light-green),0.1)]"
                                        : "bg-stone-300/50 border-stone-400 text-stone-700 hover:bg-stone-300 hover:text-stone-900"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                        selectedCustomer === c.id ? "bg-brand-light-green text-stone-900" : "bg-stone-400 text-stone-600"
                                    )}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold">{c.name}</div>
                                        <div className="text-xs opacity-70 mt-0.5">{c.tier_name || 'Umum'} • {c.phone || '-'}</div>
                                    </div>
                                </div>
                                {selectedCustomer === c.id && <CheckCircle2 className="text-brand-light-green" size={20} />}
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-stone-600 text-sm">
                            Tidak ada pelanggan di tier ini
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-stone-300 flex gap-3 flex-shrink-0">
                    <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        className="flex-1 bg-brand-light-green"
                        disabled={isSubmitting || !selectedCustomer || selectedCustomer === currentCustomerId}
                    >
                        Simpan Perubahan
                    </Button>
                </div>
            </div>
        </div>
    )
}

function CloseModal({ onClose, saleId, refresh }: any) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsSubmitting(true)
            await salesV2API.close(saleId)
            toast.success('Penjualan ditutup')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-stone-200 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-stone-900 mb-2 flex items-center gap-2"><CheckCircle2 size={24} className="text-indigo-500" /> Tutup Penjualan</h2>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
                    <p className="text-sm font-bold text-red-400 flex items-center gap-2 mb-1"><AlertTriangle size={16} /> Peringatan Penting</p>
                    <p className="text-xs text-stone-700">Setelah ditutup, data penjualan ini <span className="font-bold text-stone-900">tidak lagi dapat diubah</span> (termasuk retur, pembayaran, dan item pesanan).</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
                        <Button type="submit" className="flex-1 bg-indigo-600 text-white hover:bg-indigo-500" disabled={isSubmitting}>Konfirmasi Tutup</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AddReturnModal({ onClose, saleId, items, refresh }: any) {
    const [returnItems, setReturnItems] = useState<{ saleItemId: string, qtyReturned: string, maxQty: number, name: string, price: number }[]>([])
    const [selectedItemId, setSelectedItemId] = useState('')
    const [amountAdjusted, setAmountAdjusted] = useState('')
    const [reason, setReason] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // qty_ordered is already net of previous returns — don't subtract them again
    const getMaxQty = (item: any) => Math.max(0, parseFloat(item.qty_ordered));

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            if (photos.length + files.length > 3) {
                toast.error('Maksimal 3 foto bukti')
                return
            }
            const compressed = await Promise.all(files.map(f => compressImage(f)))
            setPhotos(prev => [...prev, ...compressed].slice(0, 3))
        }
    }

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index))
    }

    const handleAddItem = () => {
        if (!selectedItemId) return;
        const item = items.find((i: any) => i.id === selectedItemId);
        if (!item) return;
        if (returnItems.find(ri => ri.saleItemId === item.id)) {
            toast.error('Item sudah ada dalam daftar retur');
            return;
        }

        const maxQty = getMaxQty(item);

        if (maxQty <= 0) {
            toast.error('Seluruh kuantitas item ini sudah diretur');
            return;
        }

        setReturnItems([...returnItems, {
            saleItemId: item.id,
            qtyReturned: '',
            maxQty,
            name: item.item_name,
            price: parseFloat(item.unit_price)
        }]);
        setSelectedItemId('');
    }

    const removeReturnItem = (id: string) => {
        setReturnItems(returnItems.filter(i => i.saleItemId !== id));
    }

    const updateQty = (id: string, val: string) => {
        setReturnItems(returnItems.map(i => i.saleItemId === id ? { ...i, qtyReturned: val } : i));
    }

    const totalDeduction = returnItems.reduce((acc, curr) => acc + (parseFloat(curr.qtyReturned) || 0) * curr.price, 0) + (parseFloat(amountAdjusted) || 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (returnItems.length === 0 && (!amountAdjusted || parseFloat(amountAdjusted) <= 0)) {
            return toast.error('Tambahkan minimal satu item untuk diretur atau isi biaya tambahan')
        }
        if (!reason.trim()) return toast.error('Catatan wajib diisi')


        for (const ri of returnItems) {
            const qtyNum = parseFloat(ri.qtyReturned) || 0
            if (qtyNum <= 0) return toast.error(`Berat retur untuk ${ri.name} harus lebih dari 0`)
            if (qtyNum >= ri.maxQty) return toast.error(`Berat retur untuk ${ri.name} harus kurang dari sisa pesanan (${ri.maxQty} Kg). Untuk retur seluruhnya, hapus item dari nota.`)
        }

        const amountNum = parseFloat(amountAdjusted) || 0

        try {
            setIsSubmitting(true)
            // 1. Create return
            await salesV2API.createReturn(saleId, {
                returnType: 'PARTIAL_REFUND',
                reason,
                biayaTambahan: amountNum,
                items: returnItems.map(ri => ({
                    saleItemId: ri.saleItemId,
                    qtyReturned: parseFloat(ri.qtyReturned || '0')
                }))
            })

            // 2. Upload photos
            for (const photo of photos) {
                await filesAPI.upload(photo, 'retur', { saleId, saleType: 'v2' })
            }

            toast.success('Retur berhasil dibuat')
            refresh()
            onClose()
        } catch (err: any) {
            toast.error(getCleanErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <div className="relative bg-stone-200 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                    <div className="p-6 border-b border-stone-300 shrink-0">
                        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2"><RotateCcw size={24} className="text-red-500" /> Buat Retur Baru</h2>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                        <form id="add-return-form" onSubmit={handleSubmit} className="space-y-6" noValidate>

                            {/* Section 1: Select Items */}
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Item Produk yang Diretur</label>

                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-red-500"
                                        value={selectedItemId}
                                        onChange={e => setSelectedItemId(e.target.value)}
                                    >
                                        <option value="">-- Pilih Item --</option>
                                        {items.map((i: any) => (
                                            <option key={i.id} value={i.id}>
                                                {i.item_name} (Max: {getMaxQty(i)} Kg)
                                            </option>
                                        ))}
                                    </select>
                                    <Button type="button" onClick={handleAddItem} className="bg-stone-300 hover:bg-stone-400 border border-stone-400 shadow-sm shrink-0">
                                        <Plus size={16} /> Tambah
                                    </Button>
                                </div>

                                {returnItems.length > 0 && (
                                    <div className="space-y-2 mt-4 bg-stone-100/50 p-3 rounded-xl border border-stone-300">
                                        {returnItems.map(ri => (
                                            <div key={ri.saleItemId} className="flex items-center gap-3 bg-stone-200 p-3 rounded-lg border border-stone-300">
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-stone-900">{ri.name}</div>
                                                    <div className="text-[10px] text-stone-600">Harga: Rp {ri.price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Kg • Sisa pesanan: {ri.maxQty} Kg</div>
                                                </div>
                                                <div className="w-24">
                                                    <NumberInput ui

                                                        step="any"
                                                        value={ri.qtyReturned}
                                                        onChange={e => updateQty(ri.saleItemId, e.target.value)}
                                                        max={ri.maxQty}
                                                        min={0}
                                                        className="font-mono bg-stone-100 border-stone-400 focus:border-red-500 h-9"
                                                        placeholder="Qty (Kg)"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeReturnItem(ri.saleItemId)}
                                                    className="text-stone-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Biaya Tambahan & Total */}
                            <div className="space-y-4 pt-4 border-t border-stone-300">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Biaya Tambahan (Rp)</label>
                                    <CurrencyInput
                                        value={amountAdjusted}
                                        onChange={(val: string) => setAmountAdjusted(val)}
                                        className="font-mono bg-stone-100 border-stone-300 focus:border-red-500"
                                        placeholder="Contoh: Biaya transport, kuli, dll"
                                    />
                                    <p className="text-[10px] text-stone-500 mt-1">Biaya ekstra yang memotong tagihan (opsional).</p>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Total Pemotongan Tagihan</span>
                                        <div className="text-[10px] text-stone-600 mt-0.5">Nilai Produk + Biaya Tambahan</div>
                                    </div>
                                    <span className="font-mono font-black text-lg text-stone-900">Rp {totalDeduction.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Section 3: Note & Photos */}
                            <div className="space-y-4 pt-4 border-t border-stone-300">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Catatan <span className="text-red-400">*</span></label>
                                    <textarea
                                        className="w-full bg-stone-100 border-stone-300 text-stone-900 rounded-lg px-4 py-2 text-sm focus:ring-red-500 h-20 resize-none"
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        placeholder="Alasan retur barang..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Bukti Foto <span className="text-stone-500 font-normal">(Opsional)</span></label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                        id="bukti-upload"
                                        disabled={photos.length >= 3}
                                    />
                                    <label
                                        htmlFor="bukti-upload"
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-xl border border-dashed transition-colors",
                                            photos.length >= 3 ? "bg-stone-100 border-stone-300 opacity-50 cursor-not-allowed" : "bg-stone-100/50 border-stone-400 hover:border-red-500 hover:bg-stone-200 cursor-pointer text-stone-600 hover:text-stone-900"
                                        )}
                                    >
                                        <Plus size={24} className="mb-2" />
                                        <span className="text-xs font-bold">Upload Foto (Max 3)</span>
                                    </label>

                                    {photos.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mt-3">
                                            {photos.map((photo, i) => (
                                                <div key={i} className="relative group rounded-lg overflow-hidden border border-stone-300 aspect-square">
                                                    <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoto(i)}
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-stone-900 transition-opacity"
                                                    >
                                                        <XCircle size={20} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="p-6 border-t border-stone-300 shrink-0 flex gap-3 bg-stone-100/60">
                        <Button type="button" variant="ghost" className="flex-1 hover:bg-stone-200" onClick={onClose}>Batal</Button>
                        <Button type="submit" form="add-return-form" className="flex-1 bg-red-600 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-600/20" disabled={isSubmitting}>
                            {isSubmitting ? <div className="spinner-xs" /> : 'Buat Retur'}
                        </Button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    )
}
