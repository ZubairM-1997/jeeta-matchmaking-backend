import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import UserService from './users.service';
import { DynamoDB, S3 } from 'aws-sdk';
import { authenticateToken } from '../../middleware/middleware';


export default class UsersController implements Controller {
	public path = "/user";
	public router = Router();
	userService;

	constructor(dbClient: DynamoDB, s3Client: S3) {
		this.initialiseRoutes();
		this.userService = new UserService(dbClient, s3Client)

	}

	initialiseRoutes(): void {
		//protected route
		this.router.get(
		  `${this.path}/:userId`,
		  authenticateToken,
		  this.getUser
		);

		// protected route
		this.router.get(
			`${this.path}/allUsers`,
			authenticateToken,
			this.getAllUsers
		);

		// protected route
		this.router.get(
			`${this.path}/search`,
			authenticateToken,

		)

		// protected route
		this.router.get(
			`${this.path}/:userId/approveApplication`,
			authenticateToken,
			this.approveApplication
		);

		this.router.post(
			`${this.path}/sign_up`,
			this.createUser
		);

		this.router.post(
			`${this.path}/:userId/createApplication`,
			this.createApplication
		)

		this.router.put(
			`${this.path}/:userId/amendApplication`,
			this.amendApplication
		)
	}

	//these functions will call the userService class and handle errors

	getUser = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {

      const { userId } = req.params as { userId: string };

	  try {
		const user = await this.userService.getSingleUser(userId);

		if(user){
			res.status(200).send({
				user
			})
		} else {
			res.status(404).json({
				message: "User not found"
			  });
		}
	  } catch(error) {
		throw error;
	  }
	}

	getAllUsers = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {


	}

	createUser = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {

		const { username, email, password } = req.body;

		try {
			const user = await this.userService.createUser(username, email, password);

			if(user){
				res.status(200).send({
					user
				})
			} else {
				res.status(422).json({
					message: "User already exists"
				  });
			}
		  } catch(error) {
			throw error;
		  }


	}

	createApplication = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {
		const {
			userId ,
			firstName,
			email,
			lastName,
			mobileNumber,
			country,
			address,
			gender,
			height,
			ethnicity,
			religion ,
			practicing,
			marital_status,
			wantChildren,
			universityDegree,
			profession,
			howDidYouLearnAboutUs,
			birthday,
			photo,
		} = req.body

		try {
			const userProfileInfo = await this.userService.saveApplication(
				userId,
				firstName,
				email,
				lastName,
				mobileNumber,
				address,
				country,
				birthday,
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
				photo,
			);

			return res.status(201).json({ userProfileInfo });
		} catch (error) {
			console.error('Error creating profile information:', error);
			return res.status(500).json({ message: 'Failed to create profile information' });
		}
	}

	approveApplication = async (
		req: Request,
		res: Response
	): Promise<Response> => {
		const { userId } = req.params;
		const { approved } = req.body;

		try {
			// Call the UserService method to approve the application
			await this.userService.approve(userId, approved);

			return res.status(200).json({ message: 'User application status updated successfully' });
		} catch (error) {
			console.error('Error approving application:', error);
			return res.status(500).json({ message: 'Failed to approve application' });
		}
	};

	amendApplication = async (
		req: Request,
		res: Response
	  ): Promise<Response> => {
		const { userId } = req.params;

		try {
		  const userProfileInfo = await this.userService.getSingleUser(userId);

		  if (!userProfileInfo) {
			return res.status(404).json({ message: 'User not found' });
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
			photo
		  );

		  return res.status(200).json({ message: 'Application amended successfully', userProfileInfo });
		} catch (error) {
		  console.error('Error amending application:', error);
		  return res.status(500).json({ message: 'Failed to amend application' });
		}
	};
}









