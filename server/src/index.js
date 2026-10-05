require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1); // Exit if we can't connect to the DB
  });

app.get('/', (req, res) => {
  res.send('Hello from Engram!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
