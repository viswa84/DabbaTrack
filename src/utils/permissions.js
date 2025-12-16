function requireAuth(user) {
  if (!user) {
    throw new Error('Authentication required');
  }
}

function requireAdmin(user) {
  requireAuth(user);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin permission required');
  }
}

function vendorScope(user) {
  return user && user.role === 'ADMIN' ? null : user?.id;
}

module.exports = {
  requireAuth,
  requireAdmin,
  vendorScope,
};
