import {
  PostgresAuthRepo,
  PostgresBoardColumnRepo,
  PostgresChecklistRepo,
  PostgresIssueRepo,
  PostgresProjectRepo,
  PostgresSprintRepo,
  PostgresUserRepo,
} from '@/infra/db/repositories';
import { ensureDbReady } from '@/infra/db/ensure-ready';
import type { SessionDeps } from '@/server/auth/session';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { BoardService } from './board-service';
import { ChecklistService } from './checklist-service';
import { IssueService } from './issue-service';
import { ProfileService } from './profile.service';

export { BoardService, daysLeftFrom } from './board-service';
export { IssueService, DEFAULT_CHECKLIST } from './issue-service';
export { ChecklistService, MAX_CHECKLIST_ITEMS } from './checklist-service';
export { AuthService, REGISTER_SUCCESS_MESSAGE } from './auth.service';
export { ProfileService, MAX_AVATAR_BYTES } from './profile.service';
export { AdminService } from './admin.service';

export interface Services {
  board: BoardService;
  issue: IssueService;
  checklist: ChecklistService;
  auth: AuthService;
  profile: ProfileService;
  admin: AdminService;
  session: SessionDeps;
}

let singleton: Services | null = null;

export function getServices(): Services {
  if (!singleton) {
    ensureDbReady().catch(() => {});
    const projects = new PostgresProjectRepo();
    const sprints = new PostgresSprintRepo();
    const users = new PostgresUserRepo();
    const issues = new PostgresIssueRepo();
    const checklist = new PostgresChecklistRepo();
    const auth = new PostgresAuthRepo();
    const columns = new PostgresBoardColumnRepo();
    singleton = {
      board: new BoardService({ projects, sprints, users, issues, columns }),
      issue: new IssueService({ projects, users, issues, columns }),
      checklist: new ChecklistService({ projects, issues, checklist }),
      auth: new AuthService({ auth, users }),
      profile: new ProfileService({ auth, users }),
      admin: new AdminService({ users, projects, issues, columns }),
      session: { authRepo: auth },
    };
  }
  return singleton;
}
