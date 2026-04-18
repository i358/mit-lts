import { startServer, fastify } from './bin/www';
import { apiLogger } from '../logger';
import { globalStore } from '../utils';
import { APIConfig } from '../types/api';

const start = async () => {
    try {
        // Global config'den API ayarlarını al
        const config = globalStore.collection("config");
        const apiConfig = config.get("api") as APIConfig;

        if (!apiConfig) {
            throw new Error("API configuration not found in global store");
        }

        await startServer();
        await fastify.listen({
            port: apiConfig.PORT,
            host: apiConfig.HOST
        });

        const { registerChatWebSocket } = await import('./ws/highRankChat');
        const chatWs = registerChatWebSocket(fastify.server);
        const { registerSiteActivityWebSocket } = await import('./ws/siteActivity');
        const activityWs = registerSiteActivityWebSocket(fastify.server);

        fastify.server.on('upgrade', (request, socket, head) => {
            const path = request.url?.split('?')[0];
            if (path === chatWs.path) chatWs.handleUpgrade(request, socket, head);
            else if (path === activityWs.path) activityWs.handleUpgrade(request, socket, head);
            else socket.destroy();
        });

        apiLogger.info(`Server is running at http://${apiConfig.HOST}:${apiConfig.PORT}${apiConfig.GRAPHQL.ENDPOINT}`);
        
        if (apiConfig.GRAPHQL.PLAYGROUND) {
            apiLogger.info(`GraphQL Playground available at http://${apiConfig.HOST}:${apiConfig.PORT}${apiConfig.GRAPHQL.ENDPOINT}`);
        }
    } catch (err: any) {
        apiLogger.error('Error starting server:', {
            message: err?.message || 'Unknown error',
            stack: err?.stack || 'No stack trace',
            error: JSON.stringify(err, null, 2)
        });
        process.exit(1);
    }
};

export { start };