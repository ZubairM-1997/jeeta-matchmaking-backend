import { Router, Request, Response, NextFunction } from "express";
import Controller from "../../utils/interfaces/controller.interface";
import UserService from './users.service';
import { DynamoDB } from 'aws-sdk';


export default class UsersController implements Controller {
	public path = "/user";
	public router = Router();
	private userService;

	constructor(dbClient: DynamoDB) {
		this.initialiseRoutes();
		this.userService = new UserService(dbClient)

	}

	private initialiseRoutes(): void {
		this.router.get(
		  `${this.path}/:userId`,
		  this.getUser
		);

		this.router.get(
			`${this.path}/allUsers`,
			this.getAllUsers
		);

		this.router.post(
			`${this.path}/sign_up`,
			this.createUser
		);

		this.router.put(
			`${this.path}/:userId/profile_info`,
			this.createProfileInfo
		)

		this.router.put(
			`${this.path}/:userId/analytics`,
			this.analytics
		)

		this.router.put(
			`${this.path}/:userId/contact_preferences`,
			this.createContactPreference
		)
	}

	//these functions will call the userService class and handle errors

	private getUser = async (
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

	private getAllUsers = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {


	}

	private createUser = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {

		const { username, email, password } = req.params

		try {
			const user = await this.userService.createUser(username, email, password);

			if(user){
				res.status(200).send({
					user
				})
			} else {
				res.status(422).json({
					message: "Cannot create user"
				  });
			}
		  } catch(error) {
			throw error;
		  }


	}

	private createProfileInfo = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {


	}

	private analytics = async (
		req: Request,
		res: Response,
		next: NextFunction
	  ): Promise<Response | void> => {


	}

	private createContactPreference = async (
		req: Request,
		res: Response,
		next: NextFunction
	) : Promise<Response | void> => {


	}

}