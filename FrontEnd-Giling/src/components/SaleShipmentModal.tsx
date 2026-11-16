import { useEffect, useMemo, useState } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import toast from 'react-hot-toast'
import { Loader2, Lock, RotateCcw, Truck } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { shipmentsAPI, type SaleShipment, type ShipmentSale } from '@/api/client'
import { getCleanErrorMessage } from '@/errors'
import { formatDate } from '@/utils/helpers'

/**
 * Pengiriman penjualan: 1 mobil = 1 pengiriman, bisa membawa beberapa nota
 * (atau 1 nota dengan beberapa harga). Biaya transport & komisi calo dibayar pabrik,
 * nota tetap utuh. Komisi = tarif/kg × total kg (bisa diubah manual).
 */

interface Props {
    isOpen: boolean
    onClose: () => void
    onSaved: (shipment: SaleShipment) => void
    /** Edit an existing shipment */
    shipment?: SaleShipment | null
    /** New shipment opened from a nota: tick it by default */
    preselectSaleId?: string
}

const num = (v: unknown) => {
    const n = parseFloat(String(v ?? ''))
    return Number.isFinite(n) ? n : 0
}
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
const kg = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
const today = () => new Date().toISOString().slice(0, 10)

export default function SaleShipmentModal({ isOpen, onClose, onSaved, shipment, preselectSaleId }: Props) {
    const isEdit = !!shipment
    const [loadingSales, setLoadingSales] = useState(false)
    const [saving, setSaving] = useState(false)
    const [available, setAvailable] = useState<ShipmentSale[]>([])
    const [selected, setSelected] = useState<string[]>([])

    const [form, setForm] = useState({
        shipmentDate: today(),
        driverName: '',
        crewNames: '',
        origin: '',
        destination: '',
        durationHours: '',
        operationalCost: '',
        commissionRecipient: '',
        commissionRatePerKg: '',
        commissionAmount: '',
        notes: '',
    })
    // false = Total Komisi follows tarif × kg; true = user typed their own total
    const [commissionEdited, setCommissionEdited] = useState(false)

    const transportLocked = shipment?.transport_journal_status === 'APPROVED'
    const commissionLocked = shipment?.commission_journal_status === 'APPROVED'

    useEffect(() => {
        if (!isOpen) return
        if (shipment) {
            const rate = num(shipment.commission_rate_per_kg)
            const amount = num(shipment.commission_amount)
            const totalKg = num(shipment.total_kg)
            setForm({
                shipmentDate: (shipment.shipment_date || shipment.reference_date || shipment.created_at || '').slice(0, 10) || today(),
                driverName: shipment.driver_name || '',
                crewNames: shipment.crew_names || '',
                origin: shipment.origin || '',
                destination: shipment.destination || '',
                durationHours: shipment.duration_hours != null ? String(shipment.duration_hours) : '',
                operationalCost: num(shipment.operational_cost) > 0 ? String(Math.round(num(shipment.operational_cost))) : '',
                commissionRecipient: shipment.commission_recipient || '',
                commissionRatePerKg: rate > 0 ? String(rate) : '',
                commissionAmount: amount > 0 ? String(Math.round(amount)) : '',
                notes: shipment.notes || '',
            })
            setCommissionEdited(Math.abs(Math.round(rate * totalKg) - amount) >= 1)
            setSelected((shipment.sales || []).map(s => s.id))
        } else {
            setForm({
                shipmentDate: today(), driverName: '', crewNames: '', origin: '', destination: '',
                durationHours: '', operationalCost: '', commissionRecipient: '', commissionRatePerKg: '',
                commissionAmount: '', notes: '',
            })
            setCommissionEdited(false)
            setSelected(preselectSaleId ? [preselectSaleId] : [])
        }

        setLoadingSales(true)
        shipmentsAPI.getAvailableSales(shipment?.id)
            .then(res => setAvailable(res.data || []))
            .catch(err => toast.error(getCleanErrorMessage(err) || 'Gagal memuat daftar nota'))
            .finally(() => setLoadingSales(false))
    }, [isOpen, shipment, preselectSaleId])

    const selectedSales = useMemo(
        () => available.filter(s => selected.includes(s.id)),
        [available, selected]
    )
    const totalKg = selectedSales.reduce((sum, s) => sum + num(s.total_kg), 0)
    const rate = num(form.commissionRatePerKg)
    const autoCommission = Math.round(rate * totalKg)
    const commission = commissionEdited ? num(form.commissionAmount) : autoCommission
    const transport = num(form.operationalCost)

    const toggleSale = (id: string) =>
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    const set = (key: keyof typeof form) => (value: string) => setForm(prev => ({ ...prev, [key]: value }))

    const handleSubmit = async () => {
        if (selected.length === 0) return toast.error('Pilih minimal 1 nota')
        if (transport < 0 || commission < 0 || rate < 0) return toast.error('Biaya tidak boleh negatif')
        if (commission > 0 && totalKg <= 0 && !commissionEdited) return toast.error('Total kg nota yang dipilih masih 0')

        const payload = {
            saleIds: selected,
            shipmentDate: form.shipmentDate || undefined,
            driverName: form.driverName.trim(),
            crewNames: form.crewNames,
            origin: form.origin,
            destination: form.destination,
            durationHours: form.durationHours === '' ? null : num(form.durationHours),
            operationalCost: transport,
            commissionRatePerKg: rate,
            commissionAmount: commission,
            commissionRecipient: form.commissionRecipient,
            notes: form.notes,
        }

        try {
            setSaving(true)
            const res = isEdit
                ? await shipmentsAPI.update(shipment!.id, payload)
                : await shipmentsAPI.create(payload)
            toast.success(isEdit ? 'Pengiriman diperbarui' : 'Pengiriman disimpan, biaya dikirim ke Keuangan')
            onSaved(res.data)
        } catch (err) {
            toast.error(getCleanErrorMessage(err) || 'Gagal menyimpan pengiriman')
        } finally {
            setSaving(false)
        }
    }

    const footer = (
        <>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-700 bg-stone-100 hover:bg-stone-300 rounded-lg transition-colors">
                Batal
            </button>
            <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || selected.length === 0}
                className="px-5 py-2 text-sm font-medium bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {isEdit ? 'Simpan Perubahan' : 'Simpan Pengiriman'}
            </button>
        </>
    )

    const label = 'block text-sm font-medium text-stone-700 mb-1'

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Ubah Pengiriman' : 'Pengiriman Baru (1 Mobil)'} size="xl" footer={footer}>
            <div className="space-y-5">
                {/* Nota */}
                <section>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <h4 className="text-sm font-semibold text-stone-900">Nota dalam mobil ini <span className="text-red-500">*</span></h4>
                            <p className="text-xs text-stone-500">Centang semua nota yang diangkut. Bisa 1 nota (beberapa harga) atau beberapa nota.</p>
                        </div>
                        <div className="text-right text-sm">
                            <div className="text-stone-500 text-xs">Total muatan</div>
                            <div className="font-semibold text-stone-900">{kg(totalKg)}</div>
                        </div>
                    </div>
                    <div className="border border-stone-300 rounded-lg max-h-56 overflow-y-auto bg-stone-100 divide-y divide-stone-300/60">
                        {loadingSales ? (
                            <div className="p-4 text-sm text-stone-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Memuat nota…</div>
                        ) : available.length === 0 ? (
                            <div className="p-4 text-sm text-stone-500">Tidak ada nota yang bisa dipilih (semua nota sudah masuk pengiriman lain).</div>
                        ) : available.map(s => (
                            <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-stone-200">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(s.id)}
                                    onChange={() => toggleSale(s.id)}
                                    className="h-4 w-4 accent-brand-light-green"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-stone-900 truncate">
                                        {s.sale_no} <span className="text-stone-500 font-normal">· {s.customer_name || 'Pelanggan Umum'}</span>
                                    </div>
                                    <div className="text-xs text-stone-500">{formatDate(s.sale_date)} · {s.status}</div>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <div className="font-mono text-stone-900">{kg(num(s.total_kg))}</div>
                                    <div className="text-xs text-stone-500">{rp(num(s.total_amount))}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </section>

                {/* Supir & rute */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={label}>Tanggal Kirim</label>
                        <Input type="date" value={form.shipmentDate} onChange={e => set('shipmentDate')(e.target.value)} />
                    </div>
                    <div>
                        <label className={label}>Nama Supir</label>
                        <Input value={form.driverName} onChange={e => set('driverName')(e.target.value)} placeholder="Opsional" />
                    </div>
                    <div>
                        <label className={label}>Kru / Kuli</label>
                        <Input value={form.crewNames} onChange={e => set('crewNames')(e.target.value)} placeholder="Misal: Ujang, Asep" />
                    </div>
                    <div>
                        <label className={label}>Durasi (jam)</label>
                        <NumberInput ui  min="0" step="0.5" value={form.durationHours} onChange={e => set('durationHours')(e.target.value)} placeholder="Contoh: 3" />
                    </div>
                    <div>
                        <label className={label}>Asal</label>
                        <Input value={form.origin} onChange={e => set('origin')(e.target.value)} placeholder="Lokasi muat" />
                    </div>
                    <div>
                        <label className={label}>Tujuan</label>
                        <Input value={form.destination} onChange={e => set('destination')(e.target.value)} placeholder="Lokasi bongkar" />
                    </div>
                </section>

                {/* Biaya */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-stone-300 bg-stone-100 p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2"><Truck size={16} className="text-brand-light-green" /> Biaya Transport</h4>
                        <div>
                            <label className={label}>Total biaya mobil (Rp)</label>
                            <CurrencyInput value={form.operationalCost} onChange={set('operationalCost')} placeholder="Contoh: 1.000.000" disabled={transportLocked} />
                            {transportLocked
                                ? <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><Lock size={12} /> Sudah disetujui Keuangan, tidak bisa diubah.</p>
                                : <p className="text-xs text-stone-500 mt-1">Dikirim ke Keuangan sebagai Beban Logistik. Boleh 0.</p>}
                        </div>
                    </div>

                    <div className="rounded-xl border border-stone-300 bg-stone-100 p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-stone-900">Komisi Calo (per tonase)</h4>
                        <div>
                            <label className={label}>Nama calo</label>
                            <Input value={form.commissionRecipient} onChange={e => set('commissionRecipient')(e.target.value)} placeholder="Opsional" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={label}>Tarif per kg (Rp)</label>
                                <CurrencyInput value={form.commissionRatePerKg} onChange={set('commissionRatePerKg')} placeholder="Contoh: 65" disabled={commissionLocked} />
                            </div>
                            <div>
                                <label className={label}>Total komisi (Rp)</label>
                                <CurrencyInput
                                    value={commissionEdited ? form.commissionAmount : (autoCommission > 0 ? String(autoCommission) : '')}
                                    onChange={v => { setCommissionEdited(true); set('commissionAmount')(v) }}
                                    placeholder="Otomatis"
                                    disabled={commissionLocked}
                                />
                            </div>
                        </div>
                        {commissionLocked ? (
                            <p className="text-xs text-amber-600 flex items-center gap-1"><Lock size={12} /> Sudah disetujui Keuangan, tidak bisa diubah.</p>
                        ) : (
                            <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                                <span>{kg(totalKg)} × {rp(rate)} = <span className="font-mono text-stone-700">{rp(autoCommission)}</span></span>
                                {commissionEdited && (
                                    <button type="button" onClick={() => { setCommissionEdited(false); set('commissionAmount')('') }} className="inline-flex items-center gap-1 text-brand-light-green hover:underline">
                                        <RotateCcw size={12} /> Pakai hitungan
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Alokasi per nota */}
                {selectedSales.length > 0 && (transport > 0 || commission > 0) && (
                    <section>
                        <h4 className="text-sm font-semibold text-stone-900 mb-1">Alokasi biaya per nota (proporsional kg)</h4>
                        <p className="text-xs text-stone-500 mb-2">Hanya untuk melihat laba per nota. Nota tetap ditagih penuh ke customer.</p>
                        <div className="overflow-x-auto border border-stone-300 rounded-lg">
                            <table className="w-full text-sm min-w-[480px]">
                                <thead className="bg-stone-300/50 text-stone-600 text-xs">
                                    <tr>
                                        <th className="text-left px-3 py-2">Nota</th>
                                        <th className="text-right px-3 py-2">Kg</th>
                                        <th className="text-right px-3 py-2">Transport</th>
                                        <th className="text-right px-3 py-2">Komisi</th>
                                        <th className="text-right px-3 py-2">Nilai Nota</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-300/60">
                                    {selectedSales.map(s => {
                                        const share = totalKg > 0 ? num(s.total_kg) / totalKg : 1 / selectedSales.length
                                        return (
                                            <tr key={s.id}>
                                                <td className="px-3 py-2 text-stone-900">{s.sale_no}</td>
                                                <td className="px-3 py-2 text-right font-mono">{num(s.total_kg).toLocaleString('id-ID')}</td>
                                                <td className="px-3 py-2 text-right font-mono text-red-600">{rp(transport * share)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-red-600">{rp(commission * share)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{rp(num(s.total_amount))}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <div>
                    <label className={label}>Catatan</label>
                    <Input value={form.notes} onChange={e => set('notes')(e.target.value)} placeholder="Opsional" />
                </div>

                <div className="rounded-lg bg-stone-100 border border-stone-300 px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                    <span>Transport: <b className="font-mono">{rp(transport)}</b></span>
                    <span>Komisi calo: <b className="font-mono">{rp(commission)}</b></span>
                    <span>Total keluar: <b className="font-mono text-red-600">{rp(transport + commission)}</b></span>
                </div>
            </div>
        </Modal>
    )
}
