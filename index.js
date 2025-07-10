import express from "express";
import axios from "axios";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cluster from "cluster";
import os from "os";
import winston from "winston";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import timeout from "connect-timeout";
import fs from "fs";
import path from "path";
import { form60Generator } from "./formFillerService/form60Genrator.js";
import { processAadhaarPdf } from "./adhaarDownload/aadhaarPdf.js";
import { removeBackground } from "@imgly/background-removal-node";

// Create a Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "server.log" }),
  ],
});

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3100;

// Apply rate limiter to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 100 requests per windowMs
  message: {
    error: true,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  headers: true,
});

// Main application logic
const runServer = () => {
  const app = express();

  // Apply rate limiter to all routes
  app.use(limiter);

  // Security middleware
  app.use(helmet());

  // Compression middleware
  app.use(compression());

  // Request logging using Morgan
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );

  // Body parsing
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Timeout middleware
  app.use(timeout("30s"));

  // Middleware to generate x-request-id for tracking
  app.use((req, res, next) => {
    req.xRequestId = uuidv4();
    next();
  });

  // Route to generate CAPTCHA
  app.post("/genCaptcha", async (req, res, next) => {
    const { reqId, captchaLength, captchaType, audioCaptchaRequired } =
      req?.body;
    if (
      !reqId ||
      !captchaLength ||
      !captchaType ||
      typeof audioCaptchaRequired === "undefined"
    ) {
      return res?.status(400)?.json({
        error: true,
        message:
          "Missing required fields: reqId, captchaLength, captchaType, and audioCaptchaRequired",
      });
    }
    const data = JSON?.stringify({
      captchaLength: captchaLength,
      captchaType: captchaType,
      audioCaptchaRequired: audioCaptchaRequired,
    });
    const config = {
      method: "post",
      url: "https://tathya.uidai.gov.in/audioCaptchaService/api/captcha/v3/generation",
      
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en_IN",
        appid: "MYAADHAAR",
        "content-type": "application/json",
        "sec-ch-ua":
          '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-request-id": reqId,
        Referer: "https://myaadhaar.uidai.gov.in/",
        "Referrer-Policy": "strict-origin",
      },
      data: data,
    };
    console.log(config, "CAPTCHA Generation config");
    try {
      const response = await axios.request(config);
      console.log(response?.data, "CAPTCHA Generation response");
      logger.info(
        `CAPTCHA Generation Request Successful - Status: ${response.data}`
      );
      res.status(200).json({ ...response?.data, xRequestId: reqId });
    } catch (error) {
      logger.error(`CAPTCHA Generation Failed - Error: ${error.message}`);
      next(error);
    }
  });

  // Route to validate Aadhaar
  app.post("/validateAadhaar", async (req, res, next) => {
    const { uid, captchaTxnId, captcha, transactionId, captchaLogic } =
      req.body;
    if (!uid || !captchaTxnId || !captcha || !transactionId || !captchaLogic) {
      return res.status(400).json({
        error: true,
        message:
          "Missing required fields: uid, captchaTxnId, captcha, transactionId, captchaLogic",
      });
    }
    const data = JSON.stringify({
      uid: uid,
      captchaTxnId: captchaTxnId,
      captcha: captcha,
      transactionId: transactionId,
      captchaLogic: captchaLogic,
    });
    const config = {
      method: "post",
      url: "https://tathya.uidai.gov.in/uidVerifyRetrieveService/api/verifyUID",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en_IN",
        appid: "MYAADHAAR",
        "content-type": "application/json",
        "sec-ch-ua":
          '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-request-id": transactionId,
        Referer: "https://myaadhaar.uidai.gov.in/",
        "Referrer-Policy": "strict-origin",
      },
      data: data,
    };
    console.log(config, "Aadhaar verification config");
    try {
      const response = await axios.request(config);
      console.log(response?.data, "Aadhaar Verification response");
      logger.info(
        `Aadhaar Verification Request Successful - Status: ${response.data}`
      );
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Aadhaar Verification Failed - Error: ${error.message}`);
      next(error);
    }
  });
  app.post("/generate-form60", async (req, res) => {
    try {
      // const request = {...req, body: JSON.parse(req?.body) || req?.body}
      const request = req;
      const imageBuffer = await form60Generator(request?.body);
      res.setHeader("Content-Type", "application/jpeg");
      res.status(200).send({
        message: "Form 60 generated",
        form60Image: imageBuffer,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({
        message: error?.message,
      });
    }
    // const generateForm60Buffer = await form60Generator(request?.body);
  });
  app.post("/generate-otp", async (req, res, next) => {
    const { uid, captchaTxnId, captcha, transactionId } = req.body;
    let data = JSON.stringify({
      uidNumber: uid,
      captchaTxnId: captchaTxnId,
      captchaValue: captcha,
      transactionId: transactionId,
    });
    if (!uid || !captchaTxnId || !captcha || !transactionId) {
      return res.status(400).json({
        error: true,
        message:
          "Missing required fields: uid, captchaTxnId, captcha, transactionId",
      });
    }
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://tathya.uidai.gov.in/unifiedAppAuthService/api/v2/generate/aadhaar/otp",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en_IN",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        DNT: "1",
        Origin: "https://myaadhaar.uidai.gov.in",
        Pragma: "no-cache",
        Referer: "https://myaadhaar.uidai.gov.in/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        appid: "MYAADHAAR",
        "sec-ch-ua":
          '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "x-request-id": transactionId,
      },
      data: data,
    };
    console.log(config, "OTP Generation config");
    try {
      const response = await axios.request(config);
      console.log(response?.data, "OTP Generation response");
      logger.info(
        `OTP Generation Request Successful - Status: ${response.data}`
      );
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`OTP Generation Failed - Error: ${error.message}`);
      next(error);
    }
  });
  // Route to remove background from image
  app.post("/removeBg", async (req, res, next) => {
    let tempFilePath = null;
    
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({
          error: true,
          message: "Missing required field: image (base64 string)"
        });
      }
      
      // Handle base64 string - remove data URL prefix if present
      let base64Data = image;
      if (image.startsWith('data:')) {
        base64Data = image.split(',')[1];
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Create tmp directory if it doesn't exist
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      // Generate unique filename for temporary image
      const uniqueId = uuidv4();
      tempFilePath = path.join(tmpDir, `temp_${uniqueId}.png`);
      
      // Save base64 image to temporary file
      fs.writeFileSync(tempFilePath, imageBuffer);
      
      logger.info(`Background removal started for image: ${tempFilePath}`);
      
      // Remove background using the library with file path
      let result;
      try {
        // Force garbage collection before processing if available
        if (global.gc) {
          global.gc();
        }
        
        result = await removeBackground(tempFilePath, {
          model: 'small',
          debug: true, // Use lighter model to prevent memory issues on server
          output: {
            format: 'image/png'
          }
        });
      } catch (bgRemovalError) {
        logger.error(`Background removal library error: ${bgRemovalError.message}`);
        throw new Error(`Background removal failed: ${bgRemovalError.message}`);
      }
      
      // Convert Blob to Buffer if necessary
      let resultBuffer;
      if (result instanceof Blob) {
        const arrayBuffer = await result.arrayBuffer();
        resultBuffer = Buffer.from(arrayBuffer);
      } else {
        resultBuffer = result;
      }
      
      // Convert result to base64 PNG format (preserves transparency)
       const resultBase64 = resultBuffer.toString('base64');
      
      logger.info(`Background removal completed successfully`);
      res.status(200).json({
        success: true,
        message: "Background removed successfully",
        image: resultBase64
      });
      
    } catch (error) {
      logger.error(`Background removal failed: ${error.message}`);
      res.status(500).json({
        error: true,
        message: `Background removal failed: ${error.message}`
      });
    } finally {
      // Clean up temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.info(`Temporary file deleted: ${tempFilePath}`);
        } catch (deleteError) {
          logger.error(`Failed to delete temporary file: ${deleteError.message}`);
        }
      }
    }
  });
  
  // Route to download and process Aadhaar PDF
  app.post("/download-aadhaar", async (req, res, next) => {
    const { uid, otp, otpTransactionId, transactionId, pdfPassword } = req.body;
    
    // Define crop configuration - adjust these values as needed
    const cropConfig = {
      x: 100,      // X coordinate to start cropping from
      y: 200,      // Y coordinate to start cropping from
      width: 800,  // Width of the crop area
      height: 600  // Height of the crop area
    };
    
    let data = JSON.stringify({
      uid: uid,
      mask: false,
      otp: otp,
      otpTxnId: otpTransactionId,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://tathya.uidai.gov.in/downloadAadhaarService/api/aadhaar/download",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en_IN",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        DNT: "1",
        Origin: "https://myaadhaar.uidai.gov.in",
        Pragma: "no-cache",
        Referer: "https://myaadhaar.uidai.gov.in/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        appid: "MYAADHAAR",
        "sec-ch-ua":
          '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "transactionId": transactionId,
        "x-request-id": transactionId,
      },
      data: data,
    };
    
    console.log(config, "Aadhaar Download config");
    
    try {
      // Get the PDF from the API
      const response = await axios.request(config);
      console.log("Aadhaar Download response received");
      
      // Check if the response contains the PDF data
      if (response?.data?.aadhaarPdf) {
        try {
          // Process the PDF: decrypt, convert to image, crop, and get base64
          const base64Image = await processAadhaarPdf(
            response.data.aadhaarPdf, 
            pdfPassword,
            cropConfig
          );
          
          // Return the processed image
          logger.info(`Aadhaar PDF processed successfully`);
          res.status(200).json({
            success: true,
            message: "Aadhaar PDF processed successfully",
            base64Image: base64Image
          });
        } catch (processingError) {
          logger.error(`Aadhaar PDF processing failed: ${processingError.message}`);
          res.status(500).json({
            success: false,
            message: `Failed to process Aadhaar PDF: ${processingError.message}`
          });
        }
      } else {
        // If the PDF is not in the response
        logger.error(`Aadhaar PDF not found in response`);
        res.status(400).json({
          success: false,
          message: "Aadhaar PDF not found in response",
          originalResponse: response.data
        });
      }
    } catch (error) {
      logger.error(`Aadhaar Download Failed - Error: ${error.message}`);
      res.status(error.response?.status || 500).json({
        success: false,
        message: `Aadhaar Download Failed: ${error.message}`,
        error: error.response?.data || error.message
      });
    }
  });
  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(err.status || 500).json({
      error: true,
      message: err.message || "Internal server error",
    });
  });

  // Start the server
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down server gracefully...");
    server.close(() => {
      logger.info("Closed all remaining connections.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

// Multi-core clustering for improved performance
if (cluster.isPrimary) {
  logger.info(`Master process running with PID: ${process.pid}`);
  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Log worker exit and respawn if necessary
  cluster.on("exit", (worker, code, signal) => {
    logger.error(
      `Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}`
    );
    cluster.fork();
  });
} else {
  runServer();
}
