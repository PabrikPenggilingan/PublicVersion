const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { usersModel } = require('../models');
const { AuthenticationError, ConflictError } = require('../utils/errors');
const AuthMapper = require('../mappers/auth.mapper');

class AuthService {
  async register(command) {
    const { username, password, role, ownerId } = command;
    // Check if user exists
    const existingUser = await usersModel.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await usersModel.create({
      username,
      passwordHash,
      role,
      ownerId // set when an admin creates the user: they join the admin's pabrik
    });

    // Generate token
    const token = this.generateToken(user.id);

    return AuthMapper.toAuthResponse(user, token);
  }

  async login(command) {
    const { username, password } = command;
    // Find user
    const user = await usersModel.findByUsername(username);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken(user.id);

    return AuthMapper.toAuthResponse(user, token);
  }

  generateToken(userId) {
    return jwt.sign(
      { userId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  }

  async getCurrentUser(userId) {
    const user = await usersModel.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return AuthMapper.toUserResponse(user);
  }
}

module.exports = new AuthService();
