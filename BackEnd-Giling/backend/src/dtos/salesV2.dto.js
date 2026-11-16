class CreateCustomerCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.name = data.name;
        this.phone = data.phone;
        this.address = data.address;
        this.tierId = data.tierId;
        this.notes = data.notes;
    }
}

class UpdateCustomerCommand {
    constructor(id, data) {
        this.id = id;
        this.name = data.name;
        this.phone = data.phone;
        this.address = data.address;
        this.tierId = data.tierId;
        this.notes = data.notes;
        this.isActive = data.isActive;
    }
}

class CreatePriceTierCommand {
    constructor(data) {
        this.name = data.name;
        this.sortOrder = data.sortOrder;
    }
}

class CreatePriceCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.tierId = data.tierId;
        this.categoryId = data.categoryId;
        this.pricePerKg = data.pricePerKg;
        this.pricePerSack = data.pricePerSack;
    }
}

class CreateSaleCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.customerId = data.customerId;
        this.saleDate = data.saleDate;
        this.dueDate = data.dueDate;
        this.notes = data.notes;
        this.items = data.items;
    }
}

class AddSaleItemCommand {
    constructor(saleId, userId, data) {
        this.saleId = saleId;
        this.userId = userId;
        this.inventoryItemId = data.inventoryItemId;
        this.qtyOrdered = data.qtyOrdered;
        this.unitPrice = data.unitPrice;
    }
}

class CreateDeliveryCommand {
    constructor(saleId, userId, data) {
        this.saleId = saleId;
        this.userId = userId;
        this.deliveryDate = data.deliveryDate;
        this.notes = data.notes;
        this.items = data.items;
    }
}

class CreatePaymentCommand {
    constructor(saleId, userId, data, buktiNotaPath = null) {
        this.saleId = saleId;
        this.userId = userId;
        this.amount = data.amount;
        this.paymentDate = data.paymentDate;
        this.paymentMethod = data.paymentMethod;
        this.referenceNo = data.referenceNo;
        this.notes = data.notes;
        this.buktiNotaPath = buktiNotaPath;
    }
}

class CreateReturnCommand {
    constructor(saleId, userId, data) {
        this.saleId = saleId;
        this.userId = userId;
        this.reason = data.reason;
        this.returnType = data.returnType;
        this.items = data.items;
        this.biayaTambahan = data.biayaTambahan;
    }
}

module.exports = {
    CreateCustomerCommand,
    UpdateCustomerCommand,
    CreatePriceTierCommand,
    CreatePriceCommand,
    CreateSaleCommand,
    AddSaleItemCommand,
    CreateDeliveryCommand,
    CreatePaymentCommand,
    CreateReturnCommand
};
