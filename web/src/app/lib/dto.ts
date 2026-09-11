import type { ChecklistItem, Issue } from '@/domain/types';

export interface IssueDTO {
  id: number;
  key: string;
  title: string;
  description: string;
  priority: Issue['priority'];
  type: Issue['type'];
  status: Issue['status'];
  assignee: { code: string; name: string; avatarColor: string };
  position: number;
  checklist: ChecklistItem[];
}

export function toIssueDTO(issue: Issue): IssueDTO {
  return {
    id: issue.id,
    key: issue.key,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    type: issue.type,
    status: issue.status,
    assignee: {
      code: issue.assignee.code,
      name: issue.assignee.name,
      avatarColor: issue.assignee.avatarColor,
    },
    position: issue.position,
    checklist: issue.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, position: c.position })),
  };
}

export const toIssueDTOs = (issues: Issue[]): IssueDTO[] => issues.map(toIssueDTO);
