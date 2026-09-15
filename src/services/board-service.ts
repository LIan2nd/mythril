import { ValidationError } from '@/domain/errors';
import type { BoardColumnRepo, IssueRepo, ProjectRepo, SprintRepo, UpsertSprintInput, UserRepo } from '@/domain/repositories';
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
    const memberCodes = await this.deps.projects.memberCodes(project.id);
    const [rawSprint, columns, issues, users] = await Promise.all([
      this.deps.sprints.getActiveForProject(project.id),
      this.deps.columns.list(project.id),
      this.deps.issues.listByProject(project.id),
      this.deps.users.listAuthByCodes(memberCodes),
    ]);
    const sprint: Sprint | null = rawSprint ? { ...rawSprint, daysLeft: daysLeftFrom(rawSprint.endsAt) } : null;
    return { project, sprint, users, columns, issues: sortIssuesForBoard(issues, columns) };
  }

  async updateSprint(projectKey: string, input: UpsertSprintInput, user: AuthUser): Promise<Sprint> {
    const project = await requireProjectByKey(this.deps.projects, projectKey);
    await requireMembership(this.deps.projects, project.id, user);

    if (input.number < 1) throw new ValidationError('Sprint number must be at least 1');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsAt)) {
      throw new ValidationError('Start date must be in YYYY-MM-DD format');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endsAt)) {
      throw new ValidationError('End date must be in YYYY-MM-DD format');
    }
    if (input.endsAt < input.startsAt) {
      throw new ValidationError('End date cannot be earlier than start date');
    }

    const saved = await this.deps.sprints.upsertActiveForProject(project.id, input);
    return {
      ...saved,
      daysLeft: daysLeftFrom(saved.endsAt),
    };
  }
}
