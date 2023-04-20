import express, { Application } from "express";
import cors from "cors";
import bodyParser from 'body-parser'
import { DynamoDB } from 'aws-sdk';


class App {
	public express: Application;
	public dbClient : DynamoDB

	constructor(dbClient: DynamoDB) {
		this.express = express();
		this.dbClient = dbClient;
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