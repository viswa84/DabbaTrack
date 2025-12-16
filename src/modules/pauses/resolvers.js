const { requireAuth } = require('../../utils/permissions');
const pausesRepo = require('./repository');

const resolvers = {
  Mutation: {
    setPauseWindow: async (_parent, args, context) => {
      requireAuth(context.user);
      return pausesRepo.createPauseWindow({
        customerId: args.input.customerId,
        startDate: args.input.startDate,
        endDate: args.input.endDate,
        reason: args.input.reason,
        createdBy: context.user.id,
      });
    },
  },
};

module.exports = resolvers;
