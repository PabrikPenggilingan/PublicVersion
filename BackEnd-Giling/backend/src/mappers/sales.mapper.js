const {
    SalesBerasResponseDTO,
    SalesSimplifiedResponseDTO,
    ProcessSalesResponseDTO
} = require('../dtos/sales.dto');

class SalesMapper {
    static toBerasPersistence(command) {
        return {
            process_id: command.processId,
            nama: command.nama,
            tanggal_jual: command.tanggalJual || null,
            calo: command.calo,
            harga_jual_per_kg: command.hargaJualPerKg,
            harga_jual_total: command.hargaJualTotal || null,
            jual_kemana: command.jualKemana || null,
            tonase: command.tonase,
            rendemen: command.rendemen,
            hasil_akhir: command.hasilAkhir,
            derajat_sosoh: command.derajatSosoh || null,
            butir_patah: command.butirPatah || null,
            butir_kepala: command.butirKepala || null,
            kadar_air: command.kadarAir || null,
            benda_asing: command.bendaAsing || null
        };
    }

    static toSimplifiedPersistence(command) {
        return {
            process_id: command.processId,
            nama: command.nama,
            tanggal_jual: command.tanggalJual || null,
            tonase: command.tonase,
            harga_per_kg: command.hargaPerKg,
            harga_total: command.hargaTotal || null
        };
    }

    static toBerasResponse(data) {
        if (!data) return null;
        return new SalesBerasResponseDTO(data);
    }

    static toSimplifiedResponse(data) {
        if (!data) return null;
        return new SalesSimplifiedResponseDTO(data);
    }

    static toProcessSalesResponse(data) {
        if (!data) return null;
        return new ProcessSalesResponseDTO(data);
    }
}

module.exports = SalesMapper;
