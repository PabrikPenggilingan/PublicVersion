const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { verifyToken, requireRole } = require('../middleware/auth');

// All routes here should be protected and only accessible by admin
router.use(verifyToken);
router.use(requireRole('admin'));

router.get('/', usersController.getUsers);
router.post('/', usersController.createUser);
router.put('/:id/modules', usersController.updateModules);

module.exports = router;
