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
const timeout = require('connect-timeout');
const { form60Generator } = require("./formFillerService/form60Genrator");

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
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Timeout middleware
  app.use(timeout('30s'));

  // Middleware to generate x-request-id for tracking
  app.use((req, res, next) => {
    req.xRequestId = uuidv4();
    next();
  });

  // Route to generate CAPTCHA
  app.post("/genCaptcha", async (req, res, next) => {
    const { reqId, captchaLength, captchaType, audioCaptchaRequired } = req?.body;
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
        "x-request-id": transactionId,
        "Referer": "https://myaadhaar.uidai.gov.in/",
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
  app.post("/generate-form60", async(req, res) => {
    try {
    // const request = {...req, body: JSON.parse(req?.body) || req?.body} 
    const request = req;
    const imageBuffer = await form60Generator(request?.body);
    res.setHeader('Content-Type', 'application/jpeg');
    res.status(200).send({
      message: "Form 60 generated",
      form60Image: imageBuffer
    });
    } catch (error) {
      console.error(error);
      res.status(500).send({
        message: error?.message,
      });
    }
    // const generateForm60Buffer = await form60Generator(request?.body);
  })

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
