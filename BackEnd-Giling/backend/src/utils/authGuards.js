/**
 * Authorization Guards
 *
 * Reusable helpers for permission checks and resource ownership validation.
 * Use these inside controllers or services to enforce access rules before
 * executing downstream service logic.
 *
 * Usage:
 *   const { assertRole, assertOwnership, defineOwnershipCheck, ownershipChecks } = require('../utils/authGuards');
 *
 *   // Role check (throws 403 if user.role not in allowed list)
 *   assertRole(req.user, 'admin', 'operator');
 *
 *   // Ownership check (throws 404 if costId does not belong to processId)
 *   await assertOwnership('trx.process_costs', 'id', costId, 'process_id', processId);
 *
 *   // Pre-built checker for a common relationship
 *   await ownershipChecks.processCost(costId, processId);
 */

const db = require('../config/database');
const { AuthorizationError, NotFoundError } = require('./errors');

/**
 * Asserts that the requesting user has one of the specified roles.
 * Throws AuthorizationError (403) if not.
 *
 * @param {object} user - The authenticated user object (from req.user)
 * @param {...string} roles - Allowed role names (e.g. 'admin', 'operator')
 */
const assertRole = (user, ...roles) => {
    if (!user) {
        throw new AuthorizationError('Not authenticated');
    }
    if (!roles.includes(user.role)) {
        throw new AuthorizationError(
            `Access denied. Required role: ${roles.join(' or ')}. Your role: ${user.role}`
        );
    }
};

/**
 * Asserts that a child resource belongs to the expected parent record.
 * Throws NotFoundError (404) if the child does not belong to the parent.
 * Returns 404 (not 403) intentionally to avoid leaking the existence of records.
 *
 * @param {string} table         - Fully-qualified table name, e.g. 'trx.process_costs'
 * @param {string} childColumn   - The child primary key column, e.g. 'id'
 * @param {*}      childId       - The child record ID value (from req.params)
 * @param {string} parentColumn  - The FK column referencing the parent, e.g. 'process_id'
 * @param {*}      parentId      - The parent record ID value (from req.params)
 * @param {string} [errorMsg]    - Optional custom error message
 */
const assertOwnership = async (table, childColumn, childId, parentColumn, parentId, errorMsg) => {
    const result = await db.query(
        `SELECT ${childColumn} FROM ${table} WHERE ${childColumn} = $1 AND ${parentColumn} = $2`,
        [childId, parentId]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError(errorMsg || 'Resource not found');
    }
};

/**
 * Factory that creates a reusable, pre-configured ownership checker function
 * for a specific table relationship.
 *
 * @param {string} table        - Fully-qualified table name, e.g. 'trx.sale_payments'
 * @param {string} childColumn  - The child primary key column, e.g. 'id'
 * @param {string} parentColumn - The FK column referencing the parent, e.g. 'sale_id'
 * @returns {Function} async (childId, parentId, errorMsg?) => void
 */
const defineOwnershipCheck = (table, childColumn, parentColumn) => {
    return (childId, parentId, errorMsg) =>
        assertOwnership(table, childColumn, childId, parentColumn, parentId, errorMsg);
};

// -----------------------------------------------------------------------------
// Pre-built ownership checkers for common relationships in this application.
// -----------------------------------------------------------------------------
const ownershipChecks = {
    /** Verifies a process cost belongs to the given process */
    processCost:   defineOwnershipCheck('trx.process_costs',  'id', 'process_id'),

    /** Verifies a drying link belongs to the given drying process */
    dryingLink:    defineOwnershipCheck('trx.drying_links',   'id', 'drying_id'),

    /** Verifies a drying cost belongs to the given drying process */
    dryingCost:    defineOwnershipCheck('trx.drying_costs',   'id', 'drying_id'),

    /** Verifies a batch link belongs to the given batch */
    batchLink:     defineOwnershipCheck('trx.batch_links',    'id', 'batch_id'),

    /** Verifies a sale item belongs to the given sale */
    saleItem:      defineOwnershipCheck('trx.sale_items',     'id', 'sale_id'),

    /** Verifies a delivery record belongs to the given sale */
    saleDelivery:  defineOwnershipCheck('trx.sale_deliveries','id', 'sale_id'),

    /** Verifies a payment record belongs to the given sale */
    salePayment:   defineOwnershipCheck('trx.sale_payments',  'id', 'sale_id'),
};

module.exports = {
    assertRole,
    assertOwnership,
    defineOwnershipCheck,
    ownershipChecks
};
