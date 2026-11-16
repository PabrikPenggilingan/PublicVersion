import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const generateSalesReceiptPDF = (sale: any) => {
    const doc = new jsPDF();
    
    // Configs
    const MARGIN = 15;
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    let yPos = MARGIN;

    // --- HEADER ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PABRIK PENGGILINGAN PADI', MARGIN, yPos);
    
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Jl. Raya Penggilingan No. 123, Kabupaten/Kota', MARGIN, yPos);
    
    yPos += 5;
    doc.text('Telp: (021) 1234567 | Email: info@pabrikpadi.com', MARGIN, yPos);
    
    // Invoice Title
    yPos += 15;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA PENJUALAN', PAGE_WIDTH / 2, yPos, { align: 'center' });
    
    yPos += 12;

    // --- SALE INFO & CUSTOMER ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const leftColX = MARGIN;
    const rightColX = PAGE_WIDTH / 2 + 10;
    
    // Left: Sale Details
    doc.text(`No. Nota: ${sale.sale_no || '-'}`, leftColX, yPos);
    doc.text(`Tanggal: ${sale.sale_date ? format(new Date(sale.sale_date), 'dd MMMM yyyy', { locale: id }) : '-'}`, leftColX, yPos + 6);
    
    // Right: Customer Details
    doc.text(`Kepada Yth:`, rightColX, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sale.customer_name || 'Pelanggan Umum'}`, rightColX, yPos + 6);
    doc.setFont('helvetica', 'normal');

    yPos += 16;

    // --- ITEMS TABLE ---
    const tableColumn = ["No", "Produk", "Harga Unit", "Qty", "Subtotal"];
    const tableRows: any[] = [];

    let netSubtotal = 0;
    let biayaTambahan = 0;

    if (sale.returns) {
        biayaTambahan = sale.returns
            .filter((r: any) => !r.sale_item_id) // Biaya tambahan
            .reduce((sum: number, r: any) => sum + Number(r.amount_adjusted || 0), 0);
    }

    if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item: any, index: number) => {
            const price = parseFloat(item.unit_price);
            const originalQty = parseFloat(item.qty_ordered);
            const originalSubtotal = originalQty * price;
            const unit = item.unit_type === 'SACK' ? 'Karung' : 'Kg';
            
            netSubtotal += originalSubtotal;
            
            tableRows.push([
                (index + 1).toString(),
                item.item_name,
                `Rp ${price.toLocaleString('id-ID')}`,
                `${originalQty.toLocaleString('id-ID')} ${unit}`,
                `Rp ${originalSubtotal.toLocaleString('id-ID')}`
            ]);

        });
    }

    // @ts-ignore
    autoTable(doc, {
        startY: yPos,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 10 },
            2: { halign: 'right' },
            3: { halign: 'center' },
            4: { halign: 'right' },
        },
    });

    // @ts-ignore
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // --- SUMMARY ---
    const summaryX = PAGE_WIDTH - MARGIN - 60;
    const valueX = PAGE_WIDTH - MARGIN;

    // We use the backend's exact calculation to guarantee it matches the Sales Detail UI perfectly
    const apiSubtotal = parseFloat(sale.subtotal?.toString() || netSubtotal.toString());
    const apiAdjustment = parseFloat(sale.adjustment?.toString() || biayaTambahan.toString());
    const total = parseFloat(sale.total_amount?.toString() || (netSubtotal + biayaTambahan).toString());
    const paid = parseFloat(sale.paid_amount?.toString() || '0');
    const outstanding = parseFloat(sale.outstanding?.toString() || (total - paid).toString());

    doc.setFontSize(10);
    
    // Subtotal
    doc.text('Subtotal Produk:', summaryX, yPos);
    doc.text(`Rp ${apiSubtotal.toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });
    
    // Adjustment / Retur
    if (apiAdjustment !== 0) {
        yPos += 6;
        doc.text('Adjustment / Retur:', summaryX, yPos);
        doc.text(`${apiAdjustment < 0 ? '-' : ''}Rp ${Math.abs(apiAdjustment).toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });
    }

    // Total Akhir
    yPos += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AKHIR:', summaryX, yPos);
    doc.text(`Rp ${total.toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });

    // Payment Info
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sudah Dibayar:', summaryX, yPos);
    doc.text(`Rp ${paid.toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });

    // Potongan customer (kuli bongkar, dll) — settles part of the nota, not a change to it
    const deduction = parseFloat(sale.customer_deduction?.toString() || '0') || 0;
    if (deduction > 0) {
        yPos += 6;
        doc.text(`Potongan${sale.deduction_note ? ` (${sale.deduction_note})` : ''}:`, summaryX, yPos);
        doc.text(`Rp ${deduction.toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });
    }

    // Outstanding
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    if (outstanding < 0) {
        doc.text('Retur Produk:', summaryX, yPos);
        doc.text(`Rp ${Math.abs(outstanding).toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });
    } else {
        doc.text('Sisa Tagihan:', summaryX, yPos);
        doc.text(`Rp ${outstanding.toLocaleString('id-ID')}`, valueX, yPos, { align: 'right' });
    }

    // --- FOOTER & SIGNATURE ---
    yPos += 30;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Notes
    if (sale.notes) {
        doc.text('Catatan:', MARGIN, yPos);
        doc.text(sale.notes, MARGIN, yPos + 5, { maxWidth: PAGE_WIDTH / 2 });
    }

    // Signatures
    const sigY = yPos;
    doc.text('Penerima,', MARGIN + 20, sigY, { align: 'center' });
    doc.text('( ___________________ )', MARGIN + 20, sigY + 25, { align: 'center' });

    doc.text('Hormat Kami,', PAGE_WIDTH - MARGIN - 20, sigY, { align: 'center' });
    doc.text('( ___________________ )', PAGE_WIDTH - MARGIN - 20, sigY + 25, { align: 'center' });

    // Open PDF in new tab
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
};
