import { DynamoDB, S3 } from "aws-sdk";
import { authenticateToken } from "../../middleware/middleware";
import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import AdminService from "./admin.service";

export default class AdminController implements Controller {
  public path = "/user";
  public router = Router();
  adminService: AdminService;

  constructor(dbClient: DynamoDB, s3Client: S3) {
    this.initialiseRoutes();
    this.adminService = new AdminService(dbClient, s3Client);
  }

  initialiseRoutes(): void {
    //protected route
    this.router.get(`${this.path}/:userId`, authenticateToken, this.getUser);

    // // protected route
    // this.router.get(
    //   `${this.path}/allUsers`,
    //   authenticateToken,
    //   this.getAllUsers,
    // );

    // protected route
    this.router.get(`${this.path}/search`, authenticateToken, this.search);

    // protected route
    this.router.get(
      `${this.path}/:userId/approveApplication`,
      authenticateToken,
      this.approveApplication,
    );
  }

  getUser = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
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

//   getAllUsers = async (
//     req: Request,
//     res: Response,
//     next: NextFunction,
//   ): Promise<Response | void> => {};

  search = async (
    req: Request,
    res: Response,
  ): Promise<Response | void> => {
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
    const searchFilter: Record<string, any> = {};

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
