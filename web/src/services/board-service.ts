import type { IssueRepo, ProjectRepo, SprintRepo, UserRepo } from '@/domain/repositories';
import type { Board, ProjectSummary, Sprint } from '@/domain/types';
import { sortIssuesForBoard } from '@/domain/types';
import { NotFoundError } from '@/domain/errors';

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
}

export class BoardService {
  constructor(private readonly deps: BoardServiceDeps) {}

  async listProjectSummaries(): Promise<ProjectSummary[]> {
    const projects = await this.deps.projects.list();
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

  async getBoard(projectKey: string): Promise<Board> {
    const project = await this.deps.projects.getByKey(projectKey);
    if (!project) throw new NotFoundError(`Project ${projectKey} not found`);
    const [rawSprint, users, issues] = await Promise.all([
      this.deps.sprints.getActiveForProject(project.id),
      this.deps.users.list(),
      this.deps.issues.listByProject(project.id),
    ]);
    const sprint: Sprint | null = rawSprint ? { ...rawSprint, daysLeft: daysLeftFrom(rawSprint.endsAt) } : null;
    return { project, sprint, users, issues: sortIssuesForBoard(issues) };
  }
}
