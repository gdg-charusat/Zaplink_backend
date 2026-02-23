import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import { customAlphabet } from "nanoid";

// Opaque, cryptographically random ID — prevents URL enumeration & filename leaks
const generateFileId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  12
);

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const fileName = file?.originalname || "";
    // Preserve extension for correct Cloudinary MIME handling
    const dotIndex = fileName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? fileName.substring(dotIndex) : "";

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
      folder: "zaplink_folders",
      resource_type,
      public_id: `${generateFileId()}${ext}`,
    };
  },
});

const upload = multer({ storage });

export default upload;
