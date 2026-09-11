import { z } from 'zod';
import { COLUMN_IDS, ISSUE_TYPES, PRIORITIES } from '@/domain/types';

export const createIssueSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priority: z.enum(PRIORITIES),
  type: z.enum(ISSUE_TYPES),
  status: z.enum(COLUMN_IDS),
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
    status: z.enum(COLUMN_IDS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Empty patch' });

export const moveIssueSchema = z.object({
  status: z.enum(COLUMN_IDS),
  beforeIssueId: z.number().int().positive().nullable(),
});

export const checklistTextSchema = z.object({
  text: z.string().min(1).max(200),
});

export const toggleDoneSchema = z.object({
  done: z.boolean(),
});
