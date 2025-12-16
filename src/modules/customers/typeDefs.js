const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type Customer {
    id: ID!
    name: String!
    email: String
    phone: String
    address: String
    dietaryNotes: String
    status: String!
    createdAt: String!
    vendorUserId: ID
    vendor: User
    plan: TiffinPlan
    pauseWindows: [PauseWindow!]!
    latestAttendance: [Attendance!]!
  }

  input CustomerInput {
    name: String!
    email: String
    phone: String!
    address: String
    dietaryNotes: String
    vendorUserId: ID
  }

  extend type Query {
    customers(status: String): [Customer!]!
    customer(id: ID!): Customer
  }

  extend type Mutation {
    createCustomer(input: CustomerInput!): Customer!
  }
`;

module.exports = typeDefs;
