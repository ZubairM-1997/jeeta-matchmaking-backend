const AWS = require("aws-sdk");

// import { authenticateToken } from "../../middleware/middleware";
import { Router, Request, Response } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import AdminService from "./admin.service";

export interface SearchFilter {
  gender?: string;
  city?: string;
  age?: number;
  religion?: string;
  ethnicity?: string;
  height?: number;
  hasChildren?: boolean;
  wantChildren?: boolean;
  profession?: string;
  education?: string;
}

export default class AdminController implements Controller {
  public path = "/user";
  public router = Router();
  adminService: AdminService;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.initialiseRoutes();
    this.adminService = new AdminService(dbClient, s3Client);
  }

  initialiseRoutes(): void {
    //protected route
    this.router.get(`${this.path}/:userId`, this.getUser);

    // protected route
    this.router.get(`${this.path}/allUsers`, this.getAllUsers);

    // protected route
    this.router.post(`${this.path}/search`, this.search);

    this.router.post(`${this.path}/createAdmin`, this.createAdmin)
    this.router.post(`${this.path}/loginAdmin`, this.loginAdmin)

    // protected route
    this.router.get(
      `${this.path}/:userId/approveApplication`,
      this.approveApplication,
    );
  }

  createAdmin = async (req: Request, res: Response): Promise<Response | void> => {

  }

  loginAdmin = async (req: Request, res: Response): Promise<Response | void> => {
    
  }


  getUser = async (req: Request, res: Response): Promise<Response | void> => {
    const { userId } = req.params as { userId: string };

    const user = await this.adminService.getSingleUser(userId);

    if (user) {
      res.status(200).send({
        user,
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
      education,
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
    if (education) searchFilter.education = education;

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
