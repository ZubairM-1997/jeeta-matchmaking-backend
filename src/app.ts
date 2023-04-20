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

	}

	public async init(): Promise<void> {

	}

	public async listen(port: number): Promise<void> {
		// initialize the app
		await this.init();
		this.express.listen(port, () => {
		  console.log(`App listening on port ${port}`);
		});
	}
}