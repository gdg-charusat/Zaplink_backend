import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import { customAlphabet } from "nanoid";
import path from "path";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req: any, file: any) => {
    const ext = path.extname(file.originalname);

    const { type } = req.body;
    let resource_type = "raw";

    if (type === "IMAGE" || type === "PDF") {
      resource_type = "image";
    } else if (type === "VIDEO") {
      resource_type = "video";
    } else {
      resource_type = "raw";
    }

    return {
      folder: 'zaplink_folders',
      resource_type,
      public_id: `${nanoid()}${ext}`
    };
  }
});

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

export default upload;
