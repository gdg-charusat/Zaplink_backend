import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const {
  CLOUDINARY_URL,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  NODE_ENV,
} = process.env;

let isConfigured = false;

try {
  if (CLOUDINARY_URL) {
    const urlParams = CLOUDINARY_URL.replace("cloudinary://", "");
    const [auth, cloud_name] = urlParams.split("@");

    if (!auth || !cloud_name) {
      throw new Error("Invalid CLOUDINARY_URL format.");
    }

    const [api_key, api_secret] = auth.split(":");

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
    });

    isConfigured = true;

  } else if (
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });

    isConfigured = true;
  }

  if (isConfigured) {
    const config = cloudinary.config();

    if (!config.cloud_name) {
      throw new Error("Cloudinary configuration failed: cloud_name missing.");
    }

    console.log("✅ Cloudinary configured successfully");
  } else {
    const message =
      "Cloudinary is not configured. Please set CLOUDINARY_URL or " +
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.";

    if (NODE_ENV === "production") {
      throw new Error(message);
    } else {
      console.warn("⚠️ " + message);
    }
  }
} catch (error) {
  console.error("❌ Cloudinary configuration error:", error);

  if (NODE_ENV === "production") {
    throw error;
  }
}

export default cloudinary;