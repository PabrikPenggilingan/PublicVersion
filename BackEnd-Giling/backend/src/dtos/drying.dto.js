class CreateDryingCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.name = data.name;
        this.notes = data.notes;
        this.dryingType = data.dryingType;
        this.vendorName = data.vendorName;
        this.titipanInventoryId = data.titipanInventoryId;
        this.batchIds = data.batchIds;
    }
}

class UpdateDryingBatchesCommand {
    constructor(dryingId, data) {
        this.dryingId = dryingId;
        this.batchIds = data.batchIds;
    }
}

class CreateDryingLinkCommand {
    constructor(dryingId, data) {
        this.dryingId = dryingId;
        this.expiresAt = data.expiresAt;
    }
}

class ToggleDryingActiveCommand {
    constructor(id, data) {
        this.id = id;
        this.isActive = data.isActive;
    }
}

class ToggleDryingLinkCommand {
    constructor(linkId, dryingId, data) {
        this.linkId = linkId;
        this.dryingId = dryingId;
        this.isActive = data.isActive;
    }
}

class ApproveDryingCommand {
    constructor(id, userId) {
        this.id = id;
        this.userId = userId;
    }
}

class RejectDryingCommand {
    constructor(id) {
        this.id = id;
    }
}

class AddDryingCostCommand {
    constructor(dryingId, userId, data) {
        this.dryingId = dryingId;
        this.userId = userId;
        this.costData = data;
    }
}

module.exports = {
    CreateDryingCommand,
    UpdateDryingBatchesCommand,
    CreateDryingLinkCommand,
    ToggleDryingActiveCommand,
    ToggleDryingLinkCommand,
    ApproveDryingCommand,
    RejectDryingCommand,
    AddDryingCostCommand
};
