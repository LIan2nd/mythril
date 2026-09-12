import { z } from 'zod';
import { COLUMN_COLORS, COLUMN_KINDS, ISSUE_TYPES, PRIORITIES, USER_STATUSES } from '@/domain/types';

export const USER_COLORS = ['lav', 'yellow', 'coral', 'mint', 'sky'] as const;

export const createIssueSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priority: z.enum(PRIORITIES),
  type: z.enum(ISSUE_TYPES),
  status: z.string().min(1).max(64),
  assignee: z.string().min(1),
  checklistTexts: z.array(z.string().min(1).max(200)).optional(),
});

export const updateIssueSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(PRIORITIES).optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    assignee: z.string().min(1).optional(),
    status: z.string().min(1).max(64).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const moveIssueSchema = z.object({
  status: z.string().min(1).max(64),
  beforeIssueId: z.number().int().positive().nullable(),
});

export const checklistTextSchema = z.object({
  text: z.string().min(1).max(200),
});

export const toggleDoneSchema = z.object({
  done: z.boolean(),
});

const usernameField = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Username must be 3-32 characters (lowercase letters, digits, dot, dash or underscore)');

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  username: usernameField,
  displayName: z.string().trim().min(2, 'Display name must be 2-60 characters').max(60),
  password: z.string().min(8, 'Password must be 8-72 characters').max(72),
});

const existingUsernameField = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]{2,32}$/, 'Username must be 2-32 characters (lowercase letters, digits, dot, dash or underscore)');

export const profilePatchSchema = z
  .object({
    username: existingUsernameField.optional(),
    displayName: z.string().trim().min(2).max(60).optional(),
    color: z.enum(USER_COLORS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be 8-72 characters').max(72),
});

export const adminUserListSchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
});

export const adminCreateUserSchema = z.object({
  username: usernameField,
  displayName: z.string().trim().min(2).max(60),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'member']),
  code: z.string().trim().regex(/^[A-Z]{2,4}$/, 'Code must be 2-4 uppercase letters').optional(),
});

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(['admin', 'member']).optional(),
    status: z.enum(USER_STATUSES).optional(),
    displayName: z.string().trim().min(2).max(60).optional(),
    color: z.enum(USER_COLORS).optional(),
    code: z.string().trim().regex(/^[A-Z]{2,4}$/, 'Code must be 2-4 uppercase letters').optional(),
    password: z.string().min(8).max(72).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const adminCreateProjectSchema = z.object({
  key: z.string().trim().regex(/^[A-Z0-9-]{2,32}$/, 'Key must be 2-32 characters (A-Z, digits or dash)'),
  name: z.string().trim().min(1, 'Name is required').max(60),
});

export const adminUpdateProjectSchema = z
  .object({
    key: z.string().trim().regex(/^[A-Z0-9-]{2,32}$/, 'Key must be 2-32 characters (A-Z, digits or dash)').optional(),
    name: z.string().trim().min(1).max(60).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const projectMembersSchema = z.object({
  codes: z.array(z.string().min(1).max(64)).max(500),
});

export const columnCreateSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(40),
  kind: z.enum(COLUMN_KINDS),
  color: z.enum(COLUMN_COLORS),
  beforeKey: z.string().min(1).max(64).nullish(),
});

export const columnPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(40).optional(),
    kind: z.enum(COLUMN_KINDS).optional(),
    color: z.enum(COLUMN_COLORS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const reorderColumnsSchema = z.object({
  orderedKeys: z.array(z.string().min(1).max(64)).min(1, 'orderedKeys must list every column key'),
});
