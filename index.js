const express = require("express");
const axios = require("axios");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cluster = require("cluster");
const os = require("os");
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");

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
const PORT = process.env.PORT || 3000;

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
  app.use(express.json({ limit: "10kb" }));

  // Middleware to generate x-request-id for tracking
  app.use((req, res, next) => {
    req.xRequestId = uuidv4();
    next();
  });

  // Route to generate CAPTCHA
  app.post("/genCaptcha", async (req, res, next) => {
    const { captchaLength, captchaType, audioCaptchaRequired } = req.body;
    if (
      !captchaLength ||
      !captchaType ||
      typeof audioCaptchaRequired === "undefined"
    ) {
      return res.status(400).json({
        error: true,
        message:
          "Missing required fields: captchaLength, captchaType, and audioCaptchaRequired",
      });
    }
    const data = JSON.stringify({
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
        "x-request-id": req?.xRequestId,
        "Referer": "https://myaadhaar.uidai.gov.in/",
        "Referrer-Policy": "strict-origin",
      },
      data: data,
    };
    console.log(config, "CAPTCHA Generation config");
    try {
      const response = await axios.request(config);
      console.log(response?.data, "CAPTCHA Generation response");
      logger.info(
        `CAPTCHA Generation Request Successful - Status: ${response.status}`
      );
      res.status(200).json({ ...response.data, xRequestId: req.xRequestId });
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
          "Missing required fields: uid, captchaTxnId, captcha, requestUUID, captchaLogic",
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
        "accept": "application/json, text/plain, */*",
        "accept-language": "en_IN",
        "appid": "MYAADHAAR",
        "content-type": "application/json",
        "sec-ch-ua":
          '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-request-id": "e599af75-6a0d-463e-9ac3-5ede6ec45094",
        "Referer": "https://myaadhaar.uidai.gov.in/",
        "Referrer-Policy": "strict-origin",
      },
      data: data,
    };
    console.log(config, "Adhaar verification config");
    try {
      const response = await axios.request(config);
      console.log(response?.data, "Adhaar Verfication response");
      console.log(response?.data);
      logger.info(
        `Aadhaar Verification Request Successful - Status: ${response.status}`
      );
      res.status(200).json(response.data);
    } catch (error) {
      logger.error(`Aadhaar Verification Failed - Error: ${error.message}`);
      next(error);
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
if (cluster.isMaster) {
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
