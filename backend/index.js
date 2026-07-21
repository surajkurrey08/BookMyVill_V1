const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Look in root
require('dotenv').config(); // Fallback to local .env

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/property'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bookings', require('./routes/booking'));
app.use('/api/caretaker', require('./routes/caretaker'));

// DB Connection
console.log('Using MongoDB URI:', process.env.MONGODB_URI ? 'FOUND' : 'MISSING');
console.log('Using JWT Secret:', process.env.JWT_SECRET ? 'FOUND' : 'MISSING');

const User = require('./models/User');

async function seedAdminUser() {
  try {
    const adminEmail = 'admin@gmail.com';
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      console.log('No admin user found. Creating default admin...');
      const defaultAdmin = new User({
        name: 'System Admin',
        email: adminEmail,
        password: 'admin123',
        role: 'admin'
      });
      await defaultAdmin.save();
      console.log('✅ Default admin user created successfully!');
      console.log('   Email: admin@gmail.com');
      console.log('   Password: admin123');
    } else {
      console.log('Admin user already exists:', adminEmail);
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected...');
    await seedAdminUser();
  })
  .catch(async (err) => {
    console.log('Local DB Connection Error:', err.message);
    console.log('Attempting to spin up in-memory MongoDB server...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '5.0.26'
        }
      });
      const mongoUri = mongoServer.getUri();
      console.log('In-memory MongoDB started at:', mongoUri);
      
      await mongoose.connect(mongoUri);
      console.log('Connected to In-Memory MongoDB.');
      await seedAdminUser();
    } catch (memErr) {
      console.error('Failed to start in-memory MongoDB:', memErr);
    }
  });

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
