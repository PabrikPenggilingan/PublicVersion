const { PurchaseResponseDTO } = require('../dtos/purchase.dto');

class PurchaseMapper {
  static toDatabaseCreate(command) {
    const { batchId, userId, purchaseDto } = command;
    return {
      batch_id: batchId,
      nama: purchaseDto.nama,
      tanggal_belanja: purchaseDto.tanggalBelanja,
      calo: purchaseDto.calo,
      harga_per_kg: purchaseDto.hargaPerKg,
      total_harga: purchaseDto.totalHarga,
      total_dibayar: purchaseDto.totalDibayar ?? null,
      lokasi_belanja: purchaseDto.lokasiBelanja,
      koordinat: purchaseDto.koordinat,
      berat_gabah_kg: purchaseDto.beratGabahKg,
      kualitas_gabah: purchaseDto.kualitasGabah,
      admin_notes: purchaseDto.adminNotes || null,
      filled_by: userId
    };
  }
  
  static toDatabaseUpdate(command) {
    const { purchaseDto } = command;
    
    const updateData = {};
    if (purchaseDto.nama !== undefined) updateData.nama = purchaseDto.nama;
    if (purchaseDto.tanggalBelanja !== undefined) updateData.tanggal_belanja = purchaseDto.tanggalBelanja;
    if (purchaseDto.calo !== undefined) updateData.calo = purchaseDto.calo;
    if (purchaseDto.hargaPerKg !== undefined) updateData.harga_per_kg = purchaseDto.hargaPerKg;
    if (purchaseDto.totalHarga !== undefined) updateData.total_harga = purchaseDto.totalHarga;
    if (purchaseDto.totalDibayar !== undefined) updateData.total_dibayar = purchaseDto.totalDibayar;
    if (purchaseDto.lokasiBelanja !== undefined) updateData.lokasi_belanja = purchaseDto.lokasiBelanja;
    if (purchaseDto.koordinat !== undefined) updateData.koordinat = purchaseDto.koordinat;
    if (purchaseDto.beratGabahKg !== undefined) updateData.berat_gabah_kg = purchaseDto.beratGabahKg;
    if (purchaseDto.kualitasGabah !== undefined) updateData.kualitas_gabah = purchaseDto.kualitasGabah;
    if (purchaseDto.adminNotes !== undefined) updateData.admin_notes = purchaseDto.adminNotes;
    
    return updateData;
  }

  static toResponse(dbRecord) {
    if (!dbRecord) return null;
    return new PurchaseResponseDTO(dbRecord);
  }

  static toResponseList(dbRecords) {
    return dbRecords.map(record => new PurchaseResponseDTO(record));
  }
}

module.exports = PurchaseMapper;
