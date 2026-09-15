import { NotFoundError, ValidationError } from '@/domain/errors';
import type { AuthRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, ProfileUpdatePayload } from '@/domain/types';
import { hashPassword, verifyPassword } from '@/server/auth/crypto';

export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export interface StoredAvatar {
  data: Uint8Array;
  type: string;
  updatedAt: string | null;
}

export interface ProfileServiceDeps {
  auth: AuthRepo;
  users: UserRepo;
}

export class ProfileService {
  constructor(private readonly deps: ProfileServiceDeps) {}

  updateProfile(actor: AuthUser, patch: ProfileUpdatePayload): Promise<AuthUser> {
    return this.deps.users.updateProfile(actor.id, patch);
  }

  async changePassword(actor: AuthUser, currentPassword: string, newPassword: string): Promise<void> {
    const record = await this.deps.auth.getRecordForLogin(actor.username);
    if (!record || !verifyPassword(currentPassword, record.passwordHash)) {
      throw new ValidationError('Current password is incorrect');
    }
    await this.deps.users.updatePassword(actor.id, hashPassword(newPassword));
  }

  async uploadAvatar(actor: AuthUser, bytes: Uint8Array): Promise<AuthUser> {
    if (bytes.length === 0) throw new ValidationError('Avatar file is empty');
    if (bytes.length > MAX_AVATAR_BYTES) throw new ValidationError('Avatar must be 3 MB or smaller');
    const type = sniffImageType(bytes);
    return this.deps.users.setAvatar(actor.id, bytes, type);
  }

  removeAvatar(actor: AuthUser): Promise<AuthUser> {
    return this.deps.users.setAvatar(actor.id, null, null);
  }

  async getAvatar(code: string): Promise<StoredAvatar> {
    const avatar = await this.deps.users.getAvatarByCode(code);
    if (!avatar) throw new NotFoundError('Avatar not found');
    return avatar;
  }
}

const SIGNATURES: [number[], string][] = [
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
  [[0xff, 0xd8, 0xff], 'image/jpeg'],
  [[0x47, 0x49, 0x46, 0x38], 'image/gif'],
];

export function sniffImageType(bytes: Uint8Array): string {
  for (const [sig, type] of SIGNATURES) {
    if (sig.every((byte, i) => bytes[i] === byte)) return type;
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  throw new ValidationError('Only PNG, JPEG, GIF and WebP images are allowed');
}
