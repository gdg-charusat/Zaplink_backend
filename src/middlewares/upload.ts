import multer from "multer";

// Team T066: Enforce memoryStorage so file.buffer is available for Magic Byte checks
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

export default upload;