const { usersModel } = require('../models');
const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/helpers');
const { NotFoundError } = require('../utils/errors');

// HOTFIX: Master Akses works as before the per-pabrik change — admins manage all users and
// new users are NOT attached to the creating admin (see utils/tenant.js).
const scopeOwner = () => null;

const getUsers = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const owner = scopeOwner(req.user);
    const users = await usersModel.getAll(limit, offset, owner);
    const total = await usersModel.count(owner);

    res.json({
        success: true,
        data: users,
        meta: {
            total,
            limit,
            offset
        }
    });
});

const createUser = asyncHandler(async (req, res) => {
    // Generate an account using authService which hashes the password
    const result = await authService.register({ ...req.body, ownerId: null });
    res.status(201).json({
        success: true,
        data: result.user
    });
});

const updateModules = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { modules } = req.body;
    
    if (!Array.isArray(modules)) {
        return res.status(400).json({ success: false, message: 'modules must be an array' });
    }

    const owner = scopeOwner(req.user);
    if (owner && (await usersModel.tenantOwnerOf(id)) !== owner) {
        throw new NotFoundError('User not found');
    }

    const updatedUser = await usersModel.updateModules(id, modules);
    if (!updatedUser) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        data: updatedUser
    });
});

module.exports = {
    getUsers,
    createUser,
    updateModules
};
