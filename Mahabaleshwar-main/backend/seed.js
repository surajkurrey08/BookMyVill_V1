const mongoose = require('mongoose');
const Property = require('./models/Property');
const User = require('./models/User');
require('dotenv').config();

const seedProperty = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Find the first user to be the owner
    const owner = await User.findOne();
    if (!owner) {
      console.log('No users found. Please register an account on the website first!');
      process.exit();
    }

    const exampleProperty = new Property({
      owner: owner._id,
      name: "Skyline Luxury Resort",
      type: "Resort",
      location: "Ooty, Tamil Nadu",
      price: 18000,
      photos: ["https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&q=80&w=1200"],
      status: "approved"
    });

    await exampleProperty.save();
    console.log('✅ Example Property "The Golden Peak Villa" created successfully!');
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedProperty();
