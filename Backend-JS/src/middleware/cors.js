// src/middleware/cors.js

const cors = require('cors');

/**
 * Configure CORS middleware
 * Allows requests from http/https on port 8081
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Regex to match http/https on port 8081
    const port8081Regex = /^https?:\/\/.*:8081$/;
    
    if (port8081Regex.test(origin)) {
      callback(null, true);
    } else {
      // Allow all origins for development (comment out for production)
      callback(null, true);
      // Production: callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = cors(corsOptions);
