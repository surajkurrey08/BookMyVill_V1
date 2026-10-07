const User = require('../models/User');

// Development convenience kept from the original server: default admin and
// owner accounts when they are missing. Never runs in production.
async function seedDefaultAccounts(logger) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    await User.syncIndexes();
    const defaults = [
      { name: 'Administrator', email: 'admin@gmail.com', password: 'admin123', role: 'admin' },
      { name: 'Property Owner Host', email: 'owner@mahabaleshwarstays.com', password: 'password123', role: 'owner', phone: '9876543210' }
    ];
    for (const account of defaults) {
      if (await User.exists({ email: account.email })) continue;
      await new User(account).save();
      logger.info('default development account created', { email: account.email, role: account.role });
    }
  } catch (error) {
    logger.warn('default account seeding skipped', { error });
  }
}

module.exports = { seedDefaultAccounts };
