import { apiLogger } from '../../logger';
import fs from 'fs';
import path from 'path';

interface ResolverMap {
    Query?: { [key: string]: any };
    Mutation?: { [key: string]: any };
    Subscription?: { [key: string]: any };
    [key: string]: any;
}

interface GraphQLSchema {
    typeDefs: any[];
    resolvers: ResolverMap;
}

async function loadGraphQLModules() {
    const typeDefsArray = [];
    const resolversArray = [];
    
    // Base Query type definition
    const baseTypeDefs = `#graphql
        type Query {
            _empty: String
        }
        
        type Mutation {
            _empty: String
        }
    `;
    typeDefsArray.push(baseTypeDefs);
    
    // TypeDefs klasörünü tara
    const typeDefsDir = path.join(__dirname, 'typedefs');
    if (fs.existsSync(typeDefsDir)) {
        const typeDefFiles = fs.readdirSync(typeDefsDir);
        for (const file of typeDefFiles) {
            if ((file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')) {
                try {
                    const module = await import(path.join(typeDefsDir, file));
                    if (module.default && typeof module.default === 'string' && module.default.trim()) {
                        typeDefsArray.push(module.default);
                        apiLogger.debug(`Loaded TypeDefs from: ${file}`);
                    }
                } catch (error) {
                    apiLogger.error(`Error loading TypeDefs from ${file}:`, error);
                }
            }
        }
    }

    // Resolvers klasörünü tara
    const resolversDir = path.join(__dirname, 'resolvers');
    if (fs.existsSync(resolversDir)) {
        const resolverFiles = fs.readdirSync(resolversDir);
        for (const file of resolverFiles) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const module = await import(path.join(resolversDir, file));
                    if (module.default) {
                        resolversArray.push(module.default);
                        apiLogger.debug(`Loaded Resolvers from: ${file}`);
                    }
                } catch (error) {
                    apiLogger.error(`Error loading Resolvers from ${file}:`, error);
                }
            }
        }
    }

    // Resolver'ları akıllıca birleştir
    const mergedResolvers = resolversArray.reduce((acc, resolver) => {
        const merged = { ...acc };
        
        // Her bir tip için kontrol et ve sadece tanımlı olanları ekle
        if (resolver.Query && Object.keys(resolver.Query).length > 0) {
            merged.Query = { ...(merged.Query || {}), ...resolver.Query };
        }
        
        if (resolver.Mutation && Object.keys(resolver.Mutation).length > 0) {
            merged.Mutation = { ...(merged.Mutation || {}), ...resolver.Mutation };
        }
        
        if (resolver.Subscription && Object.keys(resolver.Subscription).length > 0) {
            merged.Subscription = { ...(merged.Subscription || {}), ...resolver.Subscription };
        }
        
        // Diğer özel tipleri ekle (Query, Mutation, Subscription dışındakiler)
        Object.keys(resolver).forEach(key => {
            if (!['Query', 'Mutation', 'Subscription'].includes(key)) {
                merged[key] = { ...(merged[key] || {}), ...resolver[key] };
            }
        });
        
        return merged;
    }, {});

    // Boş objeleri temizle
    const finalResolvers = Object.keys(mergedResolvers).reduce((acc: ResolverMap, key) => {
        if (Object.keys(mergedResolvers[key]).length > 0) {
            acc[key] = mergedResolvers[key];
        }
        return acc;
    }, {} as ResolverMap);

    return {
        typeDefs: typeDefsArray,
        resolvers: finalResolvers
    };
}

// Export a function that loads the schema
export async function getGraphQLSchema() {
    const { typeDefs, resolvers } = await loadGraphQLModules();
    apiLogger.info(`Loaded ${typeDefs.length} TypeDefs and ${Object.keys(resolvers).length} Resolvers`);

    // Filter out any empty type definitions and join them with newlines
    const combinedTypeDefs = typeDefs
        .filter(def => typeof def === 'string' && def.trim())
        .join('\n\n');

    apiLogger.debug('Combined schema:', combinedTypeDefs);

    return { 
        typeDefs: combinedTypeDefs, 
        resolvers 
    };
}