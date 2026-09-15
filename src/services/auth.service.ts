import { ConflictError, ForbiddenError, NotFoundError } from '@/domain/errors';
import type { AuthRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, LoginPayload, RegisterRequestPayload } from '@/domain/types';
import { hashPassword, pickColor, verifyPassword } from '@/server/auth/crypto';
import { codeSlug, pickUniqueCode } from './guards';

export const PENDING_LOGIN_MESSAGE = 'Your account request is awaiting admin approval.';
export const BLOCKED_LOGIN_MESSAGE = 'Your account is blocked. Contact an administrator.';
export const GENERIC_LOGIN_FAILURE_MESSAGE = 'Invalid username or password';
export const REGISTER_SUCCESS_MESSAGE = 'Request submitted — an admin needs to approve it';

export interface AuthServiceDeps {
  auth: AuthRepo;
  users: UserRepo;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(input: RegisterRequestPayload): Promise<AuthUser> {
    const username = input.username.trim();
    const taken = await this.deps.auth.getRecordForLogin(username);
    if (taken) throw new ConflictError('That username is already taken');
    const code = await pickUniqueCode(this.deps.users, codeSlug(username));
    return this.deps.users.create({
      code,
      username,
      displayName: input.displayName.trim(),
      passwordHash: hashPassword(input.password),
      role: 'member',
      status: 'pending',
      color: pickColor(username),
    });
  }

  async login(input: LoginPayload): Promise<AuthUser> {
    const record = await this.deps.auth.getRecordForLogin(input.username.trim());
    if (!record || !verifyPassword(input.password, record.passwordHash)) {
      throw new NotFoundError(GENERIC_LOGIN_FAILURE_MESSAGE);
    }
    if (record.user.status === 'pending') throw new ForbiddenError(PENDING_LOGIN_MESSAGE);
    if (record.user.status !== 'active') throw new ForbiddenError(BLOCKED_LOGIN_MESSAGE);
    return record.user;
  }
}
