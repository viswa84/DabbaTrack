const { createToken } = require('../../auth');
const { requireAuth, requireAdmin } = require('../../utils/permissions');
const usersRepo = require('./repository');
const { requireValidIndianMobile } = require('../../utils/validators');

const CUSTOMER_OTP = process.env.CUSTOMER_OTP || '1234';
const VENDOR_OTP = process.env.VENDOR_OTP || '2345';

const resolvers = {
  Query: {
    me: (_parent, _args, context) => {
      requireAuth(context.user);
      return context.user;
    },
  },
  Mutation: {
    login: async (_parent, args) => {
      const normalizedPhone = requireValidIndianMobile(args.phone, 'User phone');
      const user = await usersRepo.findByPhone(normalizedPhone);
      if (!user) {
        throw new Error('User not found');
      }
      const expectedOtp = user.role === 'CUSTOMER' ? CUSTOMER_OTP : VENDOR_OTP;
      if (args.otp !== expectedOtp) {
        throw new Error('Invalid OTP');
      }
      const token = createToken(user);
      return { token, user, message: 'User authenticated successfully' };
    },
    createUser: async (_parent, args, context) => {
      // requireAdmin(context.user);
      return usersRepo.createUser({
        ...args.input,
        role: args.input.role || 'DISPATCH',
      });
    },
    updateUser: async (_parent, args, context) => {
      requireAdmin(context.user);
      return usersRepo.updateUser(args.id, args.input);
    },
  },
};

module.exports = resolvers;
