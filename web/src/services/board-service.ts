import type { BoardColumnRepo, IssueRepo, ProjectRepo, SprintRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, Board, ProjectSummary, Sprint } from '@/domain/types';
import { sortIssuesForBoard } from '@/domain/types';
import { requireMembership, requireProjectByKey } from './guards';

const DAY_MS = 86_400_000;

export function daysLeftFrom(endsAt: string, now = new Date()): number {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((Date.parse(`${endsAt}T00:00:00Z`) - today.getTime()) / DAY_MS));
}

export interface BoardServiceDeps {
  projects: ProjectRepo;
  sprints: SprintRepo;
  users: UserRepo;
  issues: IssueRepo;
  columns: BoardColumnRepo;
}

export class BoardService {
  constructor(private readonly deps: BoardServiceDeps) {}

  async listProjectSummaries(user: AuthUser): Promise<ProjectSummary[]> {
    const projects =
      user.role === 'admin'
        ? await this.deps.projects.list()
        : await this.deps.projects.listForUser(user.code ?? '');
    return Promise.all(
      projects.map(async (p) => {
        const sprint = await this.deps.sprints.getActiveForProject(p.id);
        return {
          ...p,
          activeSprint: sprint
            ? {
                number: sprint.number,
                kicker: sprint.kicker,
                title: sprint.title,
                daysLeft: daysLeftFrom(sprint.endsAt),
              }
            : null,
        };
      }),
    );
  }

  async getBoard(projectKey: string, user: AuthUser): Promise<Board> {
    const project = await requireProjectByKey(this.deps.projects, projectKey);
    await requireMembership(this.deps.projects, project.id, user);
    const [rawSprint, columns, issues, memberCodes] = await Promise.all([
      this.deps.sprints.getActiveForProject(project.id),
      this.deps.columns.list(),
      this.deps.issues.listByProject(project.id),
      user.role === 'admin' ? Promise.resolve<string[] | null>(null) : this.deps.projects.memberCodes(project.id),
    ]);
    const users =
      memberCodes === null
        ? await this.deps.users.listAuth()
        : await this.deps.users.listAuthByCodes(memberCodes);
    const sprint: Sprint | null = rawSprint ? { ...rawSprint, daysLeft: daysLeftFrom(rawSprint.endsAt) } : null;
    return { project, sprint, users, columns, issues: sortIssuesForBoard(issues, columns) };
  }
}
