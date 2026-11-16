class SaveWizardStateCommand {
    constructor(userId, entityType, entityId, data) {
        this.userId = userId;
        this.entityType = entityType;
        this.entityId = entityId;
        this.currentStep = data.currentStep;
        this.stepData = data.stepData;
    }
}

class AdvanceWizardStepCommand {
    constructor(userId, entityType, entityId, data) {
        this.userId = userId;
        this.entityType = entityType;
        this.entityId = entityId;
        this.nextStep = data.nextStep;
        this.additionalData = data.additionalData;
    }
}

module.exports = {
    SaveWizardStateCommand,
    AdvanceWizardStepCommand
};
