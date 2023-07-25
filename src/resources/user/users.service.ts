import { DynamoDB, S3 } from 'aws-sdk';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export default class UserService {

	public dbClient: DynamoDB
	public s3Client: S3

	constructor(
		dbClient: DynamoDB,
		s3Client: S3
	)
	{
		this.dbClient = dbClient;
		this.s3Client = s3Client;
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
		const params = {
			TableName: 'user_bios',
		  };

		  try {
			// Perform the DynamoDB Scan operation to fetch all user_bios
			const scanResult = await this.dbClient.scan(params).promise();

			// Iterate through each user_bio and fetch the corresponding photo from S3
			if (scanResult.Items) {
				// Iterate through each user_bio and fetch the corresponding photo from S3
				const usersWithPhotos = await Promise.all(
				  scanResult.Items.map(async (userBio) => {
					const userBioId = userBio.userBioId.S;
					const photo = await this.getUserBioPhotoFromS3(userBioId);
					return { ...userBio, photo };
				  })
				);

				return usersWithPhotos;
			  } else {
				// Handle the case where scanResult.Items is undefined (no items found in the scan)
				console.warn('No user_bios found in the DynamoDB table.');
				return [];
			  }
		  } catch (error) {
			console.error('Error fetching all users:', error);
			throw error;
		  }
	}

	private async getUserBioPhotoFromS3(userBioId: string): Promise<string | null> {
		
		// Prepare the parameters for S3 GetObject operation
		const params = {
		  Bucket: 'user-bio-pics', // Replace with the name of your S3 bucket
		  Key: userBioId,
		};

		try {
		  // Fetch the photo from S3
		  const data = await this.s3Client.getObject(params).promise();
		  return data.Body?.toString('base64') || null;
		} catch (error) {
		  // If the photo is not found in S3 or any other error occurs, return null
		  console.error(`Error fetching photo for userBioId: ${userBioId}`, error);
		  return null;
		}
	  }

	public async createUser(username: string, email: string, password: string) {
		const existingUser = await this.getSingleUser(email);
		if (existingUser) {
		throw new Error('User with this email already exists.');
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		// Create a new user object
		const user = {
		  userId: { S: uuidv4() },
		  username: { S: username },
		  email: { S: email },
		  password: { S: hashedPassword },
		};

		const params = {
		  TableName: 'users',
		  Item: user,
		};

		try {
		  // Save the user to DynamoDB
		  await this.dbClient.putItem(params).promise();
		  console.log('User created successfully.');
		  return user;
		} catch (error) {
		  console.error('Error creating user:', error);
		  throw error;
		}
	  }

	  async saveUserBio(
		userId : string,
		firstName: string,
		lastName: string,
		mobileNumber: string,
		country: string,
		address: string,
		gender: string,
		height: string,
		ethnicity: string,
		photo: Buffer
	  ) {
		// Create a new user bio object
		const userBio = {
		  userBioId: { S: uuidv4() },
		  userId: { S: userId },
		  firstName: { S: firstName },
		  lastName: { S: lastName },
		  mobileNumber: { S: mobileNumber },
		  country: { S: country },
		  address: { S: address },
		  gender: { S: gender },
		  height: { N: height },
		  ethnicity: { S: ethnicity },
		  // You can also store additional metadata like creation timestamp if needed.
		};

		const params = {
		  TableName: 'user_bios',
		  Item: userBio,
		};

		try {
		  // Save the user bio to DynamoDB
		  await this.dbClient.putItem(params).promise();
		  console.log('User bio created successfully.');

		  await this.uploadPhotoToS3(userBio.userBioId.S, photo);

		  return userBio
		} catch (error) {
		  console.error('Error saving user bio:', error);
		  throw error;
		}
	  }

	  private async uploadPhotoToS3(userBioId: string, photo: Buffer) {
		// Prepare the parameters for S3 PutObject operation
		const params = {
		  Bucket: 'user-bio-pics', // Replace with the name of your S3 bucket
		  Key: userBioId, // Use the userBioId as the key for the S3 object to associate it with the user bio
		  Body: photo, // The photo data you want to upload (e.g., a Buffer or a ReadableStream)
		  ContentType: 'image/jpeg', // Adjust the content type based on the type of photo you are uploading
		  // You can also add additional metadata or ACL settings as needed.
		};

		try {
		  await this.s3Client.putObject(params).promise();
		  console.log('Photo uploaded to S3 successfully.');
		} catch (error) {
		  console.error('Error uploading photo to S3:', error);
		  throw error;
		}
	  }
}



