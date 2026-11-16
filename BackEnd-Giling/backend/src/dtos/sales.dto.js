class CreateBerasSaleCommand {
    constructor(processId, data) {
        this.processId = processId;
        this.nama = data.nama;
        this.tanggalJual = data.tanggalJual;
        this.calo = data.calo;
        this.hargaJualPerKg = data.hargaJualPerKg;
        this.hargaJualTotal = data.hargaJualTotal;
        this.jualKemana = data.jualKemana;
        this.tonase = data.tonase;
        this.rendemen = data.rendemen;
        this.hasilAkhir = data.hasilAkhir;
        this.derajatSosoh = data.derajatSosoh;
        this.butirPatah = data.butirPatah;
        this.butirKepala = data.butirKepala;
        this.kadarAir = data.kadarAir;
        this.bendaAsing = data.bendaAsing;
    }
}

class UpdateBerasSaleCommand {
    constructor(id, data) {
        this.id = id;
        this.nama = data.nama;
        this.tanggalJual = data.tanggalJual;
        this.calo = data.calo;
        this.hargaJualPerKg = data.hargaJualPerKg;
        this.hargaJualTotal = data.hargaJualTotal;
        this.jualKemana = data.jualKemana;
        this.tonase = data.tonase;
        this.rendemen = data.rendemen;
        this.hasilAkhir = data.hasilAkhir;
        this.derajatSosoh = data.derajatSosoh;
        this.butirPatah = data.butirPatah;
        this.butirKepala = data.butirKepala;
        this.kadarAir = data.kadarAir;
        this.bendaAsing = data.bendaAsing;
    }
}

class CreateSimplifiedSaleCommand {
    constructor(processId, type, data) {
        this.processId = processId;
        this.type = type;
        this.nama = data.nama;
        this.tanggalJual = data.tanggalJual;
        this.tonase = data.tonase;
        this.hargaPerKg = data.hargaPerKg;
        this.hargaTotal = data.hargaTotal;
    }
}

class UpdateSimplifiedSaleCommand {
    constructor(type, id, data) {
        this.type = type;
        this.id = id;
        this.nama = data.nama;
        this.tanggalJual = data.tanggalJual;
        this.tonase = data.tonase;
        this.hargaPerKg = data.hargaPerKg;
        this.hargaTotal = data.hargaTotal;
    }
}

class SalesBerasResponseDTO {
    constructor(data) {
        this.id = data.id;
        this.processId = data.process_id;
        this.nama = data.nama;
        this.tanggalJual = data.tanggal_jual;
        this.calo = data.calo;
        this.hargaJualPerKg = data.harga_jual_per_kg;
        this.hargaJualTotal = data.harga_jual_total;
        this.jualKemana = data.jual_kemana;
        this.tonase = data.tonase;
        this.rendemen = data.rendemen;
        this.hasilAkhir = data.hasil_akhir;
        this.derajatSosoh = data.derajat_sosoh;
        this.butirPatah = data.butir_patah;
        this.butirKepala = data.butir_kepala;
        this.kadarAir = data.kadar_air;
        this.bendaAsing = data.benda_asing;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }
}

class SalesSimplifiedResponseDTO {
    constructor(data) {
        this.id = data.id;
        this.processId = data.process_id;
        this.nama = data.nama;
        this.tanggalJual = data.tanggal_jual;
        this.tonase = data.tonase;
        this.hargaPerKg = data.harga_per_kg;
        this.hargaTotal = data.harga_total;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }
}

class ProcessSalesResponseDTO {
    constructor(data) {
        this.beras = (data.beras || []).map(b => new SalesBerasResponseDTO(b));
        this.dedak = (data.dedak || []).map(s => new SalesSimplifiedResponseDTO(s));
        this.sekam = (data.sekam || []).map(s => new SalesSimplifiedResponseDTO(s));
        this.menir = (data.menir || []).map(s => new SalesSimplifiedResponseDTO(s));
        this.broken = (data.broken || []).map(s => new SalesSimplifiedResponseDTO(s));
    }
}

module.exports = {
    CreateBerasSaleCommand,
    UpdateBerasSaleCommand,
    CreateSimplifiedSaleCommand,
    UpdateSimplifiedSaleCommand,
    SalesBerasResponseDTO,
    SalesSimplifiedResponseDTO,
    ProcessSalesResponseDTO
};
