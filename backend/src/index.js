import express from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config.js';
import healthRouter from './routes/health.js';
import signS3Router from './routes/signS3.js';

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/sign-s3', signS3Router);

app.get('/', (req, res) => res.json({ message: 'Field Collector backend is running' }));

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
