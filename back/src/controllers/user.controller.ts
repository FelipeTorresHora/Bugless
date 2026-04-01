import { Request, Response } from "express";
import userService from "../services/user.service";
import HttpHelper from "../utils/http-helper";

class UserController {

    /**
     * GET /users/me
     * Retorna o perfil do usuário autenticado.
     * Inclui `hasApiKey` (boolean) para que o CLI saiba se a key está configurada,
     * sem nunca expor a chave criptografada.
     */
    async getProfile(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return HttpHelper.unauthorized(res, "Token inválido");
            }

            const user = await userService.getUserProfileById(userId);

            if (!user) {
                return HttpHelper.notFound(res, "Usuário não encontrado");
            }

            return HttpHelper.success(res, {
                id: user.id,
                name: user.name,
                email: user.email,
                hasApiKey: user.hasApiKey,
                activeProvider: user.activeProvider,
                plan: user.plan,
            }, "Perfil carregado com sucesso");
        } catch (error) {
            console.error("[UserController] Erro em getProfile:", error);
            return HttpHelper.serverError(res);
        }
    }
}

const userController = new UserController();

export default userController;
