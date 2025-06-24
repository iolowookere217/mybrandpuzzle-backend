"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv/config");
// Ticket Schema
const ticketSchema = new mongoose_1.default.Schema(
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
const TicketModel = mongoose_1.default.model("Tickets", ticketSchema);
exports.default = TicketModel;
