import cloudinary from "../middlewares/cloudinary";

/**
 * Extracts the public_id from a Cloudinary URL and deletes the asset.
 * @param cloudUrl The full Cloudinary URL of the asset.
 */
export const deleteFromCloudinary = async (cloudUrl: string) => {
  try {
    if (!cloudUrl) return;

    // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/zaplink_folders/filename_1234567890.pdf
    
    // 1. Determine resource type
    let resourceType = "raw";
    if (cloudUrl.includes("/image/upload/")) {
      resourceType = "image";
    } else if (cloudUrl.includes("/video/upload/")) {
      resourceType = "video";
    } else if (cloudUrl.includes("/raw/upload/")) {
      resourceType = "raw";
    }

    // 2. Extract public_id
    // The public_id includes the folder structure but excludes the version (v1234567890) and the file extension (for images/videos)
    const urlParts = cloudUrl.split("/");
    const uploadIndex = urlParts.findIndex(part => part === "upload");
    
    if (uploadIndex === -1) {
      console.error("Invalid Cloudinary URL format:", cloudUrl);
      return;
    }

    // Skip the version number (e.g., v1234567890) which is usually right after "upload" if it starts with 'v' and is numeric
    let startIndex = uploadIndex + 1;
    if (urlParts[startIndex].match(/^v\d+$/)) {
      startIndex++;
    }

    const publicIdWithExtension = urlParts.slice(startIndex).join("/");
    
    let publicId = publicIdWithExtension;
    // Cloudinary destroy requires the extension for 'raw' files, but NOT for 'image' or 'video' files
    if (resourceType !== "raw") {
      const lastDotIndex = publicId.lastIndexOf(".");
      if (lastDotIndex !== -1) {
        publicId = publicId.substring(0, lastDotIndex);
      }
    } else {
      // For raw files, if it has a .pdf extension, cloudinary sometimes wants it, sometimes not. 
      // Safe bet: keep the extension for raw files like PDFs, zip, etc. as stored.
    }

    console.log(`Attempting to delete Cloudinary asset: ${publicId} (type: ${resourceType})`);
    
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`Cloudinary deletion result for ${publicId}:`, result);
    
    return result;

  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};
