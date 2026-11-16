class SalesV2Mapper {
    static toCustomerPersistence(command) {
        return {
            name: command.name,
            phone: command.phone,
            address: command.address,
            tierId: command.tierId,
            notes: command.notes,
            isActive: command.isActive,
            createdBy: command.userId
        };
    }

    static toSalePersistence(command) {
        return {
            customerId: command.customerId,
            saleDate: command.saleDate,
            dueDate: command.dueDate,
            notes: command.notes,
            items: command.items,
            createdBy: command.userId
        };
    }

    static toPriceTierPersistence(command) {
        return {
            name: command.name,
            sort_order: command.sortOrder
        };
    }

    static toPricePersistence(command) {
        return {
            tierId: command.tierId,
            categoryId: command.categoryId,
            pricePerKg: command.pricePerKg,
            pricePerSack: command.pricePerSack,
            createdBy: command.userId
        };
    }

    static toDeliveryHeaderPersistence(command) {
        return {
            deliveryDate: command.deliveryDate,
            notes: command.notes
        };
    }

    static toPaymentPersistence(command) {
        return {
            amount: command.amount,
            paymentDate: command.paymentDate,
            method: command.paymentMethod,
            referenceNo: command.referenceNo,
            notes: command.notes,
            buktiNotaPath: command.buktiNotaPath || null
        };
    }

    static toResponse(data) {
        return data;
    }
}

module.exports = SalesV2Mapper;
