class CreateOverheadCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.accountId = data.accountId;
        this.amount = data.amount;
        this.category = data.category;
        this.description = data.description;
        this.transactionDate = data.transactionDate;
    }
}

class RecordPurchasePaymentCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.purchaseId = data.purchaseId;
        this.accountId = data.accountId;
        this.amount = data.amount;
        this.paymentMethod = data.paymentMethod;
        this.referenceNo = data.referenceNo;
        this.notes = data.notes;
        this.paymentDate = data.paymentDate;
    }
}

class RecordCaloPayoutCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.caloId = data.caloId; // Might be a string or ID depending on schema
        this.accountId = data.accountId;
        this.amount = data.amount;
        this.description = data.description;
        this.payoutDate = data.payoutDate;
    }
}

module.exports = {
    CreateOverheadCommand,
    RecordPurchasePaymentCommand,
    RecordCaloPayoutCommand
};
