export interface UserData {
    id: string | number;
    username: string;
    figure?: string;
    motto?: string;
    look?: string;
    index?: number;
    lastSeen?: number;
}

export interface UserTimeData {
    storedTotal: number;
    currentSessionTime: number;
    realTimeTotal: number;
    isActive: boolean;
    lastSeen: number | null;
}

export interface GraphQLContext {
    // Context tiplerini buraya ekleyebilirsiniz
}

export interface QueryResolvers {
    user: (parent: any, args: { 
        id?: string | number;
        username?: string;
        index?: number;
    }, context: GraphQLContext) => Promise<any>;
    
    users: (parent: any, args: any, context: GraphQLContext) => Promise<any[]>;
    
    activeUsers: (parent: any, args: any, context: GraphQLContext) => Promise<any[]>;
    
    topUsers: (parent: any, args: { 
        limit?: number;
    }, context: GraphQLContext) => Promise<any[]>;
}