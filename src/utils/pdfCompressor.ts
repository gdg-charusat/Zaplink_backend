import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

/**
 * Compresses a PDF file using pdf-lib
 * 
 * @param inputPath - Path to the input PDF file
 * @param outputPath - Path to save the compressed PDF file
 * @returns Promise<void>
 */
export async function compressPDF(inputPath: string, outputPath: string): Promise<void> {
  try {
    console.log('Processing PDF:', inputPath);
    
    // Read the existing PDF file
    const pdfBytes = await fs.promises.readFile(inputPath);
    console.log('PDF read, size:', pdfBytes.length);
    
    // Load and re-save to ensure valid PDF structure
    const pdfDoc = await PDFDocument.load(pdfBytes);
    console.log('PDF loaded, pages:', pdfDoc.getPageCount());
    
    // Save with compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
    });
    console.log('PDF saved, size:', compressedBytes.length);
    
    // Write to output
    await fs.promises.writeFile(outputPath, compressedBytes);
    console.log('PDF written:', outputPath);
  } catch (error) {
    console.error('PDF processing failed:', error);
    // If compression fails, copy original file
    await fs.promises.copyFile(inputPath, outputPath);
    console.log('Fell back to copying original file');
  }
}

export default { compressPDF };