const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type TiffinPlan {
    id: ID!
    customerId: ID!
    startDate: String!
    billingCycle: BillingCycle!
    monthlyRate: Float!
    status: String!
    lastPaymentStatus: String
    lastPaymentAt: String
  }

  input PlanInput {
    customerId: ID!
    monthlyRate: Float!
    billingCycle: BillingCycle!
    startDate: String!
  }

  input PaymentInput {
    customerId: ID!
    status: String!
    paidAt: String
  }

  extend type Mutation {
    upsertPlan(input: PlanInput!): TiffinPlan!
    markPayment(input: PaymentInput!): TiffinPlan!
  }
`;

module.exports = typeDefs;
