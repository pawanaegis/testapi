import sharp from 'sharp';
import { promises as fs } from 'fs';

// Function to create a text overlay as an SVG buffer with a box around the text
const createTextOverlay = async (
  text,
  width,
  height,
  fontSize,
  color,
  padding = 5
) => {
  // Escape special characters for XML
  const sanitizeText = str =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const sanitizedText = sanitizeText(text);
  const textWidth = width - 2 * padding;
  const textHeight = fontSize + padding;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .text {
          font-size: ${fontSize}px;
          font-family: Arial, sans-serif;
          fill: ${color};
          dominant-baseline: middle;
          text-anchor: start;
          paint-order: fill;
        }
        .box {
          fill: none; /* Remove shadow by default */
          stroke: white; /* Or specify stroke if needed */
          stroke-width: 1;
        }
      </style>
      <rect x="${padding}" y="${padding}" width="${textWidth}" height="${textHeight}" class="box" />
      <text x="${padding}" y="${textHeight / 2 + padding}" class="text">${sanitizedText}</text>
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
};

// Main function to process the image and return a base64 string
const imageFormFiller = async (inputImagePath, elements, signature) => {
  try {
    const overlays = [];
    const inputBuffer = await fs.readFile(inputImagePath); // Reading the image from file path

    // Generate buffers for each text element and add to overlays
    for (const element of elements) {
      const textBuffer = await createTextOverlay(
        element.text,
        700,
        60,
        22,
        'black'
      );
      overlays.push({
        input: textBuffer,
        top: element.position.y,
        left: element.position.x,
      });
    }

    // Add signature overlay
    if (signature.image) {
      const signatureBuffer = Buffer.from(signature.image, 'base64');
      const resizedSignature = await sharp(signatureBuffer)
        .resize(signature.size.width, signature.size.height, { fit: 'inside' })
        .toBuffer();

      overlays.push({
        input: resizedSignature,
        top: signature.position.y,
        left: signature.position.x,
      });
    }

    // Composite the original image with all overlays and convert to JPEG
    const outputBuffer = await sharp(inputBuffer)
      .composite(overlays)
      .jpeg({ quality: 90 })
      .toBuffer();

    // Convert the output buffer to a base64 string and return it
    return outputBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Error processing image: ${error.message}`);
  }
};
export { imageFormFiller };
