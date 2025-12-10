import { Request, Response, NextFunction } from "express";
import meetingModel from "../models/meeting.model";
import { createZoomMeeting } from "../utils/zoom";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middlewares/catchAsyncError";

// Define the interface for the request body
interface IMeetingRequestBody {
  title: string;
  ticketId: string;
  date: string;
  time: string;
}

export const createMeeting = async (
  req: Request<{}, {}, IMeetingRequestBody>,
  res: Response
): Promise<void> => {
  try {
    const { title, ticketId, date, time } = req.body as IMeetingRequestBody;

    // Authenticate the user and get their email
    if (!req.user) {
      throw new ErrorHandler("User not authenticated", 401);
    }
    const user = req.user;
    const hostEmail = user.email;

    // Validate input
    if (!title || !ticketId || !date || !time) {
      throw new ErrorHandler("All fields are required", 400);
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
      throw new ErrorHandler(
        "Meeting cannot be scheduled for a past time",
        400
      );
    }

    // Create Zoom meeting
    const zoomMeetingUrl = await createZoomMeeting(
      title,
      startTime.toISOString()
    );

    // Save meeting to the database
    await meetingModel.create({
      title,
      host_email: hostEmail,
      ticket: ticketId,
      date,
      time,
      resolver : "",
      meeting_link: zoomMeetingUrl,
    });

    res.status(201).json({
      message: "Meeting created successfully",
      link: zoomMeetingUrl,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};


//Get user meetings
export const getUserMeetings = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      //Get user email
      const user_email =  req.user?.email as string;

      // Query all meetings where host email is user_email
      const meetings = await meetingModel.find({"host_email": user_email,
      });

      // Respond with the filtered tickets
      return res.status(200).json({
        meetings
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


//Get all meetings
export const getAllMeetings = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      // Query all meetings 
      const meetings = await meetingModel.find();

      // Respond with the filtered tickets
      return res.status(200).json({
        meetings
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add/update a resolver name to meeting details
export const updateMeetingResolver = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      //Get meeting details
      const {resolver_name} = req.body;
      const meetingId = req.params.id;
      
      //Check if user owns this meeting
      const meeting = await meetingModel.findById(meetingId);
      const user_email =  req.user?.email as string;

      if (user_email !== meeting?.host_email){
        res.status(400).json({
          message: "user not authorized"});
      }
      
      //add or update resolve name
      await meetingModel.findByIdAndUpdate(
        meetingId,
        { $set: {resolver: resolver_name} },
        { new: true }
      );

      res.status(200).json({ message: "Resolver name updated successfully"});
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


//get meeting details for a ticket
export const getTicketMeeting = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      //Get ticket id
      const ticketId = req.params.id;

      // Query all meetings where host email is user_email
      const meeting = await meetingModel.find({"ticket": ticketId});

      // Respond with the filtered tickets
      return res.status(200).json({
        meeting
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);