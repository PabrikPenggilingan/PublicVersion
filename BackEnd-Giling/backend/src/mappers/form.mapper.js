class FormMapper {
    static toResponse(data) {
        if (!data) return null;
        return data; // Simple pass-through for now
    }
}

module.exports = FormMapper;
