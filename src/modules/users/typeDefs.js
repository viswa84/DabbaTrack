const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String
    phone: String
    role: Role!
    description: String
    handlesLunch: Boolean!
    handlesDinner: Boolean!
  }

  type AuthPayload {
    token: String!
    user: User!
    message: String!
  }

  type OtpRequest {
    success: Boolean!
    message: String!
    otp: String
  }

  input CreateUserInput {
    name: String!
    email: String
    phone: String!
    description: String
    role: Role
    handlesLunch: Boolean!
    handlesDinner: Boolean!
  }

  input UpdateUserInput {
    name: String
    email: String
    phone: String
    description: String
    role: Role
    handlesLunch: Boolean
    handlesDinner: Boolean
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    requestOtp(phone: String!, role: Role): OtpRequest!
    login(phone: String!, otp: String!, role: Role): AuthPayload!
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
  }
`;

module.exports = typeDefs;
