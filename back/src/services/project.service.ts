import prisma from "../database/prisma";
import { CreateProjectSchema, FindOrCreateProjectSchema, ProjectIdSchema, UpdateProjectSchema } from "../schemas/project.schema";
import { GetUserByIdSchema } from "../schemas/user.schema";

class ProjectService {
    private countMatches(source: string | null | undefined, pattern: RegExp): number {
        if (!source) return 0;
        const matches = source.match(pattern);
        return matches ? matches.length : 0;
    }

    private parseScore(summary: string | null | undefined): number | null {
        if (!summary) return null;
        const scoreMatch = summary.match(/score:\s*(\d{1,3})\s*\/\s*100/i);
        if (!scoreMatch) return null;
        const parsed = Number(scoreMatch[1]);
        return Number.isFinite(parsed) ? parsed : null;
    }

    async createProject(data: CreateProjectSchema) {
        return await prisma.project.create({
            data: {
                name: data.name,
                description: data.description,
                userId: data.userId,
                repositoryUrl: data.repositoryUrl,
                repositoryPath: data.repositoryPath,
                language: data.language,
                customInstructions: data.customInstructions,
            }
        });
    }

    async getProjectById(projectId: ProjectIdSchema) {
        return await prisma.project.findUnique({
            where: { id: projectId.id }
        });
    }

    async getAllProjectsByUserId(idUser: GetUserByIdSchema) {
        return await prisma.project.findMany({
            where: {
                userId: idUser.id
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async updateProject(projectId: ProjectIdSchema, dataProject: UpdateProjectSchema) {
        const project = await prisma.project.update({
            where: { id: projectId.id },
            data: {
                ...dataProject,
                updatedAt: new Date(),
            }
        });

        if(!project){
            return null
        }

        return project
    }

    async checkIfProjectExists(data: CreateProjectSchema) {
        const count = await prisma.project.count({
            where: {
                name: data.name,
                userId: data.userId
            }
        });
        return count > 0;
    }

    async deleteProject(projectId: ProjectIdSchema) {
        const project = await prisma.project.delete({
            where: { id: projectId.id }
        });

        if(!project){
            return null
        }

        return project
    }

    async findOrCreateByRepo(data: FindOrCreateProjectSchema) {
        // Try to find existing project with same repositoryUrl and userId
        const existingProject = await prisma.project.findFirst({
            where: {
                repositoryUrl: data.repositoryUrl,
                userId: data.userId
            }
        });

        if (existingProject) {
            return { project: existingProject, created: false };
        }

        // Create new project
        const newProject = await prisma.project.create({
            data: {
                name: data.name,
                repositoryUrl: data.repositoryUrl,
                userId: data.userId,
            }
        });

        return { project: newProject, created: true };
    }

    async getProjectsWithStats(userId: string) {
        const projects = await prisma.project.findMany({
            where: { userId },
            include: {
                submissions: {
                    include: {
                        statusSubmission: true,
                        reviews: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return projects.map((project) => {
            const completedSubmissions = project.submissions.filter(
                (submission) => submission.statusSubmission.name === "COMPLETED"
            );

            const reviews = completedSubmissions.flatMap((submission) => submission.reviews);
            const scoreValues = reviews
                .map((review) => this.parseScore(review.summary))
                .filter((score): score is number => score !== null);

            const issues = reviews.map((review) => review.detectedIssues).filter(Boolean);
            const totalIssues = issues.reduce(
                (acc, content) =>
                    acc +
                    this.countMatches(content, /\[!!\]|\[!\]|\[\*\]|\[i\]|^-|\*/gim),
                0
            );
            const securityIssues = issues.reduce(
                (acc, content) =>
                    acc +
                    this.countMatches(content, /security|xss|sql|injection|token|credential|auth/i),
                0
            );
            const performanceIssues = issues.reduce(
                (acc, content) =>
                    acc + this.countMatches(content, /performance|slow|latency|memory|cache|cpu|n\+1/i),
                0
            );

            const averageScore = scoreValues.length
                ? Number((scoreValues.reduce((acc, score) => acc + score, 0) / scoreValues.length).toFixed(1))
                : null;

            return {
                id: project.id,
                name: project.name,
                repositoryUrl: project.repositoryUrl,
                createdAt: project.createdAt,
                stats: {
                    submissionsTotal: project.submissions.length,
                    completedReviews: completedSubmissions.length,
                    totalIssues,
                    securityIssues,
                    performanceIssues,
                    averageScore,
                },
            };
        });
    }
}

const projectService = new ProjectService();

export default projectService;
