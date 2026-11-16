class UploadFileCommand {
    constructor(data, file) {
        this.purchaseId = data.purchaseId;
        this.processId = data.processId;
        this.saleId = data.saleId;
        this.saleType = data.saleType;
        this.fileType = data.fileType;
        this.file = file;
    }
}

module.exports = {
    UploadFileCommand
};
