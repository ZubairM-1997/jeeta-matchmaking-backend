import { DynamoDB } from 'aws-sdk';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export default class UserService {

	public dbClient: DynamoDB

	constructor(dbClient: DynamoDB) {
		this.dbClient = dbClient;
	}

	// these functions will directly call dynamoDb to implement the right queries

	async getSingleUser(userId?: string, email?: string): Promise<any> {
		if (userId && !email) {
		  // Search by userId
		  const params = {
			TableName: 'users',
			Key: {
			  userId: { S: userId }, // Assuming userId is a string, adjust the type if it's different
			},
		  };

		  try {
			const data = await this.dbClient.getItem(params).promise();
			return data.Item; // This will contain the user with the specified userId if found, otherwise null
		  } catch (error) {
			console.error('Error fetching user by userId:', error);
			throw error;
		  }
		} else if (email && !userId) {
		  // Search by email
		  const params = {
			TableName: 'users',
			FilterExpression: 'email = :emailValue',
			ExpressionAttributeValues: {
			  ':emailValue': { S: email },
			},
		  };

		  try {
			const data = await this.dbClient.scan(params).promise();
			return data.Items; // This will contain an array of users with the specified email if found, otherwise an empty array
		  } catch (error) {
			console.error('Error scanning users by email:', error);
			throw error;
		  }
		} else {
		  throw new Error('Either userId or email must be provided.');
		}
	}

	public async getAllUsers(){

	}

	public async createUser(username: string, email: string, password: string) {
		const existingUser = await this.getSingleUser(email);
		if (existingUser) {
		throw new Error('User with this email already exists.');
		}
		// Encrypt the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create a new user object
		const user = {
		  userId: { S: uuidv4() }, // You can use any logic to generate a unique userId, such as UUID
		  username: { S: username },
		  email: { S: email },
		  password: { S: hashedPassword },
		};

		// Prepare the parameters for DynamoDB PutItem operation
		const params = {
		  TableName: 'users',
		  Item: user,
		};

		try {
		  // Save the user to DynamoDB
		  await this.dbClient.putItem(params).promise();
		  return user;
		  console.log('User created successfully.');
		} catch (error) {
		  console.error('Error creating user:', error);
		  throw error;
		}
	  }
}



