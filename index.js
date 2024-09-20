const express = require('express');
const axios = require('axios');
const express = require('express');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to log incoming requests
app.use(morgan('combined'));

// Middleware to parse JSON bodies
app.use(express.json());

// Route to generate CAPTCHA
app.post('/genCaptcha', async (req, res) => {
    // Generate a unique x-request-id for the request
    const xRequestId = uuidv4();

    // Extract input values from req.body
    const { captchaLength, captchaType, audioCaptchaRequired } = req.body;

    // Validate input values
    if (!captchaLength || !captchaType || typeof audioCaptchaRequired === 'undefined') {
        return res.status(400).json({
            error: true,
            message: 'Missing required fields: captchaLength, captchaType, and audioCaptchaRequired'
        });
    }
try {
        // Send POST request to CAPTCHA generation API
        const response = await axios.post(
            'https://tathya.uidai.gov.in/audioCaptchaService/api/captcha/v3/generation',
            {
                captchaLength: captchaLength,           // Dynamic captcha length
                captchaType: captchaType,               // Dynamic captcha type
                audioCaptchaRequired: audioCaptchaRequired // Dynamic audio CAPTCHA requirement
            },
            {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en_IN',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/json',
                    'DNT': '1',
                    'Origin': 'https://resident.uidai.gov.in',
                    'Referer': 'https://resident.uidai.gov.in/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'appid': 'MYAADHAAR',
                    'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'x-request-id': xRequestId // Include the generated x-request-id
                }
            }
        );

        // Log outgoing request and incoming response
        console.log(`CAPTCHA Generation Request Successful - Status: ${response.status}`);

        // Return the CAPTCHA API response and x-request-id to the user
        res.status(200).json({
            ...response.data,
            xRequestId: xRequestId // Include x-request-id in response
        });
    } catch (error) {
        console.error('CAPTCHA Generation Request Failed:', error.message);

        if (error.response) {
            res.status(error.response.status).json({
                error: true,
                message: error.response.data
            });
        } else if (error.request) {res.status(500).json({
                error: true,
                message: 'No response received from CAPTCHA generation API'
            });
        } else {
            res.status(500).json({
                error: true,
                message: 'An error occurred while processing the CAPTCHA generation request'
            });
        }
    }
});

// Route to validate Aadhaar
app.post('/validateAdhaar', async (req, res) => {
    const { uid, captchaTxnId, captcha, xRequestId, captchaLogic } = req.body;

    // Check if all required fields are present
    if (!uid || !captchaTxnId || !captcha || !xRequestId || !captchaLogic) {
        return res.status(400).json({ error: true, message: 'Missing required fields: uid, captchaTxnId, captcha, captchaLogic, and xRequestId' });
    }

    try {
        // Send POST request to Aadhaar validation API
        const response = await axios.post(
            'https://tathya.uidai.gov.in/uidVerifyRetrieveService/api/verifyUID',
            {
                uid: uid,
                captchaTxnId: captchaTxnId,
                captcha: captcha,
                transactionId: xRequestId, // Set transactionId as xRequestId
                captchaLogic: captchaLogic
            },
            {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en_IN',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/json',
                    'DNT': '1',
                    'Origin': 'https://resident.uidai.gov.in',
                    'Referer': 'https://resident.uidai.gov.in/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'appid': 'MYAADHAAR',
'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'x-request-id': xRequestId // Set the x-request-id from client
                }
            }
        );

        // Log outgoing request and incoming response
        console.log(`Aadhaar Verification Request Successful - Status: ${response.status}`);
        // Return the Aadhaar validation API response to the user
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Aadhaar Verification Request Failed:', error.message);

        if (error.response) {
            res.status(error.response.status).json({
                error: true,
                message: error.response.data
            });
        } else if (error.request) {
            res.status(500).json({
                error: true,
                message: 'No response received from Aadhaar verification API'
            });
        } else {
            res.status(500).json({
                error: true,
                message: 'An error occurred while processing the Aadhaar verification request'
            });
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

