class CreateBatchLinkCommand {
    constructor(batchId, userId, data) {
        this.batchId = batchId;
        this.userId = userId;
        this.formType = data.formType || 'PURCHASE';
        this.expiresAt = data.expiresAt;
    }
}

class ToggleBatchLinkCommand {
    constructor(linkId, batchId, data) {
        this.linkId = linkId;
        this.batchId = batchId;
        this.isActive = data.isActive;
    }
}

module.exports = {
    CreateBatchLinkCommand,
    ToggleBatchLinkCommand
};
