import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '@/domain/errors';
import type { AuthRecord, AuthRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, User } from '@/domain/types';
import { hashPassword, signToken, verifyPassword, verifyToken } from '@/server/auth/crypto';
import {
  AuthService,
  BLOCKED_LOGIN_MESSAGE,
  GENERIC_LOGIN_FAILURE_MESSAGE,
  PENDING_LOGIN_MESSAGE,
} from '@/services/auth.service';

const alice = (status: AuthUser['status'], role: AuthUser['role']): AuthUser => ({
  id: 10, username: 'alice', code: 'AL', displayName: 'Alice', role, status, color: 'sky', hasAvatar: false,
});

class FakeAuth implements AuthRepo {
  records = new Map<string, AuthRecord>();
  users = new Map<number, AuthUser>();
  seed(user: AuthUser, password: string) {
    this.records.set(user.username, { user, passwordHash: hashPassword(password) });
    this.users.set(user.id, user);
  }
  async getRecordForLogin(username: string) {
    return this.records.get(username) ?? null;
  }
  async getUserById(id: number) {
    return this.users.get(id) ?? null;
  }
}

class FakeBadgeUsers implements Pick<UserRepo, 'getByCode' | 'create'> {
  async getByCode(_code: string): Promise<User | null> {
    return null;
  }
  async create(input: Parameters<UserRepo['create']>[0]): Promise<AuthUser> {
    return {
      id: 99, username: input.username, code: input.code, displayName: input.displayName,
      role: input.role, status: input.status, color: input.color, hasAvatar: false,
    };
  }
}

function build() {
  const auth = new FakeAuth();
  const users = new FakeBadgeUsers() as unknown as UserRepo;
  auth.seed(alice('active', 'member'), 'wonderland-1');
  auth.seed({ ...alice('pending', 'member'), id: 11, username: 'bob' }, 'wonderland-2');
  auth.seed({ ...alice('disabled', 'admin'), id: 12, username: 'carol' }, 'wonderland-3');
  return { auth, users, svc: new AuthService({ auth, users }) };
}

describe('password hashing + session tokens', () => {
  it('verifies matching passwords and rejects wrong ones', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('round-trips tokens and rejects tampering', () => {
    const token = signToken({ id: 7, role: 'admin' });
    expect(verifyToken(token)?.uid).toBe(7);
    const parts = token.split('.');
    expect(verifyToken(`${parts[0].slice(0, -1)}a.${parts[1]}`)).toBeNull();
    expect(verifyToken('garbage')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });
});

describe('AuthService.login', () => {
  it('accepts active users and rejects bad credentials generically', async () => {
    const { svc } = build();
    await expect(svc.login({ username: 'alice', password: 'wonderland-1' })).resolves.toMatchObject({ username: 'alice' });
    await expect(svc.login({ username: 'alice', password: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.login({ username: 'alice', password: 'nope' })).rejects.toHaveProperty('message', GENERIC_LOGIN_FAILURE_MESSAGE);
    await expect(svc.login({ username: 'ghost', password: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('blocks pending with approval message and disabled accounts', async () => {
    const { svc } = build();
    await expect(svc.login({ username: 'bob', password: 'wonderland-2' })).rejects.toMatchObject({
      message: PENDING_LOGIN_MESSAGE,
    });
    await expect(svc.login({ username: 'carol', password: 'wonderland-3' })).rejects.toMatchObject({
      message: BLOCKED_LOGIN_MESSAGE,
    });
    await expect(svc.login({ username: 'bob', password: 'wonderland-2' })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('AuthService.register', () => {
  it('stores requests as pending members, never active', async () => {
    const { svc } = build();
    const created = await svc.register({ username: 'dave', displayName: 'Dave Deep', password: 'wonderland-4' });
    expect(created.status).toBe('pending');
    expect(created.role).toBe('member');
    expect(created.code).toBeTruthy();
  });

  it('rejects duplicate usernames', async () => {
    const { svc } = build();
    await expect(svc.register({ username: 'alice', displayName: 'Impostor', password: 'wonderland-9' })).rejects.toBeInstanceOf(ConflictError);
  });
});
