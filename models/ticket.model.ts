import mongoose, { Document, Model, Schema } from "mongoose";
import "dotenv/config";

// Ticket Interface
export interface ITicket extends Document {
  title: string;
  category: string;
  description: string;
  attempted_solution: string;
  verified_solution: string;
  attachments: Array<{ public_id: string; url: string }>; // Array of attachment objects
  tags: string[]; // Array of strings
  issuedBy: {
    id: string;
    name: string;
    role?: string;
    profile?: string;
  };
  assignedTo: string;
  status: "open" | "assigned" | "resolved"; // Enum for status
  meeting: { id: string; link: string }; // Meeting details
}

// Ticket Schema
const ticketSchema: Schema<ITicket> = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true, // Title is mandatory
      trim: true, // Remove extra whitespace
    },
    category: {
      type: String,
      required: true, // Category is mandatory
    },
    description: {
      type: String,
      required: true, // Description is mandatory
      trim: true,
    },
    attempted_solution: {
      type: String,
      trim: true,
    },
    verified_solution: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        public_id: {
          type: String,
          required: true, // Each attachment must have a public_id
        },
        url: {
          type: String,
          required: true, // Each attachment must have a URL
        },
      },
    ],
    tags: {
      type: [String], // Array of strings
      default: [], // Default to an empty array if not provided
    },
    issuedBy: {
      id: {
        type: String,
        required: true,
        index: true,
      },
      name: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        required: false,
      },
      profile: {
        type: String,
        required: false,
      },
    },
    assignedTo: {
      type: String,
      required: false, // Assigned to is optional
    },
    status: {
      type: String,
      enum: ["open", "assigned", "resolved"], // Restrict to valid statuses
      default: "open",
    },
    meeting: {
      id: {
        type: String,
        required: false,
      },
      link: {
        type: String,
        required: false,
      },
    },
  },
  { timestamps: true }
);

// Ticket Model
const TicketModel: Model<ITicket> = mongoose.model("Tickets", ticketSchema);
export default TicketModel;
