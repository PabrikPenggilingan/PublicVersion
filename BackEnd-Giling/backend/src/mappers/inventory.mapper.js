class InventoryMapper {
    static toResponse(data) {
        return data; // Using pass-through for response to avoid breaking frontend keys
    }
}

module.exports = InventoryMapper;
