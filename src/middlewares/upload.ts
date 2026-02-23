import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const fileName = file?.originalname;
    const ext = fileName.substring(fileName.lastIndexOf('.'));

    const { type } = req.body;
    let resource_type = "raw";

    if (type === "IMAGE" || type === "PDF") {
      resource_type = "image";
    } else if (type === "VIDEO") {
      resource_type = "video";
    } else {
      resource_type = "raw"
    }

    return {
      folder: 'zaplink_folders',
      resource_type,
      public_id: `${nanoid()}${ext}`
    }
  }
});

const upload = multer({ storage });

export default upload;
