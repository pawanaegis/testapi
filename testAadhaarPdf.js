import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processAadhaarPdf } from './adhaarDownload/aadhaarPdf.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test function
async function testProcessAadhaarPdf() {
  try {
    // Replace this with your actual test PDF path
    const pdfPath = path.join(__dirname, './download.pdf');

    // Check if the file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`Test PDF file not found at ${pdfPath}`);
      return;
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Pdf = pdfBuffer.toString('base64');

    // Password for the PDF (replace with actual password)
    const pdfPassword = 'PAWA1996'; // Replace with the actual password

    // Crop configuration
    const cropConfigFront = {
      x: 200,
      y: 2380,
      width: 1050,
      height: 700,
    };
    const cropConfigFull = {
      x: 200,
      y: 2380,
      width: 2150,
      height: 700,
    };
    const cropConfigBack = {
      x: 1300,
      y: 2380,
      width: 1050,
      height: 700,
    };
    console.log('Processing Aadhaar PDF...');
    const base64Image = await processAadhaarPdf(
      base64Pdf,
      pdfPassword,
      cropConfigBack
    );

    // Save the resulting image to verify
    const outputImagePath = path.join(
      __dirname,
      'adhaarDownload/temp/output-image.jpg'
    );
    fs.writeFileSync(outputImagePath, Buffer.from(base64Image, 'base64'));

    console.log(`Success! Output image saved to: ${outputImagePath}`);
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testProcessAadhaarPdf();
