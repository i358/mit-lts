import { FastifyInstance } from 'fastify';

export default async function healthRoute(fastify: FastifyInstance) {
    fastify.get('/health', async (request, reply) => {
        return { status: 'OK', timestamp: new Date().toISOString() };
    });
}