import express from 'express';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import cors from 'cors';
import path from 'path';

// Creates a client
const client = new ImageAnnotatorClient({
  keyFilename: path.join(__dirname, 'designsphere-449012-0f316c3be44b.json'), // Path to your service account key file
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/analyze-image', async (req, res) => {
  const { imageUri } = req.body;
  try {
    const [result] = await client.labelDetection(imageUri);
    const labels = result.labelAnnotations;
    res.json(labels);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});