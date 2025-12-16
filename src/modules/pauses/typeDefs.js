const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type PauseWindow {
    id: ID!
    customerId: ID!
    startDate: String!
    endDate: String!
    reason: String
    createdBy: ID!
  }

  input PauseInput {
    customerId: ID!
    startDate: String!
    endDate: String!
    reason: String
  }

  extend type Mutation {
    setPauseWindow(input: PauseInput!): PauseWindow!
  }
`;

module.exports = typeDefs;
