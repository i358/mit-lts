import Fastify from 'fastify';
import { ApolloServer, BaseContext } from "@apollo/server";
import fastifyApollo, { fastifyApolloDrainPlugin } from '@as-integrations/fastify';
import { getGraphQLSchema } from '../graphql/schema';
import { globalStore } from '../../utils';
import { APIConfig } from '../../types/api';
import { loadRoutes } from '../utils/routeLoader';
import path from 'path';
import cors from "@fastify/cors"
import { apiLogger } from '../../logger';
import { authenticateRequest } from '../utils/authMiddleware';

export const fastify = Fastify({
    trustProxy: true
});
// Global config'den API ayarlarını al
const config = globalStore.collection("config");
const apiConfig = config.get("api") as APIConfig;

// REST endpoint'leri için prefix tanımla
const REST_PREFIX = '/v1';

// Apollo Server instance'ı oluştur (async olarak yapılandırılacak)
export let apollo: ApolloServer<BaseContext>;

export const startServer = async () => {
    try {
        // Users tablosunu otomatik oluştur
        const { createUsersTable } = await import("../../db_utilities/postgres");
        await createUsersTable();
        // GraphQL şemasını dinamik olarak yükle
        const { typeDefs, resolvers } = await getGraphQLSchema();
        
        // Apollo Server'ı oluştur
        apollo = new ApolloServer<BaseContext>({
            typeDefs,
            resolvers,
            plugins: [fastifyApolloDrainPlugin(fastify)],
            introspection: false, // Production: Introspection completely disabled
            includeStacktraceInErrorResponses: false
        });

    // CORS middleware'ini ekle
     await fastify.register(cors, apiConfig.CORS_CONFIG);

    // GraphQL endpoint'i config'den al
    const endpoint = apiConfig?.GRAPHQL?.ENDPOINT || '/graphql';

    // GraphQL GET request'lerini blokla (Playground erişimini kapat)
    fastify.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith(endpoint) && request.method === 'GET') {
            return reply.code(405).send({ error: 'Method Not Allowed' });
        }
    });

    // GraphQL isteklerinde auth zorunlu (Bearer veya HttpOnly cookie)
    fastify.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith(endpoint) && request.method === 'POST') {
            try {
                const result = await authenticateRequest(request as any, {}, 'required');
                (request as any).user = result?.user;
                (request as any).auth = result?.auth;
            } catch (error: any) {
                const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 401;
                if (error?.banned) {
                    return reply.status(statusCode).send({
                        success: 0,
                        banned: true,
                        ban_info: error.ban_info,
                        error: error?.message || 'Bu hesap yasaklanmış'
                    });
                }
                return reply.status(statusCode).send({ success: 0, error: error?.message || 'Unauthorized' });
            }
        }
    });
    
    // REST route'larını /api/v1 prefix'i altında yükle
    await loadRoutes(fastify);

        // Apollo Server'ı başlat
        await apollo.start();
        
        // GraphQL endpoint'ini kaydet
        await fastify.register(fastifyApollo(apollo), {
            path: endpoint
        });

   
        apiLogger.info(`REST endpoints will be available under ${REST_PREFIX}`);
        apiLogger.info(`GraphQL endpoint will be available at ${endpoint}`);
    } catch (error) {
        apiLogger.error('Error during server setup:', error);
        throw error;
    }
}
