# Aadhaar PDF Processing Application

## Dependencies

This application processes password-protected Aadhaar PDF files, converts them to images, and performs cropping operations. The following dependencies are required for proper functioning:

### System Dependencies

Depending on your server environment, you'll need to install these system packages:

#### Ubuntu/Debian

```bash
# Update package lists
sudo apt-get update

# Install Poppler tools (for pdftoppm - PDF to image conversion)
sudo apt-get install -y poppler-utils

# Install GraphicsMagick (as a fallback option)
sudo apt-get install -y graphicsmagick

# Install Sharp dependencies
sudo apt-get install -y libvips-dev
```

#### Amazon Linux (AWS Lambda)

```bash
# Update package lists
yum update -y

# Install Poppler tools
yum install -y poppler-utils

# Install GraphicsMagick
yum install -y GraphicsMagick

# Install Sharp dependencies
yum install -y libvips-devel
```

### Node.js Dependencies

The application uses the following npm packages:

```bash
npm install sharp pdf-lib fs-extra
```

## Lambda Layer (for AWS Lambda)

If deploying to AWS Lambda, you may need to create a custom Lambda Layer that includes the Poppler binaries. Here's how to create one:

1. Create a directory structure for your layer:
   ```bash
   mkdir -p lambda-layer/bin
   ```

2. Download and compile Poppler for Amazon Linux, or use a pre-built binary compatible with Amazon Linux.

3. Place the `pdftoppm` binary in the `lambda-layer/bin` directory.

4. Create a ZIP file of the layer:
   ```bash
   cd lambda-layer
   zip -r ../poppler-layer.zip .
   ```

5. Upload the ZIP file as a Lambda Layer and attach it to your function.

## Environment Configuration

Ensure your Lambda function or server has the following environment variables set:

- `PATH`: Should include the directory containing the `pdftoppm` binary

## Usage

The application provides an API for processing Aadhaar PDFs. See the code documentation for details on how to use the API endpoints.
