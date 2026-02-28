import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import { logger } from './logger';

/**
 * Compresses a PDF file using pdf-lib
 * 
 * @param inputPath - Path to the input PDF file
 * @param outputPath - Path to save the compressed PDF file
 * @returns Promise<void>
 */
export async function compressPDF(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.debug('Processing PDF:', { file: inputPath });
    
    // Read the existing PDF file
    const pdfBytes = await fs.promises.readFile(inputPath);
    logger.debug('PDF read', { size: pdfBytes.length });
    
    // Load and re-save to ensure valid PDF structure
    const pdfDoc = await PDFDocument.load(pdfBytes);
    logger.debug('PDF loaded', { pages: pdfDoc.getPageCount() });
    
    // Save with compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
    });
    logger.debug('PDF saved', { size: compressedBytes.length });
    
    // Write to output
    await fs.promises.writeFile(outputPath, compressedBytes);
    logger.debug('PDF written to output');
  } catch (error) {
    logger.error('PDF processing failed', error);
    // If compression fails, copy original file
    await fs.promises.copyFile(inputPath, outputPath);
    logger.debug('Fell back to copying original file');
  }
}

export default { compressPDF };