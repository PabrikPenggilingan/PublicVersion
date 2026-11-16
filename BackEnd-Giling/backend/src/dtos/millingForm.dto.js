class SubmitMillingSessionCommand {
    constructor(linkCode, data, files) {
        this.linkCode = linkCode;
        this.sessionType = data.sessionType;
        this.pic = data.pic;
        this.crewNames = data.crewNames;
        this.notes = data.notes;
        this.outputData = data.outputData ? JSON.parse(data.outputData) : null;
        this.moistureContent = data.moistureContent ? parseFloat(data.moistureContent) : null;
        this.hardnessType = data.hardnessType;
        this.brokenRatio = data.brokenRatio ? parseFloat(data.brokenRatio) : null;
        
        this.photos = files ? files.map(f => ({
            originalName: f.originalname,
            filename: f.filename,
            mimeType: f.mimetype,
            sizeBytes: f.size,
            filePath: `milling/${f.filename}`
        })) : [];
    }
}

module.exports = {
    SubmitMillingSessionCommand
};
