class CreateLogisticsTaskCommand {
    constructor(userId, data) {
        this.userId = userId;
        this.referenceType = data.referenceType;
        this.referenceId = data.referenceId;
        this.driverName = data.driverName;
        this.vehiclePlate = data.vehiclePlate;
        this.status = data.status;
        this.operationalCost = data.operationalCost;
        this.financeAccountId = data.financeAccountId;
        this.departureTime = data.departureTime;
        this.arrivalTime = data.arrivalTime;
        this.notes = data.notes;
    }
}

class UpdateLogisticsTaskCommand {
    constructor(id, userId, data) {
        this.id = id;
        this.userId = userId;
        this.data = data;
    }
}

module.exports = {
    CreateLogisticsTaskCommand,
    UpdateLogisticsTaskCommand
};
