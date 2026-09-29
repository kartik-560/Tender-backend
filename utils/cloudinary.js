import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';

let isCloudinaryConfigured = false;

if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  isCloudinaryConfigured = true;
}

/**
 * Uploads a document buffer directly to Cloudinary
 * Primary and persistent storage for all uploaded files
 */
export async function uploadDocument(file) {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary is not configured. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in environment variables.'
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'tender_rfp_docs',
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

/**
 * Deletes a document from Cloudinary by its publicId
 */
export async function deleteDocument(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured || !publicId) return;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.warn(`Failed to delete Cloudinary asset ${publicId}:`, err.message);
  }
}

export default { uploadDocument, deleteDocument };
