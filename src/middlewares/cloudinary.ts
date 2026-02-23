import { v2 as cloudinary } from "cloudinary";
import dotenv from 'dotenv';
dotenv.config();

if (process.env.CLOUDINARY_URL) {
  const urlParams = process.env.CLOUDINARY_URL.replace('cloudinary://', '');
  const [auth, cloud_name] = urlParams.split('@');
  const [api_key, api_secret] = auth.split(':');

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret
  });
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}
export default cloudinary;
