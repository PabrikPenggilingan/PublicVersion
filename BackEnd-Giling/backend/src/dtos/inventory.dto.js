class CreateManualItemCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.sourceType = data.sourceType;
        this.batchId = data.batchId;
        this.dryingId = data.dryingId;
        this.area = data.area;
        this.tanda = data.tanda;
        this.kualitas = data.kualitas;
        this.avgPricePerKg = data.avgPricePerKg;
        this.weightKg = data.weightKg;
        this.productCategoryCode = data.productCategoryCode;
        this.notes = data.notes;
        this.titipanData = data.titipanData;
        this.sacks = data.sacks;
    }
}

class CreateFromDryingCommand {
    constructor(dryingId, userId, data) {
        this.dryingId = dryingId;
        this.userId = userId;
        this.area = data.area;
        this.tanda = data.tanda;
        this.kualitas = data.kualitas;
        this.notes = data.notes;
    }
}

class CreateFromBatchCommand {
    constructor(batchId, userId, data) {
        this.batchId = batchId;
        this.userId = userId;
        this.tonnageKg = data.tonnageKg;
        this.area = data.area;
        this.tanda = data.tanda;
        this.notes = data.notes;
    }
}

class UpdateInventoryItemCommand {
    constructor(id, userId, data) {
        this.id = id;
        this.userId = userId;
        this.area = data.area;
        this.tanda = data.tanda;
        this.notes = data.notes;
        this.kualitas = data.kualitas;
    }
}

class AddSacksCommand {
    constructor(itemId, userId, sacks) {
        this.itemId = itemId;
        this.userId = userId;
        this.sacks = sacks;
    }
}

class TakeSacksCommand {
    constructor(itemId, userId, data) {
        this.itemId = itemId;
        this.userId = userId;
        this.sackIds = data.sackIds;
        this.takenFor = data.takenFor;
        this.referenceId = data.referenceId;
    }
}

class TakeWeightCommand {
    constructor(itemId, userId, data) {
        this.itemId = itemId;
        this.userId = userId;
        this.weightKg = data.weightKg;
        this.takenFor = data.takenFor;
        this.referenceId = data.referenceId;
    }
}

module.exports = {
    CreateManualItemCommand,
    CreateFromDryingCommand,
    CreateFromBatchCommand,
    UpdateInventoryItemCommand,
    AddSacksCommand,
    TakeSacksCommand,
    TakeWeightCommand
};
