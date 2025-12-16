const { requireAdmin } = require('../../utils/permissions');
const plansRepo = require('./repository');

const resolvers = {
  Mutation: {
    upsertPlan: async (_parent, args, context) => {
      requireAdmin(context.user);
      return plansRepo.upsertPlan(args.input);
    },
    markPayment: async (_parent, args, context) => {
      requireAdmin(context.user);
      return plansRepo.markPayment(args.input);
    },
  },
};

module.exports = resolvers;
