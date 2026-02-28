import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import { ApiError } from './ApiError';

export const validateFileSignature = async (file: Express.Multer.File) => {
    // 1. Check if the buffer exists (Keploy/Multer usually provides this)
    if (!file.buffer) {
        throw new ApiError(400, "File buffer is missing. Cannot perform security scan.");
    }

    // 2. Read Magic Bytes
    const type = await fileTypeFromBuffer(file.buffer);

    // 3. Get extension from the filename
    const providedExt = file.originalname.split('.').pop()?.toLowerCase();

    // 4. Verification Logic
    if (!type) {
        throw new ApiError(415, "Security Alert: Unrecognized file signature (Magic Bytes missing).");
    }

    // Check for Spoofing (e.g. hack.exe -> hack.jpg)
    // We allow jpg/jpeg interchangeability
    const isJpeg = (type.ext === 'jpg') && (providedExt === 'jpg' || providedExt === 'jpeg');

    if (type.ext !== providedExt && !isJpeg) {
        throw new ApiError(400, `MIME Spoofing Detected! Content is actually ${type.ext}, but extension claims to be ${providedExt}.`);
    }

    // 5. Whitelist allowed types (Optional but recommended)
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'zip', 'docx'];
    if (!allowedExtensions.includes(type.ext)) {
        throw new ApiError(403, `File type ${type.ext} is not permitted on this platform.`);
    }

    return type;
};