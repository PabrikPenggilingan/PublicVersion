const crypto = require('crypto');

/**
 * Generate a unique short link code
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} - Alphanumeric code
 */
function generateLinkCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        code += chars[randomBytes[i] % chars.length];
    }
    return code;
}

/**
 * Generate a unique link code with retry logic
 * @param {Function} checkExists - Async function to check if code exists
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<string>} - Unique code
 */
async function generateUniqueLinkCode(checkExists, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
        const code = generateLinkCode(6);
        const exists = await checkExists(code);
        if (!exists) {
            return code;
        }
    }
    throw new Error('Failed to generate unique link code after max retries');
}

module.exports = {
    generateLinkCode,
    generateUniqueLinkCode
};
