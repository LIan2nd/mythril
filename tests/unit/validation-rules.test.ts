import { describe, expect, it } from 'vitest';
import {
  adminCreateProjectSchema,
  adminCreateUserSchema,
  columnCreateSchema,
  createIssueSchema,
  loginSchema,
  registerSchema,
} from '@/app/lib/validation';

describe('Client & Server Form Validation Schemas', () => {
  describe('Issue Form Validation', () => {
    it('requires a non-empty title and valid assignee', () => {
      const invalid = createIssueSchema.safeParse({
        title: '',
        priority: 'HIGH',
        type: 'TASK',
        status: 'todo',
        assignee: '',
      });
      expect(invalid.success).toBe(false);

      const valid = createIssueSchema.safeParse({
        title: 'Valid Issue Title',
        priority: 'HIGH',
        type: 'TASK',
        status: 'todo',
        assignee: 'AD',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects titles longer than 120 characters', () => {
      const tooLong = createIssueSchema.safeParse({
        title: 'a'.repeat(121),
        priority: 'HIGH',
        type: 'TASK',
        status: 'todo',
        assignee: 'AD',
      });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('Project Form Validation', () => {
    it('requires key to match uppercase alphanumeric and dash with min 2 chars', () => {
      expect(adminCreateProjectSchema.safeParse({ key: 'a', name: 'Valid Name' }).success).toBe(false);
      expect(adminCreateProjectSchema.safeParse({ key: 'lowercase', name: 'Valid Name' }).success).toBe(false);
      expect(adminCreateProjectSchema.safeParse({ key: 'VALID-KEY-1', name: 'Valid Name' }).success).toBe(true);
    });

    it('requires non-empty name up to 60 characters', () => {
      expect(adminCreateProjectSchema.safeParse({ key: 'PROJECT', name: '' }).success).toBe(false);
      expect(adminCreateProjectSchema.safeParse({ key: 'PROJECT', name: 'a'.repeat(61) }).success).toBe(false);
      expect(adminCreateProjectSchema.safeParse({ key: 'PROJECT', name: 'Good Project' }).success).toBe(true);
    });
  });

  describe('User Form Validation', () => {
    it('enforces username format and length', () => {
      expect(adminCreateUserSchema.safeParse({
        username: 'ab',
        displayName: 'Test User',
        password: 'password123',
        role: 'member',
      }).success).toBe(false); // under 3 chars

      expect(adminCreateUserSchema.safeParse({
        username: 'valid_user.1',
        displayName: 'Test User',
        password: 'password123',
        role: 'member',
      }).success).toBe(true);
    });

    it('enforces password minimum length of 8 characters', () => {
      expect(adminCreateUserSchema.safeParse({
        username: 'valid_user',
        displayName: 'Test User',
        password: '123',
        role: 'member',
      }).success).toBe(false);

      expect(adminCreateUserSchema.safeParse({
        username: 'valid_user',
        displayName: 'Test User',
        password: 'password123',
        role: 'member',
      }).success).toBe(true);
    });
  });

  describe('Column Form Validation', () => {
    it('requires non-empty column label up to 40 characters', () => {
      expect(columnCreateSchema.safeParse({
        label: '',
        kind: 'active',
        color: 'sky',
      }).success).toBe(false);

      expect(columnCreateSchema.safeParse({
        label: 'a'.repeat(41),
        kind: 'active',
        color: 'sky',
      }).success).toBe(false);

      expect(columnCreateSchema.safeParse({
        label: 'In QA',
        kind: 'active',
        color: 'sky',
      }).success).toBe(true);
    });
  });

  describe('Auth Form Validation (Login & Register)', () => {
    it('rejects empty login credentials', () => {
      expect(loginSchema.safeParse({ username: '', password: '' }).success).toBe(false);
      expect(loginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
      expect(loginSchema.safeParse({ username: 'admin', password: 'password123' }).success).toBe(true);
    });

    it('enforces registration password matching constraints', () => {
      expect(registerSchema.safeParse({
        username: 'new_user',
        displayName: 'New User',
        password: 'short',
      }).success).toBe(false);

      expect(registerSchema.safeParse({
        username: 'new_user',
        displayName: 'New User',
        password: 'valid_password_123',
      }).success).toBe(true);
    });
  });
});
