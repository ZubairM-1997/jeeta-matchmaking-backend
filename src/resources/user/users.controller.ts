import { Router, Request, Response } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import UserService from "./users.service";
import jwt from "jsonwebtoken";
import { authenticateUserToken } from '../../middleware/middleware';
const AWS = require("aws-sdk");

export default class UsersController implements Controller {
  public path = "/user";
  public router = Router();
  userService;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.initialiseRoutes();
    this.userService = new UserService(dbClient, s3Client);
  }

  initialiseRoutes(): void {
    this.router.post(`${this.path}/sign_up`, this.createUser);
    this.router.post(`${this.path}/sign_in`, this.loginUser);

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
  }

  createUser = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
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

      return res.status(200).json({ token });

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

      return res.status(200).json({ token });
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
      universityDegree,
      profession,
      howDidYouLearnAboutUs,
      birthday,
      annualIncome,
      netWorth,
      photo
    } = req.body;

    const { userId } = req.params;


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
        universityDegree,
        profession,
        howDidYouLearnAboutUs,
        photo,
        city,
        annualIncome,
        netWorth,
      );
      return res.status(201).json({ userProfileInfo });
    } catch (error) {
      console.error("Error creating profile information:", error);
      return res
        .status(500)
        .json({ message: "Failed to create profile information" });
    }
  };

  amendApplication = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params;

    if (typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid userId" });
    }

    try {
      const userProfileInfo = await this.userService.getSingleUserByUserId(userId);

      if (!userProfileInfo) {
        return res.status(404).json({ message: "User not found" });
      }
      const {
        fullName,
        mobileNumber,
        address,
        gender,
        height,
        ethnicity,
        religion,
        practicing,
        marital_status,
        wantChildren,
        universityDegree,
        profession,
        howDidYouLearnAboutUs,
        birthday,
        photo,
      } = req.body;


      await this.userService.amend(
        userId,
        fullName,
        mobileNumber,
        address,
        gender,
        height,
        ethnicity,
        religion,
        practicing,
        marital_status,
        wantChildren,
        universityDegree,
        profession,
        howDidYouLearnAboutUs,
        birthday,
        photo,
      );

      return res
        .status(200)
        .json({ message: "Application amended successfully", userProfileInfo });
    } catch (error) {
      console.error("Error amending application:", error);
      return res.status(500).json({ message: "Failed to amend application" });
    }
  };
}
