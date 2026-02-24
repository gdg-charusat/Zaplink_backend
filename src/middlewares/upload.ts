import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import { customAlphabet } from "nanoid";

// Opaque, cryptographically random ID — prevents URL enumeration & filename leaks
const generateFileId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  12
);

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: (req: any, file: any) => {
//     const fileName = file?.originalname;
//     const ext = fileName.substring(fileName.lastIndexOf('.'));
//     const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

//     const { type } = req.body;
//     let resource_type = "raw";

//     if (type === "IMAGE" || type === "PDF") {
//       resource_type = "image";
//     } else if (type === "VIDEO") {
//       resource_type = "video";
//     } else {
//       resource_type = "raw"
//     }

//     return {
//       folder: 'zaplink_folders',
//       resource_type,
//       public_id: `${baseName}_${Date.now()}${ext}`
//     }
//   }
// });
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const base = path.basename(file.originalname, path.extname(file.originalname));
    const ext = path.extname(file.originalname);
    cb(null, `${base}_${timestamp}${ext}`);
  },
});

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

export default upload;