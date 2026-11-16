class FinanceMapper {
    static toOverheadPersistence(command) {
        return {
            accountId: command.accountId,
            amount: command.amount,
            category: command.category,
            description: command.description,
            transactionDate: command.transactionDate,
            createdBy: command.userId
        };
    }

    static toPurchasePaymentPersistence(command) {
        return {
            purchaseId: command.purchaseId,
            accountId: command.accountId,
            amount: command.amount,
            paymentMethod: command.paymentMethod,
            referenceNo: command.referenceNo,
            notes: command.notes,
            paymentDate: command.paymentDate,
            createdBy: command.userId
        };
    }

    static toCaloPayoutPersistence(command) {
        return {
            caloId: command.caloId,
            accountId: command.accountId,
            amount: command.amount,
            description: command.description,
            payoutDate: command.payoutDate,
            createdBy: command.userId
        };
    }

    static toResponse(data) {
        return data;
    }
}

module.exports = FinanceMapper;
