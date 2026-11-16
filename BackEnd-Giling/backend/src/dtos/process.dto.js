class StartProcessCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.inventoryItemId = data.inventoryItemId;
        this.gabahReservedKg = data.gabahReservedKg;
        this.processDate = data.processDate;
        this.notes = data.notes;
    }
}

class UpdateProcessCommand {
    constructor(id, data) {
        this.id = id;
        this.data = data; // Usually passes through partial updates
    }
}

class CancelProcessCommand {
    constructor(id, userId, reason) {
        this.id = id;
        this.userId = userId;
        this.reason = reason;
    }
}

class CompleteProcessCommand {
    constructor(id, userId, data) {
        this.id = id;
        this.userId = userId;
        this.outputs = data.outputs;
        this.notes = data.notes;
        this.sekamKg = data.sekam_kg;
        this.sekamNotes = data.sekam_notes;
        this.wasteKg = data.waste_kg;
        this.wasteReason = data.waste_reason;
    }
}

class AttachBatchCommand {
    constructor(processId, data) {
        this.processId = processId;
        this.batchId = data.batchId;
        this.qtyUsedKg = data.qtyUsedKg;
    }
}

class AddProcessCostCommand {
    constructor(processId, userId, data) {
        this.processId = processId;
        this.userId = userId;
        this.costData = data;
    }
}

module.exports = {
    StartProcessCommand,
    UpdateProcessCommand,
    CancelProcessCommand,
    CompleteProcessCommand,
    AttachBatchCommand,
    AddProcessCostCommand
};
