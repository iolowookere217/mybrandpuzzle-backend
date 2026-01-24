"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const sendMail = (options) => __awaiter(void 0, void 0, void 0, function* () {
    // Determine which email provider to use (default: gmail)
    // Set EMAIL_PROVIDER=twilio in your environment to use Twilio SendGrid
    // Set EMAIL_PROVIDER=gmail to use Gmail
    const emailProvider = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();
    let transportConfig;
    if (emailProvider === "twilio" || emailProvider === "sendgrid") {
        // Twilio SendGrid SMTP Configuration
        transportConfig = {
            host: process.env.TWILIO_SMTP_HOST || "smtp.sendgrid.net",
            port: parseInt(process.env.TWILIO_SMTP_PORT || "587"),
            secure: false, // Use TLS
            auth: {
                user: process.env.TWILIO_SMTP_USER || "apikey", // SendGrid uses "apikey" as username
                pass: process.env.TWILIO_SMTP_PASSWORD, // Your SendGrid API Key
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
        };
    }
    else {
        // Gmail SMTP Configuration (default)
        const port = parseInt(process.env.SMTP_PORT || "587");
        transportConfig = {
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465, // true for 465 (SSL), false for other ports (TLS/STARTTLS)
            service: process.env.SMTP_SERVICE,
            auth: {
                user: process.env.SMTP_MAIL,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
        };
    }
    const transporter = nodemailer_1.default.createTransport(transportConfig);
    const { email, subject, template, data } = options;
    // get the path to the email template file
    // In production (compiled to dist), mails folder is copied to dist/mails
    // __dirname in compiled JS will be <root>/dist/utils, so ../mails points to <root>/dist/mails
    // In development with ts-node-dev, __dirname is <root>/utils, so ../mails points to <root>/mails
    const templatePath = path_1.default.join(__dirname, "../mails", template);
    // Render the email template with EJS
    const html = yield ejs_1.default.renderFile(templatePath, data);
    // Determine the sender email based on the provider
    const fromEmail = emailProvider === "twilio" || emailProvider === "sendgrid"
        ? process.env.TWILIO_SMTP_FROM || process.env.SMTP_MAIL
        : process.env.SMTP_MAIL;
    const mailOptions = {
        from: fromEmail,
        to: email,
        subject,
        html,
    };
    yield transporter.sendMail(mailOptions);
});
exports.default = sendMail;
