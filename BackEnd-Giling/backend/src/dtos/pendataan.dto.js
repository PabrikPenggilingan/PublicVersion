class CreatePendataanCommand {
    constructor(userId, data) {
        this.purchaseId = data.purchaseId;
        this.jenisGabah = data.jenisGabah;
        this.varietas = data.varietas;
        this.kondisiGabah = data.kondisiGabah;
        this.kadarAir = data.kadarAir;
        this.kadarHampa = data.kadarHampa;
        this.butirRusak = data.butirRusak;
        this.bendaAsing = data.bendaAsing;
        this.notes = data.notes;
        this.createdBy = userId;
    }
}

class UpdatePendataanCommand {
    constructor(id, data) {
        this.id = id;
        this.data = {
            jenisGabah: data.jenisGabah,
            varietas: data.varietas,
            kondisiGabah: data.kondisiGabah,
            kadarAir: data.kadarAir,
            kadarHampa: data.kadarHampa,
            butirRusak: data.butirRusak,
            bendaAsing: data.bendaAsing,
            notes: data.notes
        };
    }
}

module.exports = {
    CreatePendataanCommand,
    UpdatePendataanCommand
};
