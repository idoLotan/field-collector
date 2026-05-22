import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT || 3001);
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const AWS_REGION = process.env.AWS_REGION;
export const S3_BUCKET = process.env.S3_BUCKET;
