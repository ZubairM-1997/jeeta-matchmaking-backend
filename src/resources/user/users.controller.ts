import { Router, Request, Response } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import UserService from "./users.service";
import jwt from "jsonwebtoken";
import { authenticateUserToken } from '../../middleware/middleware';
import { OAuth2Client } from "google-auth-library";
import * as nodemailer from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';
import { generateResetToken, getResetLink } from '../../helpers/passwordReset';

export default class UsersController implements Controller {
  public path = "/user";
  public router = Router();
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID as string)
  userService;
  transporter;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.initialiseRoutes();
    this.userService = new UserService(dbClient, s3Client);
    this.transporter = nodemailer.createTransport(
      smtpTransport({
        service: "Outlook365",
         host: "smtp.office365.com",
        port: 587,
        tls: {
          ciphers: "SSLv3",
          rejectUnauthorized: false,
        },
        auth: {
          user: 'jettamatchmaking@outlook.com',
          pass: process.env.GMAIL_PASS,
        },
      })
    );
  }

  initialiseRoutes(): void {
    this.router.post(`${this.path}/sign_up`, this.createUser);
    this.router.post(`${this.path}/sign_in`, this.loginUser);

    this.router.post(`${this.path}/google/sign_up`, this.signUpWithGoogle);
    this.router.post(`${this.path}/google/sign_in`, this.signInWithGoogle);

    this.router.post(
      `${this.path}/:userId/createApplication`,
      authenticateUserToken,
      this.createApplication,
    );

    this.router.put(
      `${this.path}/:userId/amendApplication`,
      authenticateUserToken,
      this.amendApplication,
    );

    this.router.post(`${this.path}/resetPassword/request`, this.requestPasswordReset);
    this.router.post(`${this.path}/resetPassword/update`, this.updatePassword);

  }

  signUpWithGoogle = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {


    try {
      const { token } = req.body;
      // Verify the Google ID token
      const googleTicket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID, // Replace with your Google Client ID
      });

      const payload = googleTicket.getPayload();
      let sub;
      let email;
      let username;

      if (payload){
        sub = payload.sub as string
        email = payload.email as string
        username = email.split('@')[0] as string
      }

      // Check if the user already exists in your system using the Google sub (unique identifier)
      const existingUser = await this.userService.getUserByGoogleSub(sub as string);

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create the user in your system
      const createdUser = await this.userService.createUserFromGoogle(
        sub as string,
        email as string,
        username as string
      );

      if (createdUser){
        const secretKey = process.env.JWT_SECRET_KEY as string;
        if (!secretKey) {
          return res.status(500).json({ message: "JWT secret key not found" });
        }
        const tokenResponse = jwt.sign({ userId: createdUser.userId }, secretKey, { expiresIn: "1h" });

        return res.status(200).json({ jwt: tokenResponse, userId: createdUser.userId });
      }

    } catch (error) {
      console.error("Error during Google sign-up:", error);
      return res.status(500).json({ message: "Failed to sign up with Google" });
    }
  };

  signInWithGoogle = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {

    try {
      const { token } = req.body;
      // Verify the Google ID token
      const googleTicket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID, // Replace with your Google Client ID
      });

      const payload = googleTicket.getPayload();
      let sub = ''

      if (payload){
        sub = payload.sub

      }
      // Check if the user exists in your system using the Google sub
      const user = await this.userService.getUserByGoogleSub(sub);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Generate a JWT token
      const secretKey = process.env.JWT_SECRET_KEY as string;
      if (!secretKey) {
        return res.status(500).json({ message: "JWT secret key not found" });
      }
      const tokenResponse = jwt.sign({ userId: user.userId }, secretKey, { expiresIn: "1h" });

      return res.status(200).json({ jwt: tokenResponse, userId: user.userId });
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      return res.status(500).json({ message: "Failed to sign in with Google" });
    }
  };

  createUser = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
    console.log('Inside createUser function in user controller');
    const { username, email, password } = req.body;

    try {
      const user = await this.userService.getSingleUserByEmail(email);

      if (user && user.length > 0) {
        return res.status(401).json({ message: "User already exists" });
      }

      const secretKey = process.env.JWT_SECRET_KEY as string; // Replace this with your actual environment variable name
      if (!secretKey) {
        return res.status(500).json({ message: "JWT secret key not found" });
      }

      const createdUser = await this.userService.createUser(username, email, password);
      const token = jwt.sign({createdUser}, secretKey, { expiresIn: "1h" });

      return res.status(200).json({ jwt: token, userId: createdUser.userId });

    } catch(error){
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Failed to log in" });
    }
  };

  loginUser = async (req: Request, res: Response): Promise<Response | void> => {
    const { email, password } = req.body;

    try {
      const user = await this.userService.getSingleUserByEmail(email);

      if (!user || user.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const secretKey = process.env.JWT_SECRET_KEY as string; // Replace this with your actual environment variable name


      if (!secretKey) {
        return res.status(500).json({ message: "JWT secret key not found" });
      }

      const userMatch = await this.userService.loginUser(email, password)
      if (!userMatch) {
        return res.status(400).json({message: "Invalid password entered"})
      }

      const token = jwt.sign({userMatch}, secretKey, { expiresIn: "1h" });

      return res.status(200).json({ jwt: token, userId: userMatch.userId });
    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Failed to log in" });
    }
  };

  createApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
    const {
      firstName,
      lastName,
      mobileNumber,
      country,
      address,
      city,
      gender,
      height,
      ethnicity,
      religion,
      practicing,
      marital_status,
      wantChildren,
      hasChildren,
      universityDegreeSubject,
      highestQualification,
      profession,
      howDidYouLearnAboutUs,
      birthday,
      annualIncome,
      netWorth,
      contactPreference,
      consultationPreference,
      consent
    } = req.body;

    const { userId } = req.params;
    console.log(req.body)

    try {

      const found = await this.userService.getUserProfileInfoByUserId(userId);
      if (found) {
        return res.status(400).json({message: "This user has already made an application"})
      }


      const userProfileInfo = await this.userService.saveApplication(
        userId,
        firstName,
        lastName,
        birthday,
        mobileNumber,
        country,
        address,
        gender,
        height,
        ethnicity,
        religion,
        practicing,
        marital_status,
        wantChildren,
        hasChildren,
        universityDegreeSubject,
        highestQualification,
        profession,
        howDidYouLearnAboutUs,
        city,
        contactPreference,
        consultationPreference,
        consent,
        annualIncome,
        netWorth,
      );

      const s3Url = await this.userService.genereateS3Url(userProfileInfo.userBioId)
      console.log(s3Url)

      return res.status(201).json({ userProfileInfo, url: s3Url });
    } catch (error) {
      console.error("Error creating profile information:", error);
      return res
        .status(500)
        .json({ message: "Failed to create profile information" });
    }
  };

  amendApplication = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params;
    console.log(userId);

    if (typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid userId" });
    }

    try {
      const userProfileInfo = await this.userService.getSingleUserByUserId(userId);
      console.log(userProfileInfo)

      if (!userProfileInfo) {
        return res.status(404).json({ message: "User not found" });
      }
      const {
        mobileNumber,
        address,
        gender,
        height,
        ethnicity,
        religion,
        practicing,
        marital_status,
        wantChildren,
        hasChildren,
        universityDegreeSubject,
        highestQualification,
        profession,
        photo,
      } = req.body;

      const url = await this.userService.amend(
        userId,
        mobileNumber,
        address,
        gender,
        height,
        ethnicity,
        religion,
        practicing,
        marital_status,
        wantChildren,
        hasChildren,
        universityDegreeSubject,
        highestQualification,
        profession,
        photo,
      );

      return res
        .status(200)
        .json({ message: "Application amended successfully", userProfileInfo, s3Link: url});
    } catch (error) {
      console.error("Error amending application:", error);
      return res.status(500).json({ message: "Failed to amend application" });
    }
  };

  requestPasswordReset = async (req: Request, res: Response): Promise<Response | void> => {
    const { email } = req.body;

    try {
      const user = await this.userService.getSingleUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userId = user[0].userId.S as string
      const resetToken = generateResetToken();
      const resetTokenExpires = Math.floor(Date.now() / 1000) + 3600
      const mailOptions = {
        from: 'jettamatchmaking@outlook.com',
        to: email,
        subject: 'Password Reset Request',
        text: `To reset your password, click the following link: ${getResetLink(resetToken)}`,
      };

      await this.userService.saveResetToken(userId, resetToken, resetTokenExpires)
      await this.transporter.sendMail(mailOptions);

      // Return a success response
      return res.status(200).json({ message: "Password reset instructions sent to your email" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      return res.status(500).json({ message: "Failed to request password reset" });
    }
  };

  updatePassword = async (req: Request, res: Response): Promise<Response | void> => {
    const { token, newPassword, email } = req.body;

    try {
      // Check if the provided reset token is valid (e.g., not expired and matches a stored token)
      const user = await this.userService.getSingleUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const userId = user[0].userId.S as string
      const isValidToken = await this.userService.validateResetToken(token, userId);

      if (!isValidToken) {
        return res.status(401).json({ message: "Invalid or expired reset token" });
      }

      const isPasswordUpdated = await this.userService.updatePassword(userId, newPassword);

      if (!isPasswordUpdated) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      return res.status(500).json({ message: "Failed to update password" });
    }
  };

}
