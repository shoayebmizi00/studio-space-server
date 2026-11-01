
import express from 'express';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
import cors from 'cors';

app.use(cors());
app.use(express.json());

const app = express();

const PORT = process.env.PORT || 5000;

// Check MongoDB connection string
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is missing from .env file');
}

// Create MongoDB client
const client = new MongoClient(process.env.MONGODB_URI);

// Connect to MongoDB
export async function connectToMongoDB() {
  try {
    await client.connect();

    console.log('You successfully connected to MongoDB!');

    return client;
  } catch (err) {
    // Handle connection errors
    console.error('MongoDB connection failed:', err);
    throw err;
  }
}

const db = client.db('studio-space-a8');

app.post('/add-studio', async (req, res) => {
  try {
    const { name, location } = req.body;
  } catch (err) {
    console.error('Error adding studio:', err);
    res.status(500).json({ error: 'Failed to add studio' });
  }
});


app.get('/', (req, res) => {
  res.send('This is from Server');
});

// Connect to MongoDB before starting server
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
