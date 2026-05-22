import express from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_REGION, S3_BUCKET } from '../config.js';

const router = express.Router();
const s3 = new S3Client({ region: AWS_REGION });

router.post('/', async (req, res) => {
  const { filename, contentType } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' });
  }

  if (!S3_BUCKET || !AWS_REGION) {
    return res.status(500).json({ error: 'Server is not configured for S3. Set AWS_REGION and S3_BUCKET.' });
  }

  const safeName = filename.replace(/[\\\\/ ]+/g, '_');
  const key = `${Date.now()}-${safeName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 60 });
    const publicUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(key)}`;

    res.json({ url, publicUrl });
  } catch (error) {
    console.error('Failed to sign S3 request', error);
    res.status(500).json({ error: 'Failed to create S3 presigned URL' });
  }
});

export default router;
