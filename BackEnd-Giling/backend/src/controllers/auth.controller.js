const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/helpers');
const { RegisterCommand, LoginCommand } = require('../dtos/auth.dto');
const { generateCsrfToken, setCsrfCookie } = require('../middleware/csrf');

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });

  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  return csrfToken;
};

const register = asyncHandler(async (req, res) => {
  const command = new RegisterCommand(req.body);
  
  const result = await authService.register(command);
  const csrfToken = setTokenCookie(res, result.token);
  
  res.status(201).json({
    success: true,
    data: { ...result, csrfToken }
  });
});

const login = asyncHandler(async (req, res) => {
  const command = new LoginCommand(req.body);
  
  const result = await authService.login(command);
  const csrfToken = setTokenCookie(res, result.token);
  
  res.json({
    success: true,
    data: { ...result, csrfToken }
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  
  res.json({
    success: true,
    data: user
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  res.clearCookie('csrf_token', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = {
  register,
  login,
  getCurrentUser,
  logout
};
