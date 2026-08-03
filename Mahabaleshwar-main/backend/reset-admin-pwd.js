
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const URI = 'mongodb://127.0.0.1:27017/hillstation';
const User = require('./models/User');

async function run() {
  try {
    await mongoose.connect(URI);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await User.updateOne({ email: 'admin@gmail.com' }, { password: hashedPassword });
    console.log('Password for admin@gmail.com reset to admin123');
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
