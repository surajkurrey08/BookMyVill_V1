const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Look in root
require('dotenv').config(); // Fallback to local .env

// Disable Mongoose command buffering so queries fail fast or fallback smoothly instead of hanging indefinitely
mongoose.set('bufferCommands', false);

const app = express();

// nginx on the same host terminates TLS and forwards the client address;
// trusting only the loopback hop gives rate limiting the real guest IP.
app.set('trust proxy', 'loopback');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'database_unavailable' });
});

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/property'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/site-heroes', require('./routes/siteHeroes'));
app.use('/api/bookings', require('./routes/payment'));
app.use('/api/bookings', require('./routes/booking'));
app.use('/api/owner-pms', require('./routes/ownerPms'));
app.use('/api/owner-ops', require('./routes/ownerOps'));
app.use('/api/owner-finance', require('./routes/ownerFinance'));
app.use('/api/owner-crm', require('./routes/ownerCrm'));
app.use('/api/owner-quotes', require('./routes/ownerQuotes'));
app.use('/api/owner-catalog', require('./routes/ownerCatalog'));
app.use('/api/public/quotes', require('./routes/publicQuotes'));
app.use('/api/stay', require('./routes/customerStay'));
app.use('/api/customer-booking', require('./routes/customerBooking'));
app.use('/api/admin-console', require('./routes/adminConsole'));
app.use('/api/caretaker', require('./routes/caretaker'));
app.use('/api/partner', require('./routes/partner'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/tourist-register', require('./routes/touristRegister'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/caretaker-tasks', require('./routes/caretakerTasks'));
app.use('/api/guest-requirements', require('./routes/guestRequirements'));

// DB Connection
console.log('Using MongoDB URI:', process.env.MONGODB_URI ? 'FOUND' : 'MISSING');
console.log('Using JWT Secret:', process.env.JWT_SECRET ? 'FOUND' : 'MISSING');

const User = require('./models/User');

async function seedAdminUser() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const adminEmail = 'admin@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log('No admin user found. Creating default admin...');
      admin = new User({
        name: 'Administrator',
        email: adminEmail,
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin user created successfully!');
      console.log('   Email: admin@gmail.com');
      console.log('   Password: admin123');
    } else {
      console.log('Admin user already exists:', adminEmail);
    }

    // Also seed default owner account
    const ownerEmail = 'owner@mahabaleshwarstays.com';
    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      owner = new User({
        name: 'Property Owner Host',
        email: ownerEmail,
        password: 'password123',
        role: 'owner',
        phone: '9876543210'
      });
      await owner.save();
      console.log('✅ Default owner user created successfully!');
    }
  } catch (err) {
    console.error('Error seeding admin/owner users:', err.message);
  }
}

let mongoMemoryServerInstance = null;

// Resolve the MongoDB connection string. A configured MONGODB_URI is honoured
// only when it is a real connection string; a missing or placeholder value
// (e.g. the sample "YOUR_MONGODB_CONNECTION_STRING") is ignored in favour of the
// MongoDB service bundled with docker-compose, so the stack is self-contained.
function resolveMongoUri() {
  const configured = (process.env.MONGODB_URI || '').trim();
  if (/^mongodb(\+srv)?:\/\//i.test(configured)) return configured;
  if (configured) {
    console.log('Configured MONGODB_URI is not a valid connection string; using the bundled MongoDB service instead.');
  }
  return process.env.MONGODB_FALLBACK_URI || 'mongodb://mongo:27017/bookmyvilla';
}

// Hide any credentials before logging a connection string.
const redactUri = uri => uri.replace(/\/\/[^@/]+@/, '//***@');

async function initializeDatabase() {
  // Rebuild indexes so the User.email unique+sparse change (needed for
  // phone-only guest accounts) replaces any old non-sparse index already
  // on disk from before this field became optional.
  try {
    await User.syncIndexes();
  } catch (idxErr) {
    console.error('User index sync notice:', idxErr.message);
  }
  // Build every model's indexes now that the database is reachable; the
  // unique ones (room nights, quotation tokens, promo codes) guard data
  // integrity. See utils/modelIndexes.js for why this is needed.
  const { ensureModelIndexes } = require('./utils/modelIndexes');
  await Promise.all(Object.values(mongoose.models).map(model => ensureModelIndexes(model).catch(idxErr => {
    console.error(`Index build notice for ${model.modelName}:`, idxErr.message);
  })));
  await seedAdminUser();
}

async function connectDB() {
  const uri = resolveMongoUri();
  const maxAttempts = Number(process.env.MONGODB_CONNECT_ATTEMPTS) || 30;
  const retryDelayMs = Number(process.env.MONGODB_CONNECT_RETRY_MS) || 3000;
  console.log('Connecting to MongoDB at', redactUri(uri));
  // Retry so a database that is still starting up (e.g. the mongo container
  // during a fresh deploy) is waited for instead of dropping into a DB-less
  // state that makes /api/health fail the deployment health check.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, bufferCommands: false });
      console.log(`✅ MongoDB connected successfully (attempt ${attempt}/${maxAttempts}).`);
      await initializeDatabase();
      return;
    } catch (err) {
      console.log(`MongoDB connection attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  console.log('⚠️ Could not reach MongoDB after multiple attempts. /api/health will report 503 until the database is reachable.');
}

const PORT = process.env.PORT || 5001;

// Keep event loop active permanently so server never terminates
setInterval(() => {}, 60000);

// Start Express server immediately so HTTP endpoints are accessible right away
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  connectDB().catch(err => console.error('Database connection process error:', err));
});
