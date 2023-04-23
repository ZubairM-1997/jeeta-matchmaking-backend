import { DynamoDB } from 'aws-sdk';

export default class UserService {

	public dbClient: DynamoDB

	constructor(dbClient: DynamoDB) {
		this.dbClient = dbClient;
	}

	// these functions will directly call dynamoDb to implement the right queries

	public async getSingleUser(
		userId: string,
	  ) : Promise<any> {
		

	}

	public async getAllUsers(){

	}

	public async createUser(){

	}


}