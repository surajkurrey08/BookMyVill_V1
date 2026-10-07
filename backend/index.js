const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Load root .env first
require('dotenv').config({
  path: path.join(__dirname, '../.env'),
});

// Then backend/.env can override/fill missing values
require('dotenv').config();

// Disable Mongoose command buffering
mongoose.set('bufferCommands', false);

const app = express();

// nginx on the same host terminates TLS and forwards client IP
app.set('trust proxy', 'loopback');

// ======================================================
// Middleware
// ======================================================

app.use(require('./services/cors'));

app.use(
  express.json({
    limit: '50mb',
  })
);

app.use(
  express.urlencoded({
    limit: '50mb',
    extended: true,
  })
);

// ======================================================
// Health Check
// ======================================================

app.get('/api/health', (req, res) => {
  const databaseReady =
    mongoose.connection.readyState === 1;

  res
    .status(databaseReady ? 200 : 503)
    .json({
      status: databaseReady
        ? 'ok'
        : 'database_unavailable',
      database: databaseReady
        ? 'connected'
        : 'disconnected',
    });
});

// ======================================================
// Request Logger
// ======================================================

app.use((req, res, next) => {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`
  );

  next();
});

// ======================================================
// Routes
// ======================================================

// Legacy all-in-one mode: every microservice in one process, from the same
// catalog the API Gateway uses. Production runs the gateway + services instead.
{
  const { createLogger } = require('./shared/logger');
  const { mountAll, startAllConsumers } = require('./shared/runService');
  const logger = createLogger('all-in-one');
  // Internal service calls loop back to this process in all-in-one mode.
  for (const name of Object.keys(require('./shared/serviceCatalog').SERVICES)) {
    const key = `${name.replace(/-/g, '_').toUpperCase()}_URL`;
    if (!process.env[key]) process.env[key] = `http://127.0.0.1:${process.env.PORT || 2001}`;
  }
  const independent = mountAll(app);
  mongoose.connection.once('connected', async () => {
    // Service-owned databases (same cluster; see shared/database.js) and event consumers.
    await Promise.all(independent.map(def => def.database.connect(logger)));
    await startAllConsumers(logger);
  });
}

// ======================================================
// Environment Status
// ======================================================

console.log(
  'Using MongoDB URI:',
  process.env.MONGODB_URI
    ? 'FOUND'
    : 'MISSING'
);

console.log(
  'Using JWT Secret:',
  process.env.JWT_SECRET
    ? 'FOUND'
    : 'MISSING'
);

// ======================================================
// Models
// ======================================================

const User = require('./models/User');

// ======================================================
// Seed Default Admin / Owner
// ======================================================

async function seedAdminUser() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    // -------------------------------
    // Admin
    // -------------------------------

    const adminEmail = 'admin@gmail.com';

    let admin = await User.findOne({
      email: adminEmail,
    });

    if (!admin) {
      console.log(
        'No admin user found. Creating default admin...'
      );

      admin = new User({
        name: 'Administrator',
        email: adminEmail,
        password: 'admin123',
        role: 'admin',
      });

      await admin.save();

      console.log(
        '✅ Default admin user created successfully!'
      );

      console.log(
        '   Email: admin@gmail.com'
      );

      console.log(
        '   Password: admin123'
      );
    } else {
      console.log(
        'Admin user already exists:',
        adminEmail
      );
    }

    // -------------------------------
    // Owner
    // -------------------------------

    const ownerEmail =
      'owner@mahabaleshwarstays.com';

    let owner = await User.findOne({
      email: ownerEmail,
    });

    if (!owner) {
      owner = new User({
        name: 'Property Owner Host',
        email: ownerEmail,
        password: 'password123',
        role: 'owner',
        phone: '9876543210',
      });

      await owner.save();

      console.log(
        '✅ Default owner user created successfully!'
      );
    } else {
      console.log(
        'Owner user already exists:',
        ownerEmail
      );
    }
  } catch (err) {
    console.error(
      'Error seeding admin/owner users:',
      err.message
    );
  }
}

// ======================================================
// MongoDB URI Resolver
// ======================================================

const { resolveMongoUri } = require('./services/databaseConfig');

// ======================================================
// Redact MongoDB Credentials
// ======================================================

