class CreateBatchCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.batchDate = data.batchDate;
        this.status = data.status;
        this.jenisGabah = data.jenisGabah;
    }
}

class UpdateBatchCommand {
    constructor(id, data) {
        this.id = id;
        this.data = data;
    }
}

class CreateBatchPaymentCommand {
    constructor(batchId, userId, data, buktiNotaPath) {
        this.batchId = batchId;
        this.userId = userId;
        this.amount = data.amount;
        this.paymentDate = data.paymentDate;
        this.paymentMethod = data.paymentMethod;
        this.referenceNo = data.referenceNo;
        this.notes = data.notes;
        this.buktiNotaPath = buktiNotaPath;
    }
}

module.exports = {
    CreateBatchCommand,
    UpdateBatchCommand,
    CreateBatchPaymentCommand
};
