import multer from "multer";
import path from "path";
import fs from "fs";

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

const upload = multer({ storage });

export default upload;