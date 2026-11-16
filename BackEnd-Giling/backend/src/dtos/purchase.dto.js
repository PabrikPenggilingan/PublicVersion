class CreatePurchaseCommand {
  constructor(batchId, userId, payload) {
    this.batchId = batchId;
    this.userId = userId;
    this.purchaseDto = new PurchasePayloadDTO(payload);
  }
}

class UpdatePurchaseCommand {
  constructor(id, userId, payload) {
    this.id = id;
    this.userId = userId;
    this.purchaseDto = new PurchasePayloadDTO(payload);
  }
}

class PurchasePayloadDTO {
  constructor(data) {
    this.nama = data.nama;
    this.tanggalBelanja = data.tanggalBelanja;
    this.calo = data.calo;
    this.hargaPerKg = data.hargaPerKg;
    this.totalHarga = data.totalHarga;
    this.totalDibayar = data.totalDibayar;
    this.lokasiBelanja = data.lokasiBelanja;
    this.koordinat = data.koordinat;
    this.beratGabahKg = data.beratGabahKg;
    this.kualitasGabah = data.kualitasGabah;
    this.adminNotes = data.adminNotes;
    
    // Additional fields for pendataan_gabah
    this.jenisGabah = data.jenisGabah;
    this.varietas = data.varietas;
    this.kondisiGabah = data.kondisiGabah;
    this.kadarAir = data.kadarAir;
    this.kadarHampa = data.kadarHampa;
  }
}

class PurchaseResponseDTO {
  constructor(purchaseDbRecord) {
    this.id = purchaseDbRecord.id;
    this.batch_id = purchaseDbRecord.batch_id;
    this.nama = purchaseDbRecord.nama;
    this.tanggal_belanja = purchaseDbRecord.tanggal_belanja;
    this.calo = purchaseDbRecord.calo;
    this.harga_per_kg = purchaseDbRecord.harga_per_kg;
    this.total_harga = purchaseDbRecord.total_harga;
    this.total_dibayar = purchaseDbRecord.total_dibayar;
    this.lokasi_belanja = purchaseDbRecord.lokasi_belanja;
    this.koordinat = purchaseDbRecord.koordinat;
    this.berat_gabah_kg = purchaseDbRecord.berat_gabah_kg;
    this.kualitas_gabah = purchaseDbRecord.kualitas_gabah;
    this.admin_notes = purchaseDbRecord.admin_notes;
    this.filled_by = purchaseDbRecord.filled_by;
    this.created_at = purchaseDbRecord.created_at;
    this.updated_at = purchaseDbRecord.updated_at;
    this.payment_status = purchaseDbRecord.payment_status;
    if (purchaseDbRecord.photo_count !== undefined) {
      this.photo_count = parseInt(purchaseDbRecord.photo_count);
    }
    // Stored file paths of the entry's photos (shown in "Lihat Semua Foto")
    if (Array.isArray(purchaseDbRecord.photos)) {
      this.photos = purchaseDbRecord.photos;
    }
  }
}

module.exports = {
  CreatePurchaseCommand,
  UpdatePurchaseCommand,
  PurchasePayloadDTO,
  PurchaseResponseDTO
};
