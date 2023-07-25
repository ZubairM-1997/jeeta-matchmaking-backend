import express, { Application } from "express";
import cors from "cors";
import bodyParser from 'body-parser'
import { DynamoDB, S3 } from 'aws-sdk';
import UsersController from "./resources/user/users.controller"


export default class App {
	public express: Application;
	public dbClient : DynamoDB
	public s3Client: S3

	constructor(dbClient: DynamoDB, s3Client: S3) {
		this.express = express();
		this.dbClient = dbClient;
		this.s3Client = s3Client;
	}

	private initialiseMiddleWare(): void {
		this.express.use(cors());
		this.express.use(bodyParser.json());
		this.express.use(bodyParser.urlencoded({ extended: false }));
	}

	private async initialiseDatabaseConnection() {
		return new Promise<void>((resolve, reject) => {
		  this.dbClient.listTables((err, data) => {
			if (err) {
			  console.error('Error connecting to DynamoDB:', err);
			  reject(err);
			} else {
			  console.log('Connected to DynamoDB');
			  resolve();
			}
		  });
		});
	}

	private initialiseControllers(){
		const usersController = new UsersController(this.dbClient, this.s3Client);
		this.express.use(`/api`, usersController.router);

	}

	public async init(): Promise<void> {
		try {
		  // initialise middleware
		  this.initialiseMiddleWare();

		  // initialise database connection
		  await this.initialiseDatabaseConnection();

		} catch (err) {
		  console.error('Failed to initialise app:', err);
		  throw err;
		}
	  }

	public async listen(port: number): Promise<void> {
		// initialize the app
		await this.init();
		this.express.listen(port, () => {
		  console.log(`App listening on port ${port}`);
		});
	}
}