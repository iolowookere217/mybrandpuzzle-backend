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
exports.getTicketMeeting = exports.updateMeetingResolver = exports.getAllMeetings = exports.getUserMeetings = exports.createMeeting = void 0;
const meeting_model_1 = __importDefault(require("../models/meeting.model"));
const zoom_1 = require("../utils/zoom");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const catchAsyncError_1 = require("../middlewares/catchAsyncError");
const createMeeting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, ticketId, date, time } = req.body;
        // Authenticate the user and get their email
        if (!req.user) {
            throw new ErrorHandler_1.default("User not authenticated", 401);
        }
        const user = req.user;
        const hostEmail = user.email;
        // Validate input
        if (!title || !ticketId || !date || !time) {
            throw new ErrorHandler_1.default("All fields are required", 400);
        }
        //Check user meetings limit
        // TODO: Implement account_type field in user model to enable meeting limits
        // const accountType = user.account_type;
        // if (accountType === "freeUser") {
        //   const totalMeetings = await meetingModel.countDocuments({ host_email: hostEmail });
        //   if (totalMeetings >= 2) {
        //     throw new ErrorHandler(
        //       "Free users can only create up to 2 meetings. Upgrade your account to create more.",
        //       403
        //     );
        //   }
        // }
        // Combine date and time into ISO format for Zoom API
        const startTime = new Date(`${date}T${time}:00`);
        // Check if the scheduled time is in the past
        const currentTime = new Date();
        if (startTime <= currentTime) {
            throw new ErrorHandler_1.default("Meeting cannot be scheduled for a past time", 400);
        }
        // Create Zoom meeting
        const zoomMeetingUrl = yield (0, zoom_1.createZoomMeeting)(title, startTime.toISOString());
        // Save meeting to the database
        yield meeting_model_1.default.create({
            title,
            host_email: hostEmail,
            ticket: ticketId,
            date,
            time,
            resolver: "",
            meeting_link: zoomMeetingUrl,
        });
        res.status(201).json({
            message: "Meeting created successfully",
            link: zoomMeetingUrl,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
});
exports.createMeeting = createMeeting;
//Get user meetings
exports.getUserMeetings = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        //Get user email
        const user_email = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email;
        // Query all meetings where host email is user_email
        const meetings = yield meeting_model_1.default.find({ "host_email": user_email,
        });
        // Respond with the filtered tickets
        return res.status(200).json({
            meetings
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
}));
//Get all meetings
exports.getAllMeetings = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Query all meetings 
        const meetings = yield meeting_model_1.default.find();
        // Respond with the filtered tickets
        return res.status(200).json({
            meetings
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
}));
// add/update a resolver name to meeting details
exports.updateMeetingResolver = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        //Get meeting details
        const { resolver_name } = req.body;
        const meetingId = req.params.id;
        //Check if user owns this meeting
        const meeting = yield meeting_model_1.default.findById(meetingId);
        const user_email = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email;
        if (user_email !== (meeting === null || meeting === void 0 ? void 0 : meeting.host_email)) {
            res.status(400).json({
                message: "user not authorized"
            });
        }
        //add or update resolve name
        yield meeting_model_1.default.findByIdAndUpdate(meetingId, { $set: { resolver: resolver_name } }, { new: true });
        res.status(200).json({ message: "Resolver name updated successfully" });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
}));
//get meeting details for a ticket
exports.getTicketMeeting = (0, catchAsyncError_1.CatchAsyncError)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        //Get ticket id
        const ticketId = req.params.id;
        // Query all meetings where host email is user_email
        const meeting = yield meeting_model_1.default.find({ "ticket": ticketId });
        // Respond with the filtered tickets
        return res.status(200).json({
            meeting
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
}));
