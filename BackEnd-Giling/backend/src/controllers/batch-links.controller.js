const db = require('../config/database');
const { generateUniqueLinkCode } = require('../services/link.service');
const logger = require('../services/logger.service');
const { asyncHandler } = require('../utils/helpers');
const { ownershipChecks } = require('../utils/authGuards');
const { CreateBatchLinkCommand, ToggleBatchLinkCommand } = require('../dtos/batchLink.dto');
const BatchLinkMapper = require('../mappers/batchLink.mapper');

/**
 * Check if a link code already exists
 */
async function linkCodeExists(code) {
    const result = await db.query(
        'SELECT id FROM trx.batch_links WHERE link_code = $1',
        [code]
    );
    return result.rows.length > 0;
}

/**
 * Generate a new link for a batch
 */
const createLink = asyncHandler(async (req, res) => {
    const command = new CreateBatchLinkCommand(req.params.id, req.user.id, req.body);

    // Check if batch exists
    const batchResult = await db.query('SELECT id FROM trx.batches WHERE id = $1', [command.batchId]);
    if (batchResult.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
    }

    // Deactivate any existing active link for this batch+formType
    await db.query(
        `UPDATE trx.batch_links SET is_active = false 
         WHERE batch_id = $1 AND form_type = $2 AND is_active = true`,
        [command.batchId, command.formType]
    );

    // Generate unique link code
    const linkCode = await generateUniqueLinkCode(linkCodeExists);

    // Create new link
    const result = await db.query(
        `INSERT INTO trx.batch_links (batch_id, link_code, form_type, is_active, created_by, expires_at)
         VALUES ($1, $2, $3, true, $4, $5)
         RETURNING *`,
        [command.batchId, linkCode, command.formType, command.userId, command.expiresAt || null]
    );

    // Log activity
    await logger.log({
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'batch_link',
        entityId: result.rows[0].id,
        oldData: null,
        newData: result.rows[0],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.status(201).json({ data: BatchLinkMapper.toResponse(result.rows[0]) });
});

/**
 * Get all links for a batch
 */
const getLinksByBatch = asyncHandler(async (req, res) => {
    const { id: batchId } = req.params;

    const result = await db.query(
        `SELECT bl.*, u.username as created_by_name
         FROM trx.batch_links bl
         LEFT JOIN sys.users u ON bl.created_by = u.id
         WHERE bl.batch_id = $1
         ORDER BY bl.created_at DESC`,
        [batchId]
    );

    res.json({ data: result.rows.map(BatchLinkMapper.toResponse) });
});

/**
 * Toggle link active status
 */
const toggleLink = asyncHandler(async (req, res) => {
    const command = new ToggleBatchLinkCommand(req.params.linkId, req.params.id, req.body);

    // Verify the link belongs to this batch
    await ownershipChecks.batchLink(command.linkId, command.batchId, 'Link not found for this batch');

    const result = await db.query(
        `UPDATE trx.batch_links SET is_active = $1 WHERE id = $2 RETURNING *`,
        [command.isActive, command.linkId]
    );

    await logger.log({
        userId: req.user.id,
        action: 'UPDATE',
        entityType: 'batch_link',
        entityId: command.linkId,
        oldData: null,
        newData: result.rows[0],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.json({ data: BatchLinkMapper.toResponse(result.rows[0]) });
});

/**
 * Delete a link
 */
const deleteLink = asyncHandler(async (req, res) => {
    const { linkId } = req.params;
    const { id: batchId } = req.params;

    // Verify the link belongs to this batch
    await ownershipChecks.batchLink(linkId, batchId, 'Link not found for this batch');

    const result = await db.query(
        'DELETE FROM trx.batch_links WHERE id = $1 RETURNING *',
        [linkId]
    );

    await logger.log({
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'batch_link',
        entityId: linkId,
        oldData: result.rows[0],
        newData: null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.json({ message: 'Link deleted successfully' });
});

module.exports = {
    createLink,
    getLinksByBatch,
    toggleLink,
    deleteLink
};
