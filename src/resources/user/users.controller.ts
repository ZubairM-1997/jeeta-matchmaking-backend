import { Router, Request, Response } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import UserService from "./users.service";
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

    this.router.post(
      `${this.path}/:userId/createApplication`,
      this.createApplication,
    );

    this.router.put(
      `${this.path}/:userId/amendApplication`,
      this.amendApplication,
    );
  }

  createUser = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
    const { username, email, password } = req.body;

    const user = await this.userService.createUser(username, email, password);

    if (user) {
      res.status(200).send({
        user,
      });
    } else {
      res.status(422).json({
        message: "User already exists",
      });
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

    try {
      const userProfileInfo = await this.userService.getSingleUserByUserId(userId);

      if (!userProfileInfo) {
        return res.status(404).json({ message: "User not found" });
      }
      const {
        firstName,
        lastName,
        mobileNumber,
        country,
        email,
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
        firstName,
        email,
        lastName,
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