function redactUri(uri) {
  try {
    return uri.replace(
      /\/\/([^:@/]+):([^@/]+)@/,
      '//$1:***@'
    );
  } catch {
    return '[MongoDB URI hidden]';
  }
}

// ======================================================
// Initialize Database
// ======================================================

async function initializeDatabase() {
  // Rebuild User indexes
  try {
    await User.syncIndexes();

    console.log(
      '✅ User indexes synchronized.'
    );
  } catch (idxErr) {
    console.error(
      'User index sync notice:',
      idxErr.message
    );
  }

  // Build indexes for all loaded models
  try {
    const {
      ensureModelIndexes,
    } = require('./utils/modelIndexes');

    await Promise.all(
      Object.values(
        mongoose.models
      ).map(async (model) => {
        try {
          await ensureModelIndexes(
            model
          );
        } catch (idxErr) {
          console.error(
            `Index build notice for ${model.modelName}:`,
            idxErr.message
          );
        }
      })
    );
  } catch (err) {
    console.error(
      'Model index initialization notice:',
      err.message
    );
  }

  await seedAdminUser();
}

// ======================================================
// MongoDB Connection
// ======================================================

async function connectDB() {
  let uri;

  try {
    uri = resolveMongoUri();
  } catch (error) {
    console.error(
      '❌ MongoDB configuration error:',
      error.message
    );

    return;
  }

  // Optional per-process DNS resolver for networks that refuse Atlas SRV lookups.
  if (process.env.MONGODB_DNS_SERVERS) require('node:dns').setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean));

  const maxAttempts =
    Number(
      process.env
        .MONGODB_CONNECT_ATTEMPTS
    ) || 30;

  const retryDelayMs =
    Number(
      process.env
        .MONGODB_CONNECT_RETRY_MS
    ) || 3000;

  console.log(
    'Connecting to MongoDB at',
    redactUri(uri)
  );

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });

      console.log(
        `✅ MongoDB connected successfully (attempt ${attempt}/${maxAttempts}).`
      );

      console.log(
        `📦 Database: ${
          mongoose.connection.name
        }`
      );

      await initializeDatabase();

      return;
    } catch (err) {
      console.error(
        `❌ MongoDB connection attempt ${attempt}/${maxAttempts} failed:`,
        err.message
      );

      if (
        attempt < maxAttempts
      ) {
        console.log(
          `Retrying in ${
            retryDelayMs / 1000
          } seconds...`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              retryDelayMs
            )
        );
      }
    }
  }

  console.error(
    '⚠️ Could not reach MongoDB after multiple attempts.'
  );

  console.error(
    '/api/health will return 503 until MongoDB becomes available.'
  );
}

// ======================================================
// MongoDB Events
// ======================================================

mongoose.connection.on(
  'connected',
  () => {
    console.log(
      '🟢 Mongoose connected to MongoDB.'
    );
  }
);

mongoose.connection.on(
  'error',
  (err) => {
    console.error(
      '🔴 MongoDB connection error:',
      err.message
    );
  }
);

mongoose.connection.on(
  'disconnected',
  () => {
    console.warn(
      '🟡 MongoDB disconnected.'
    );
  }
);

// ======================================================
// Global Error Handler
// ======================================================

app.use(
  (err, req, res, next) => {
    console.error(
      'Unhandled API error:',
      err
    );

    if (
      res.headersSent
    ) {
      return next(err);
    }

    res.status(
      err.status || 500
    ).json({
      success: false,
      message:
        err.message ||
        'Internal server error',
    });
  }
);

// ======================================================
// Server
// ======================================================

const PORT =
  process.env.PORT || 2001;

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🚀 Server running on port ${PORT}`
    );

    connectDB().catch(
      (err) => {
        console.error(
          'Database connection process error:',
          err
        );
      }
    );
  }
);

// ======================================================
// Graceful Shutdown
// ======================================================

async function shutdown(
  signal
) {
  console.log(
    `\n${signal} received. Shutting down...`
  );

  try {
    await mongoose.connection.close();

    console.log(
      '✅ MongoDB connection closed.'
    );
  } catch (error) {
    console.error(
      'Error closing MongoDB:',
      error.message
    );
  }

  process.exit(0);
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);
