import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

/**
 * Compresses a PDF file by optimizing and reducing size.
 * 
 * @param inputPath - Path to the input PDF file
 * @param outputPath - Path to save the compressed PDF file
 * @returns Promise<void>
 */
export async function compressPDF(inputPath: string, outputPath: string): Promise<void> {
  try {
    console.log('Starting PDF compression:', inputPath);
    
    // Read the existing PDF file
    const existingPdfBytes = await fs.promises.readFile(inputPath);
    console.log('PDF file read, size:', existingPdfBytes.length);
    
    // Load the PDFDocument from the existing bytes
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    console.log('PDF document loaded, pages:', pdfDoc.getPageCount());

    // Serialize the PDFDocument to bytes 
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
    });
    console.log('PDF saved, compressed size:', pdfBytes.length);

    // Write the compressed PDF to file
    await fs.promises.writeFile(outputPath, pdfBytes);
    
    console.log(`PDF compressed successfully: ${inputPath} -> ${outputPath}`);
  } catch (error) {
    console.error('PDF compression failed:', error);
    throw error;
  }
}

/**
 * Estimates the compression ratio of a PDF file.
 * 
 * @param inputPath - Path to the input PDF file
 * @param outputPath - Path to the compressed PDF file
 * @returns Compression ratio as percentage (0-100)
 */
export async function estimateCompressionRatio(inputPath: string, outputPath: string): Promise<number> {
  try {
    const inputStats = await fs.promises.stat(inputPath);
    const outputStats = await fs.promises.stat(outputPath);
    
    const inputSize = inputStats.size;
    const outputSize = outputStats.size;
    
    if (inputSize === 0) return 0;
    
    const compressionRatio = ((inputSize - outputSize) / inputSize) * 100;
    return Math.max(0, Math.min(100, compressionRatio));
  } catch (error) {
    console.error('Failed to estimate compression ratio:', error);
    return 0;
  }
}

/**
 * Gets information about a PDF file including size and page count.
 */
export async function getPDFInfo(filePath: string): Promise<{
  size: number;
  sizeFormatted: string;
  pageCount: number;
}> {
  try {
    const stats = await fs.promises.stat(filePath);
    const size = stats.size;
    
    // Load PDF to get page count
    const pdfBytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const pageCount = pdfDoc.getPageCount();
    
    return {
      size,
      sizeFormatted: formatFileSize(size),
      pageCount,
    };
  } catch (error) {
    console.error('Failed to get PDF info:', error);
    return {
      size: 0,
      sizeFormatted: '0 B',
      pageCount: 0,
    };
  }
}

/**
 * Formats file size in human-readable format.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default {
  compressPDF,
  estimateCompressionRatio,
  getPDFInfo,
};