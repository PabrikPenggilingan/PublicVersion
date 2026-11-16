class SubmitDryingSessionCommand {
    constructor(linkCode, data, photos) {
        this.linkCode = linkCode;
        this.data = data;
        this.photos = photos;
    }
}

module.exports = {
    SubmitDryingSessionCommand
};
