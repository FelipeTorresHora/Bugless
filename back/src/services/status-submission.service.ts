import prisma from "../database/prisma";
import { StatusSubmissionSchema } from "../schemas/status-submission.schema";
import { StatusSubmissionEnum } from "../generated/prisma/enums";


class StatusSubmissionService {
    private readonly defaultStatuses: StatusSubmissionEnum[] = [
        StatusSubmissionEnum.PENDING,
        StatusSubmissionEnum.COMPLETED,
        StatusSubmissionEnum.FAILED,
    ];

    async createStatusSubmission(data: StatusSubmissionSchema){
        const statusSubmission = await prisma.statusSubmission.create({
            data: {
                name: data.name
            }
        })

        if (!statusSubmission) {
            return null;
        }

        return statusSubmission;
    }


    async getAllStatusSubmissions(){
        const statusSubmissions = await prisma.statusSubmission.findMany();

        if (!statusSubmissions) {
            return null;
        }

        return statusSubmissions;
    }

    async getStatusSubmissionById(id: string){
        const statusSubmission = await prisma.statusSubmission.findUnique({
            where: { id }
        });

        if (!statusSubmission) {
            return null;
        }

        return statusSubmission;
    }

    async updateStatusSubmission(id: string, data: StatusSubmissionSchema){
        const statusSubmission = await prisma.statusSubmission.update({
            where: { id },
            data: { name: data.name }
        });

        if (!statusSubmission) {
            return null;
        }

        return statusSubmission;
    }

    async deleteStatusSubmission(id: string){
        const statusSubmission = await prisma.statusSubmission.delete({
            where: { id }
        });

        if (!statusSubmission) {
            return null;
        }
        return statusSubmission;
    }


    async checkIfStatusSubmissionExists(data: StatusSubmissionSchema){
        const statusSubmission = await prisma.statusSubmission.findFirst({
            where: { name: data.name }
        });

        if (!statusSubmission) {
            return false;
        }

        return true;
    }

    async getOrCreateStatusByName(name: StatusSubmissionEnum) {
        const existing = await prisma.statusSubmission.findFirst({
            where: { name }
        });

        if (existing) {
            return existing;
        }

        return prisma.statusSubmission.create({
            data: { name }
        });
    }

    async ensureDefaultStatuses() {
        for (const status of this.defaultStatuses) {
            await this.getOrCreateStatusByName(status);
        }
    }

}

const statusSubmissionService = new StatusSubmissionService();

export default statusSubmissionService;
