const { AuthResponseDTO, UserResponseDTO } = require('../dtos/auth.dto');

class AuthMapper {
  static toAuthResponse(user, token) {
    return new AuthResponseDTO(user, token);
  }

  static toUserResponse(user) {
    return new UserResponseDTO(user);
  }
}

module.exports = AuthMapper;
