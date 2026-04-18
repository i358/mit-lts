const typeDefs = `#graphql
  type Query {
    hello: String
    user(username: String!): User
  }

  type User {
    id: ID!
    username: String!
    badge: Int!
    rank: Int!
    extras: [String]
    extrasMap: [ExtraBadge]
  }

  type ExtraBadge {
    type: String!
    badgeName: String!
  }
`

export default typeDefs;