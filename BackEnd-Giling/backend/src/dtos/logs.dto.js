class LogQueryCommand {
    constructor(query) {
        this.page = query.page || 1;
        this.limit = Math.min(parseInt(query.limit) || 50, 100);
        this.action = query.action;
        this.entityType = query.entityType;
        this.userId = query.userId;
        this.days = query.days || 7;
        this.offset = query.offset || 0;
    }
}

module.exports = {
    LogQueryCommand
};
