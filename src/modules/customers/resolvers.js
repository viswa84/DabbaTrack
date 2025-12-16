const { requireAuth, vendorScope } = require('../../utils/permissions');
const customersRepo = require('./repository');
const attendanceRepo = require('../attendance/repository');
const pausesRepo = require('../pauses/repository');
const plansRepo = require('../plans/repository');
const usersRepo = require('../users/repository');

const resolvers = {
  Query: {
    customers: async (_parent, args, context) => {
      requireAuth(context.user);
      return customersRepo.listCustomers({
        status: args.status,
        vendorUserId: vendorScope(context.user),
      });
    },
    customer: async (_parent, args, context) => {
      requireAuth(context.user);
      return customersRepo.getCustomer({
        id: args.id,
        vendorUserId: vendorScope(context.user),
      });
    },
  },
  Mutation: {
    createCustomer: async (_parent, args, context) => {
      requireAuth(context.user);
      if (context.user.role === 'CUSTOMER') {
        throw new Error('Customers are not permitted to create customer records');
      }
      const { vendorUserId: requestedVendorId, ...payload } = args.input;
      const vendorUserId = context.user.role === 'ADMIN' ? requestedVendorId : context.user.id;
      if (!vendorUserId) {
        throw new Error('vendorUserId is required to create a customer');
      }
      return customersRepo.createCustomer({
        ...payload,
        vendorUserId,
      });
    },
  },
  Customer: {
    vendor: (customer) =>
      customer.vendorUserId ? usersRepo.findById(customer.vendorUserId) : null,
    plan: (customer) => plansRepo.getPlanForCustomer(customer.id),
    pauseWindows: (customer) => pausesRepo.listByCustomer(customer.id),
    latestAttendance: (customer) => attendanceRepo.latestForCustomer(customer.id),
  },
};

module.exports = resolvers;
