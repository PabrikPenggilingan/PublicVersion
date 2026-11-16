class SubmitFormPurchaseCommand {
    constructor(linkCode, userId, data, files) {
        this.linkCode = linkCode;
        this.userId = userId;
        this.calo = data.calo;
        this.lokasiBelanja = data.lokasiBelanja;
        this.koordinat = data.koordinat;
        this.hargaPerKg = data.hargaPerKg;
        this.beratGabahKg = data.beratGabahKg;
        this.totalDibayar = data.totalDibayar;
        this.kualitasGabah = data.kualitasGabah;
        this.kadarAir = data.kadarAir;
        this.kadarHampa = data.kadarHampa;
        this.kondisiGabah = data.kondisiGabah;
        this.jenisGabah = data.jenisGabah;
        this.driverName = data.driverName;
        this.crewNames = data.crewNames;
        this.origin = data.origin;
        this.destination = data.destination;
        this.operationalCost = data.operationalCost;
        this.durationHours = data.durationHours;
        this.files = files;
    }
}

class CompleteFormBatchCommand {
    constructor(linkCode, userId, data, files) {
        this.linkCode = linkCode;
        this.userId = userId;
        this.files = files;
        this.driverName = data.driverName;
        this.crewNames = data.crewNames;
        this.origin = data.origin;
        this.destination = data.destination;
        this.operationalCost = data.operationalCost;
        this.durationHours = data.durationHours;
    }
}

class UpdateFormPurchaseCommand {
    constructor(linkCode, purchaseId, userId, data) {
        this.linkCode = linkCode;
        this.purchaseId = purchaseId;
        this.userId = userId;
        this.data = data;
    }
}

module.exports = {
    SubmitFormPurchaseCommand,
    CompleteFormBatchCommand,
    UpdateFormPurchaseCommand
};
