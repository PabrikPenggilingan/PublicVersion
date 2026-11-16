class RegisterCommand {
  constructor({ username, password, role }) {
    this.username = username;
    this.password = password;
    this.role = role || 'viewer';
  }
}

class LoginCommand {
  constructor({ username, password }) {
    this.username = username;
    this.password = password;
  }
}

class AuthResponseDTO {
  constructor(user, token) {
    this.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      accessible_modules: user.accessible_modules,
      is_super_admin: user.is_super_admin || false
    };
    this.token = token;
  }

  // Define what goes to the client in the body
  toJSON() {
    return {
      user: this.user
    };
  }
}

class UserResponseDTO {
  constructor(user) {
    this.id = user.id;
    this.username = user.username;
    this.role = user.role;
    this.accessible_modules = user.accessible_modules;
    this.is_super_admin = user.is_super_admin || false;
  }
}

module.exports = {
  RegisterCommand,
  LoginCommand,
  AuthResponseDTO,
  UserResponseDTO
};
