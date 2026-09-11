import {
  PostgresChecklistRepo,
  PostgresIssueRepo,
  PostgresProjectRepo,
  PostgresSprintRepo,
  PostgresUserRepo,
} from '@/infra/db/repositories';
import { BoardService } from './board-service';
import { ChecklistService } from './checklist-service';
import { IssueService } from './issue-service';

export { BoardService, daysLeftFrom } from './board-service';
export { IssueService, DEFAULT_CHECKLIST } from './issue-service';
export { ChecklistService, MAX_CHECKLIST_ITEMS } from './checklist-service';

export interface Services {
  board: BoardService;
  issue: IssueService;
  checklist: ChecklistService;
}

let singleton: Services | null = null;

export function getServices(): Services {
  if (!singleton) {
    const projects = new PostgresProjectRepo();
    const sprints = new PostgresSprintRepo();
    const users = new PostgresUserRepo();
    const issues = new PostgresIssueRepo();
    const checklist = new PostgresChecklistRepo();
    singleton = {
      board: new BoardService({ projects, sprints, users, issues }),
      issue: new IssueService({ projects, users, issues }),
      checklist: new ChecklistService({ issues, checklist }),
    };
  }
  return singleton;
}
