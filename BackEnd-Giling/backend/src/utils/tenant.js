const requestContext = require('../config/context');

// Data isolation helpers. Every query that used to filter "created_by = me" goes through
// tenantIds()/tenantSql()/inTenant().
//
// HOTFIX: strict per-user isolation. Sharing data between users of one pabrik
// (sys.users.owner_id) leaked data in production, because accounts there are created by a
// platform admin for different mills — so "created by the same admin" is NOT "same pabrik".
// Until pabrik membership is assigned explicitly, every user only sees their own records
// (the behaviour before the per-pabrik change). tenant_user_ids from the auth middleware
// is deliberately ignored.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids whose records the given (or current) user may see: only the user themself. */
function tenantIds(user) {
    const u = user || requestContext.getStore()?.user;
    if (!u || !UUID_RE.test(String(u.id))) return [];
    return [String(u.id)];
}

/** Inline SQL array literal for queries that are not parameterised (ids are validated UUIDs). */
function tenantSql(user) {
    const ids = tenantIds(user);
    if (!ids.length) return `ARRAY[]::uuid[]`;
    return `ARRAY[${ids.map(id => `'${id}'`).join(',')}]::uuid[]`;
}

/** True when the record's creator belongs to the current user's pabrik. */
function inTenant(createdBy, user) {
    return !!createdBy && tenantIds(user).includes(String(createdBy));
}

module.exports = { tenantIds, tenantSql, inTenant };
