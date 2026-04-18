const typeDefs = `#graphql
  extend type Query {
    currentUser: User
  }

  extend type Mutation {
    updateUserProfile(username: String, motto: String, figure: String): User
  }
`;

export default typeDefs;