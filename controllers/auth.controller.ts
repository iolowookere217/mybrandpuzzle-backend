import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import UserModel from "../models/user.model";
import BrandModel from "../models/brand.model";
import { sendToken } from "../utils/jwt";
import admin from "firebase-admin";
// ensure firebase admin is initialized (firebaseConfig reads env and calls initializeApp)
import "../firebaseConfig";
import jwt from "jsonwebtoken";
import { Secret } from "jsonwebtoken";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendEmail";
import { createActivationToken } from "./user.controller";
import { generateUsername, generateAvatar } from "../utils/userHelpers";

// Google OAuth sign-in (client provides profile info or idToken)
export const googleAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Accept either a firebase idToken or a minimal profile payload
      const { idToken, email, name, avatar, googleId } = req.body;

      let profile: {
        email: string;
        name?: string;
        picture?: string;
        uid?: string;
      } | null = null;

      if (idToken) {
        // verify with firebase-admin
        const decoded = await admin.auth().verifyIdToken(idToken);
        profile = {
          email: decoded.email || "",
          name: decoded.name,
          picture: decoded.picture,
          uid: decoded.uid,
        };
      } else if (email && googleId) {
        profile = { email, name, picture: avatar, uid: googleId };
      } else {
        return next(new ErrorHandler("Invalid Google payload", 400));
      }

      let user = await UserModel.findOne({ email: profile.email });
      if (!user) {
        const fullName = profile.name || profile.email.split("@")[0];
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || fullName;
        const lastName = nameParts.slice(1).join(" ") || "";

        const username = await generateUsername(profile.email);
        const avatar = profile.picture || generateAvatar();

        user = await UserModel.create({
          firstName,
          lastName,
          username,
          email: profile.email,
          avatar,
          googleId: profile.uid,
          role: "gamer",
          isVerified: true,
        });
      } else {
        // ensure googleId is stored
        if (!user.googleId && profile.uid) {
          user.googleId = profile.uid;
          await user.save();
        }
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Gamer email signup (email + password registration)
export const registerGamer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      if (!email || !password || !firstName) {
        return next(
          new ErrorHandler(
            "Missing required fields: firstName, email, password",
            400
          )
        );
      }

      const existing = await UserModel.findOne({ email });
      if (existing) return next(new ErrorHandler("Email already exists", 400));

      const username = await generateUsername(email);
      const avatar = generateAvatar();

      const user = await UserModel.create({
        firstName,
        lastName: lastName || "",
        username,
        email,
        password,
        avatar,
        role: "gamer",
        isVerified: false,
      });

      // create activation token and email the gamer
      try {
        const activationToken = createActivationToken({
          firstName,
          lastName,
          email,
          password,
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name: firstName }, activationCode };
        await ejs.renderFile(
          path.join(__dirname, "../mails/activation-mail.ejs"),
          data
        );
        await sendMail({
          email,
          subject: "Verify your gamer account",
          template: "activation-mail.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          user,
          activationToken: activationToken.token,
          message: "Activation email sent. Please verify your email.",
        });
      } catch (mailErr: any) {
        // If email fails, still return created user/token
        sendToken(user, 201, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Gamer email activation
export const activateGamer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } = req.body;
      if (!activation_token || !activation_code)
        return next(new ErrorHandler("Missing activation data", 400));

      const decoded = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as Secret
      ) as any;
      if (!decoded)
        return next(new ErrorHandler("Invalid activation token", 400));

      if (decoded.activationCode !== activation_code)
        return next(new ErrorHandler("Invalid activation code", 400));

      const { firstName, lastName, email, password } = decoded.user;

      // check if user exists
      const exist = await UserModel.findOne({ email });
      if (exist) {
        if (exist.role !== "gamer") {
          return next(
            new ErrorHandler(
              "Email is registered as a different account type",
              400
            )
          );
        }
        // mark as verified
        if (!exist.isVerified) {
          exist.isVerified = true;
          await exist.save();
        }
        sendToken(exist, 200, res);
        return;
      }

      // create new gamer account
      const username = await generateUsername(email);
      const avatar = generateAvatar();

      const user = await UserModel.create({
        firstName,
        lastName: lastName || "",
        username,
        email,
        password,
        avatar,
        role: "gamer",
        isVerified: true,
      });

      sendToken(user, 201, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Unified login for both gamers and brands
export const login = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return next(new ErrorHandler("Missing email or password", 400));

      const user = await UserModel.findOne({ email }).select("+password");
      if (!user)
        return next(new ErrorHandler("Invalid credentials", 403));

      const match = await user.comparePassword!(password);
      if (!match) return next(new ErrorHandler("Invalid credentials", 403));

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Brand registration (email/password)
export const registerBrand = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, companyName } = req.body;
      if (!email || !password || !companyName) {
        return next(new ErrorHandler("Missing required fields", 400));
      }

      const existing = await UserModel.findOne({ email });
      if (existing) return next(new ErrorHandler("Email already exists", 400));

      const user = await UserModel.create({
        name,
        email,
        password,
        role: "brand",
        companyName,
        isVerified: false,
      });

      // create Brand profile
      await BrandModel.create({
        userId: user._id,
        companyEmail: email,
        companyName,
        campaigns: [],
      });

      // create activation token and email the brand
      try {
        const activationToken = createActivationToken({
          name,
          email,
          password,
          companyName,
        });
        const activationCode = activationToken.activationCode;
        const data = { user: { name }, activationCode };
        await ejs.renderFile(
          path.join(__dirname, "../mails/activation-mail.ejs"),
          data
        );
        await sendMail({
          email,
          subject: "Activate your brand account",
          template: "activation-mail.ejs",
          data,
        });

        // return activation token to client along with login token
        res.status(201).json({
          success: true,
          user,
          activationToken: activationToken.token,
        });
      } catch (mailErr: any) {
        // If email fails, still return created user/token to keep current behavior
        sendToken(user, 201, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const logout = CatchAsyncError(async (req: Request, res: Response) => {
  res.cookie("access_token", "", { maxAge: 1 });
  res.cookie("refresh_token", "", { maxAge: 1 });
  res.status(200).json({ success: true });
});

// Activate brand account using activation token + code
interface IBrandActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateBrand = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IBrandActivationRequest;
      if (!activation_token || !activation_code)
        return next(new ErrorHandler("Missing activation data", 400));

      const decoded = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as Secret
      ) as any;
      if (!decoded)
        return next(new ErrorHandler("Invalid activation token", 400));

      if (decoded.activationCode !== activation_code)
        return next(new ErrorHandler("Invalid activation code", 400));

      const { name, email, password, companyName } = decoded.user;

      // check if user exists
      const exist = await UserModel.findOne({ email });
      if (exist) {
        // if user exists, mark as verified and ensure brand profile exists
        if (!exist.isVerified) {
          exist.isVerified = true;
          await exist.save();
        }
        const brandProfile = await BrandModel.findOne({ userId: exist._id });
        if (!brandProfile) {
          await BrandModel.create({
            userId: exist._id,
            companyEmail: email,
            companyName,
            campaigns: [],
          });
        }
        sendToken(exist, 200, res);
        return;
      }

      // user doesn't exist yet: create account
      const user = await UserModel.create({
        name,
        email,
        password,
        role: "brand",
        companyName,
        isVerified: true,
      });

      // ensure brand profile
      await BrandModel.create({
        userId: user._id,
        companyEmail: email,
        companyName,
        campaigns: [],
      });

      sendToken(user, 201, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Resend activation email for gamer
export const resendGamerActivation = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return next(new ErrorHandler("Email is required", 400));
      }

      // Find user
      const user = await UserModel.findOne({ email });
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (user.role !== "gamer") {
        return next(
          new ErrorHandler("This email is not registered as a gamer", 400)
        );
      }

      if (user.isVerified) {
        return next(new ErrorHandler("Account is already verified", 400));
      }

      // Create new activation token
      const activationToken = createActivationToken({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password, // hashed password from DB
      });

      const activationCode = activationToken.activationCode;
      const data = { user: { name: user.firstName }, activationCode };

      // Send activation email
      await sendMail({
        email: user.email,
        subject: "Verify your gamer account",
        template: "activation-mail.ejs",
        data,
      });

      res.status(200).json({
        success: true,
        message: `Activation email resent to ${email}`,
        activationToken: activationToken.token,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Resend activation email for brand
export const resendBrandActivation = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return next(new ErrorHandler("Email is required", 400));
      }

      // Find user
      const user = await UserModel.findOne({ email });
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (user.role !== "brand") {
        return next(
          new ErrorHandler("This email is not registered as a brand", 400)
        );
      }

      if (user.isVerified) {
        return next(new ErrorHandler("Account is already verified", 400));
      }

      // Create new activation token
      const activationToken = createActivationToken({
        name: user.name,
        email: user.email,
        password: user.password, // hashed password from DB
        companyName: user.companyName,
      });

      const activationCode = activationToken.activationCode;
      const data = { user: { name: user.name }, activationCode };

      // Send activation email
      await sendMail({
        email: user.email,
        subject: "Verify your brand account",
        template: "activation-mail.ejs",
        data,
      });

      res.status(200).json({
        success: true,
        message: `Activation email resent to ${email}`,
        activationToken: activationToken.token,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
