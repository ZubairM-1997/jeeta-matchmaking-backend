const AWS = require("aws-sdk");

import jwt from "jsonwebtoken";
import { Router, Request, Response } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import AdminService from "./admin.service";
import { authenticateAdminToken } from '../../middleware/middleware';

export interface SearchFilter {
  gender?: string;
  city?: string;
  age?: number;
  religion?: string;
  ethnicity?: string;
  height?: number;
  hasChildren?: string;
  wantChildren?: string;
  profession?: string;
  universityDegree?: string;
}

export default class AdminController implements Controller {
  public path = "/admin";
  public router = Router();
  adminService: AdminService;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.initialiseRoutes();
    this.adminService = new AdminService(dbClient, s3Client);
  }

  initialiseRoutes(): void {
    //protected route
    this.router.get(`${this.path}/:userId`, authenticateAdminToken, this.getUser);

    // protected route
    this.router.get(`${this.path}/allUsers`, authenticateAdminToken, this.getAllUsers);

    // protected route
    this.router.post(`${this.path}/search`, authenticateAdminToken, this.search);

    this.router.post(`${this.path}/createAdmin`, this.createAdmin)
    this.router.post(`${this.path}/loginAdmin`, this.loginAdmin)


    this.router.put(
      `${this.path}/:userId/approveApplication`,
      authenticateAdminToken,
      this.approveApplication,
    );
  }

  createAdmin = async (req: Request, res: Response): Promise<Response | void> => {
    const { username, password } = req.body;

    const user = await this.adminService.createAdmin(username, password);

    if (user) {
      res.status(200).send({
        user,
      });
    } else {
      res.status(422).json({
        message: `Admin ${username} already exists`,
      });
    }

  }

  loginAdmin = async (req: Request, res: Response): Promise<Response | void> => {
    const { username, password } = req.body;

    try {
      const admin = await this.adminService.getSingleAdminByUsername(username);

      if (!admin || admin.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const secretKey = process.env.ADMIN_SECRET_KEY as string; // Replace this with your actual environment variable name


      if (!secretKey) {
        return res.status(500).json({ message: "JWT secret key not found" });
      }

      const adminMatch = await this.adminService.loginAdmin(username, password)
      if (!adminMatch) {
        return res.status(400).json({message: "Invalid password entered"})
      }

      const token = jwt.sign({adminMatch}, secretKey, { expiresIn: "1h" });

      return res.status(200).json({ token });
    } catch (error) {
      console.error("Error during login:", error);
      return res.status(500).json({ message: "Failed to log in" });
    }


  }


  getUser = async (req: Request, res: Response): Promise<Response | void> => {
    const { userId } = req.params as { userId: string };

    const user = await this.adminService.getSingleUserByUserId(userId);
    const userBio = await this.adminService.getUserProfileInfoByUserId(userId);
    let photo;
    if (userBio){
      photo = await this.adminService.getUserBioPhotoFromS3(userBio.userBioId.S)
    }

    if (user) {
      res.status(200).send({
        user: [
          user,
          userBio,
          photo
        ],
      });
    } else {
      res.status(404).json({
        message: "User not found",
      });
    }
  };

  getAllUsers = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
    try {
      const result = this.adminService.getAllUsers();
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to perform the search" });
    }
  };

  search = async (req: Request, res: Response): Promise<Response | void> => {
    const {
      gender,
      city,
      age,
      religion,
      ethnicity,
      height,
      hasChildren,
      wantChildren,
      profession,
      universityDegree,
    } = req.body;

    // Construct a search filter based on the provided parameters
    const searchFilter: SearchFilter = {};

    if (gender) searchFilter.gender = gender;
    if (city) searchFilter.city = city;
    if (age) searchFilter.age = age;
    if (religion) searchFilter.religion = religion;
    if (ethnicity) searchFilter.ethnicity = ethnicity;
    if (height) searchFilter.height = height;
    if (hasChildren) searchFilter.hasChildren = hasChildren;
    if (wantChildren) searchFilter.wantChildren = wantChildren;
    if (profession) searchFilter.profession = profession;
    if (universityDegree) searchFilter.universityDegree = universityDegree;

    try {
      // Call the adminService method to search for users based on the filter
      const searchResults = await this.adminService.searchUsers(searchFilter);

      return res.status(200).json({ searchResults });
    } catch (error) {
      console.error("Error searching users:", error);
      return res.status(500).json({ message: "Failed to perform the search" });
    }
  };

  approveApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const { userId } = req.params;
    const { approved } = req.body;

    try {
      // Call the adminService method to approve the application
      await this.adminService.approve(userId, approved);

      return res
        .status(200)
        .json({ message: "User application status updated successfully" });
    } catch (error) {
      console.error("Error approving application:", error);
      return res.status(500).json({ message: "Failed to approve application" });
    }
  };
}
