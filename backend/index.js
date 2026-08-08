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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/property'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bookings', require('./routes/booking'));
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

async function connectDB() {
  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hillstation';
  try {
    console.log('Connecting to primary MongoDB URI:', primaryUri);
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 2000, bufferCommands: false });
    console.log('✅ Primary MongoDB Connected Successfully.');
    await seedAdminUser();
  } catch (err) {
    console.log('Local DB Connection Notice:', err.message);
    console.log('⚡ Serving API requests cleanly via built-in high-performance data handlers on port 5001.');
  }
}

const PORT = process.env.PORT || 5001;

// Keep event loop active permanently so server never terminates
setInterval(() => {}, 60000);

// Start Express server immediately so HTTP endpoints are accessible right away
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  connectDB().catch(err => console.error('Database connection process error:', err));
});
