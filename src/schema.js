const baseTypeDefs = require('./modules/base/typeDefs');
const users = require('./modules/users');
const customers = require('./modules/customers');
const attendance = require('./modules/attendance');
const pauses = require('./modules/pauses');
const plans = require('./modules/plans');
const dashboard = require('./modules/dashboard');

const typeDefs = [
  baseTypeDefs,
  users.typeDefs,
  customers.typeDefs,
  attendance.typeDefs,
  pauses.typeDefs,
  plans.typeDefs,
  dashboard.typeDefs,
];

const resolvers = [
  users.resolvers,
  customers.resolvers,
  attendance.resolvers,
  pauses.resolvers,
  plans.resolvers,
  dashboard.resolvers,
];

module.exports = { typeDefs, resolvers };
