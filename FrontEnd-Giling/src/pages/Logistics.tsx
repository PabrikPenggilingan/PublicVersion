import toast from 'react-hot-toast'
import { useTableCards } from '@/utils/useTableCards'
import { NumberInput } from '@/components/ui/NumberInput'
import { getCleanErrorMessage } from '@/errors'
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { logisticsAPI, shipmentsAPI, type LogisticsTask, type SaleShipment } from '@/api/client';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { confirmDialog } from '@/utils/confirmDialog';
import SaleShipmentModal from '@/components/SaleShipmentModal';

const journalBadge = (status?: string | null) => {
    if (!status) return null;
    const map: Record<string, string> = {
        PENDING: 'bg-amber-500/15 text-amber-700',
        APPROVED: 'bg-brand-light-green/20 text-brand-light-green',
        REJECTED: 'bg-red-500/15 text-red-600',
    };
    const label: Record<string, string> = { PENDING: 'Menunggu Keuangan', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
    return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${map[status] || ''}`}>{label[status] || status}</span>;
};

const Logistics = () => {
    const tableCardsRef = useTableCards()
    const tableCardsRef2 = useTableCards()

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'PURCHASE' | 'SALE'>(searchParams.get('tab') === 'SALE' ? 'SALE' : 'PURCHASE');
    const [tasks, setTasks] = useState<LogisticsTask[]>([]);
    const [shipments, setShipments] = useState<SaleShipment[]>([]);
    const [shipmentModal, setShipmentModal] = useState<{ open: boolean; shipment: SaleShipment | null; preselectSaleId?: string }>({ open: false, shipment: null });
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form States
    const [availableRefs, setAvailableRefs] = useState<{id: string, name: string, date: string}[]>([]);
    const [formData, setFormData] = useState({
        referenceId: '',
        driverName: '',
        crewNames: '',
        origin: '',
        destination: '',
        durationHours: '',
        operationalCost: ''
    });

    useEffect(() => {
        loadTasks();
    }, [activeTab]);

    // Deep links from a nota: /logistics?tab=SALE&newSale=<saleId> or &shipment=<shipmentId>
    useEffect(() => {
        const newSale = searchParams.get('newSale');
        const shipmentId = searchParams.get('shipment');
        if (!newSale && !shipmentId) return;
        setActiveTab('SALE');
        if (newSale) {
            setShipmentModal({ open: true, shipment: null, preselectSaleId: newSale });
        } else if (shipmentId) {
            shipmentsAPI.getById(shipmentId)
                .then(res => setShipmentModal({ open: true, shipment: res.data }))
                .catch(err => toast.error(getCleanErrorMessage(err) || 'Pengiriman tidak ditemukan'));
        }
        setSearchParams({ tab: 'SALE' }, { replace: true });
    }, [searchParams]);

    const closeShipmentModal = () => setShipmentModal({ open: false, shipment: null });

    const handleDeleteShipment = async (s: SaleShipment) => {
        if (!await confirmDialog(`Hapus pengiriman ${s.reference_name || ''}? Permintaan biaya yang belum disetujui Keuangan ikut dihapus.`)) return;
        try {
            await shipmentsAPI.delete(s.id);
            toast.success('Pengiriman dihapus');
            loadTasks();
        } catch (error) {
            toast.error(getCleanErrorMessage(error) || 'Gagal menghapus pengiriman');
        }
    };

    const loadTasks = async () => {
        try {
            setIsLoading(true);
            if (activeTab === 'SALE') {
                const res = await shipmentsAPI.getAll();
                setShipments(res.data || []);
                return;
            }
            const res = await logisticsAPI.getAll({ referenceType: activeTab });
            if (res.success) {
                setTasks(res.data || []);
            }
        } catch (error) {
            console.error('Failed to load logistics tasks:', error);
            toast.error('Gagal memuat data logistik');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = async () => {
        if (activeTab === 'SALE') {
            setShipmentModal({ open: true, shipment: null });
            return;
        }
        try {
            const res = await logisticsAPI.getAvailableReferences(activeTab);
            if (res.success) {
                setAvailableRefs(res.data || []);
                setFormData({
                    referenceId: '',
                    driverName: '',
                    crewNames: '',
                    origin: '',
                    destination: '',
                    durationHours: '',
                    operationalCost: ''
                });
                setIsModalOpen(true);
            }
        } catch (error) {
            console.error('Failed to load references:', error);
            toast.error('Gagal memuat data referensi transaksi');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await logisticsAPI.create({
                referenceType: activeTab,
                referenceId: formData.referenceId,
                driverName: formData.driverName,
                crewNames: formData.crewNames,
                origin: formData.origin,
                destination: formData.destination,
                durationHours: formData.durationHours ? parseFloat(formData.durationHours) : undefined,
                operationalCost: formData.operationalCost ? parseFloat(formData.operationalCost) : undefined
            });
            toast.success('Data logistik berhasil disimpan! Biaya telah dipotong dari Kas Pabrik.');
            setIsModalOpen(false);
            loadTasks();
        } catch (error: any) {
            toast.error(getCleanErrorMessage(error) || 'Gagal menyimpan data');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">Transport & Logistik</h1>
                    <p className="text-stone-500 text-sm mt-1">Pendataan operasional armada dan kru</p>
                </div>
                <button 
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-brand-light-green hover:bg-brand-light-green/80 text-white rounded-lg shadow-md transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {activeTab === 'PURCHASE' ? 'Tambah Logistik Belanja' : 'Pengiriman Baru'}
                </button>
            </div>

            {/* Floating Tabs */}
            <div className="flex justify-center mb-8">
                <div className="bg-stone-200 p-1 rounded-xl shadow-inner inline-flex">
                    <button
                        onClick={() => { setActiveTab('PURCHASE'); setSearchParams({}, { replace: true }); }}
                        className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'PURCHASE' 
                            ? 'bg-stone-100 text-brand-light-green shadow-sm' 
                            : 'text-stone-500 hover:text-stone-700:text-stone-300'
                        }`}
                    >
                        🚚 Jemput Gabah (Belanja)
                    </button>
                    <button
                        onClick={() => { setActiveTab('SALE'); setSearchParams({ tab: 'SALE' }, { replace: true }); }}
                        className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'SALE' 
                            ? 'bg-stone-100 text-blue-600 shadow-sm' 
                            : 'text-stone-500 hover:text-stone-700:text-stone-300'
                        }`}
                    >
                        📦 Antar Barang (Sales)
                    </button>
                </div>
            </div>

            {/* Sales: one row per truck (pengiriman), can carry several nota */}
            {activeTab === 'SALE' && (
            <div className="bg-stone-200 rounded-xl shadow-sm border border-stone-300 overflow-hidden">
                <div className="overflow-x-auto">
                    <table ref={tableCardsRef} className="table-cards w-full md:min-w-[900px] text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-300/50 border-b border-stone-300">
                                <th className="p-4 font-semibold text-stone-600 text-sm">Tgl Kirim</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm">Nota</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm">Supir & Rute</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-right">Muatan</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-right">Transport</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-right">Komisi Calo</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-stone-500">Memuat data...</td></tr>
                            ) : shipments.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-stone-500">Belum ada pengiriman. Klik &quot;Pengiriman Baru&quot; untuk mencatat 1 mobil beserta nota-notanya.</td></tr>
                            ) : shipments.map(s => (
                                <tr key={s.id} className="border-b border-stone-300/50 hover:bg-stone-300/50 transition-colors align-top">
                                    <td className="p-4 text-stone-800 whitespace-nowrap">{formatDate(s.shipment_date || s.reference_date || s.created_at)}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {(s.sales || []).length === 0 && <span className="text-stone-500 text-sm">-</span>}
                                            {(s.sales || []).map(n => (
                                                <Link key={n.id} to={`/sales/${n.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                                                    {n.sale_no} <span className="text-stone-500 font-normal">· {n.customer_name || 'Umum'} · {Number(n.total_kg).toLocaleString('id-ID')} kg</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-stone-900 font-medium">{s.driver_name || '-'}</div>
                                        <div className="text-stone-500 text-xs mt-0.5">{s.origin || '-'} → {s.destination || '-'}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-stone-900 whitespace-nowrap">{Number(s.total_kg).toLocaleString('id-ID')} kg</td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <div className="font-medium text-red-600">{formatCurrency(Number(s.operational_cost))}</div>
                                        <div className="mt-1">{journalBadge(s.transport_journal_status)}</div>
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <div className="font-medium text-red-600">{formatCurrency(Number(s.commission_amount))}</div>
                                        <div className="text-xs text-stone-500">{Number(s.commission_rate_per_kg) > 0 ? `Rp ${Number(s.commission_rate_per_kg).toLocaleString('id-ID')}/kg` : ''}{s.commission_recipient ? ` · ${s.commission_recipient}` : ''}</div>
                                        <div className="mt-1">{journalBadge(s.commission_journal_status)}</div>
                                    </td>
                                    <td className="p-4 text-center whitespace-nowrap">
                                        <button onClick={() => setShipmentModal({ open: true, shipment: s })} className="p-2 rounded-lg text-stone-600 hover:bg-stone-300 hover:text-stone-900" title="Ubah">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteShipment(s)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10" title="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            <SaleShipmentModal
                isOpen={shipmentModal.open}
                shipment={shipmentModal.shipment}
                preselectSaleId={shipmentModal.preselectSaleId}
                onClose={closeShipmentModal}
                onSaved={() => { closeShipmentModal(); loadTasks(); }}
            />

            {/* Data Table */}
            {activeTab === 'PURCHASE' && (
            <div className="bg-stone-200 rounded-xl shadow-sm border border-stone-300 overflow-hidden">
                <div className="overflow-x-auto">
                    <table ref={tableCardsRef2} className="table-cards w-full md:min-w-[700px] text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-300/50 border-b border-stone-300">
                                <th className="p-4 font-semibold text-stone-600 text-sm">Tgl Transaksi</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm">Referensi</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm">Supir & Kru</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm">Rute</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-right">Biaya (Rp)</th>
                                <th className="p-4 font-semibold text-stone-600 text-sm text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-stone-500">Memuat data...</td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-stone-500">Belum ada data logistik</td>
                                </tr>
                            ) : (
                                tasks.map((task) => (
                                    <tr key={task.id} className="border-b border-stone-300/50 hover:bg-stone-300/50:bg-stone-700/50 transition-colors">
                                        <td className="p-4 text-stone-800">{formatDate(task.reference_date || task.created_at)}</td>
                                        <td className="p-4 font-medium text-stone-900">
                                            {task.reference_name || '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-stone-900 font-medium">{task.driver_name || '-'}</div>
                                            <div className="text-stone-500 text-xs mt-0.5">{task.crew_names || 'Tanpa kru'}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-stone-800 text-sm">{task.origin || '-'} → {task.destination || '-'}</div>
                                            <div className="text-stone-500 text-xs mt-0.5">{task.duration_hours ? `${task.duration_hours} Jam` : '-'}</div>
                                        </td>
                                        <td className="p-4 text-right font-medium text-red-600">
                                            {formatCurrency(task.operational_cost)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-2.5 py-1 bg-brand-light-green/20 text-brand-light-green text-xs font-semibold rounded-full">
                                                {task.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Modal Form */}
            {isModalOpen && activeTab === 'PURCHASE' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-stone-900">
                                Form Logistik: {activeTab === 'PURCHASE' ? 'Ambil Gabah' : 'Antar Barang'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">
                                    Pilih Transaksi {activeTab === 'PURCHASE' ? 'Belanja' : 'Penjualan'} <span className="text-red-500">*</span>
                                </label>
                                <select 
                                    required
                                    value={formData.referenceId}
                                    onChange={(e) => setFormData({...formData, referenceId: e.target.value})}
                                    className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 focus:ring-2 focus:ring-brand-light-green outline-none transition-all"
                                >
                                    <option value="">-- Pilih Transaksi --</option>
                                    {availableRefs.map(ref => (
                                        <option key={ref.id} value={ref.id}>
                                            {formatDate(ref.date)} - {ref.name}
                                        </option>
                                    ))}
                                </select>
                                {availableRefs.length === 0 && (
                                    <p className="text-xs text-orange-500 mt-1">Tidak ada transaksi yang membutuhkan logistik saat ini.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Nama Supir <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" required
                                        value={formData.driverName}
                                        onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                        placeholder="Nama Supir"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Nama Kru/Kuli (Opsional)</label>
                                    <input 
                                        type="text"
                                        value={formData.crewNames}
                                        onChange={(e) => setFormData({...formData, crewNames: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                        placeholder="Misal: Ujang, Asep"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Titik Asal <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" required
                                        value={formData.origin}
                                        onChange={(e) => setFormData({...formData, origin: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                        placeholder="Lokasi Muat"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Titik Tujuan <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" required
                                        value={formData.destination}
                                        onChange={(e) => setFormData({...formData, destination: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                        placeholder="Lokasi Bongkar"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Biaya Operasional (Rp) <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-stone-500 sm:text-sm">Rp</span>
                                        </div>
                                        <NumberInput 
 required min="0"
                                            value={formData.operationalCost}
                                            onChange={(e) => setFormData({...formData, operationalCost: e.target.value})}
                                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                            placeholder="Contoh: 150000"
                                        />
                                    </div>
                                    <p className="text-xs text-stone-500 mt-1">Saldo Kas Pabrik akan terpotong otomatis</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Durasi Estimasi (Jam)</label>
                                    <NumberInput 
 step="0.5" min="0"
                                        value={formData.durationHours}
                                        onChange={(e) => setFormData({...formData, durationHours: e.target.value})}
                                        className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
                                        placeholder="Contoh: 2.5"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-stone-100 flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-700 bg-stone-100 hover:bg-stone-200:bg-stone-600 rounded-lg transition-colors">
                                    Batal
                                </button>
                                <button type="submit" disabled={!formData.referenceId || isSubmitting} className="px-6 py-2 bg-brand-light-green hover:bg-brand-light-green/80 disabled:bg-brand-light-green disabled:cursor-not-allowed text-stone-900 font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2">
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan & Catat Biaya'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Logistics;
