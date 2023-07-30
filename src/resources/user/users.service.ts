const AWS = require("aws-sdk");

import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export default class UserService {
  public dbClient: AWS.DynamoDB;
  public s3Client: AWS.S3;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.dbClient = dbClient;
    this.s3Client = s3Client;
  }

  // these functions will directly call dynamoDb to implement the right queries

  async getSingleUserByUserId(userId: string) {
      const params = {
        TableName: "users",
        Key: {
          userId: { S: userId }, // Assuming userId is a string, adjust the type if it's different
        },
      };

      try {
        const data = await this.dbClient.getItem(params).promise();
        return data.Item; // This will contain the user with the specified userId if found, otherwise null
      } catch (error) {
        console.error("Error fetching user by userId:", error);
        throw error;
      }

  }

  async getSingleUserByEmail(email: string){
    const params = {
      TableName: "users",
      FilterExpression: "email = :emailValue",
      ExpressionAttributeValues: {
        ":emailValue": { S: email },
      },
    };
    try {
      const data = await this.dbClient.scan(params).promise();
      return data.Items; // This will contain an array of users with the specified email if found, otherwise an empty array
    } catch (error) {
      console.error("Error scanning users by email:", error);
      throw error;
    }

  }

  public async createUser(username: string, email: string, password: string) {
    const existingUser = await this.getSingleUserByEmail(email);
    console.log(existingUser)
    if (existingUser?.length !== 0) {
      throw new Error("User with this email already exists.");
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
      TableName: "users",
      Item: user,
    };

    try {
      // Save the user to DynamoDB
      await this.dbClient.putItem(params).promise();
      console.log("User created successfully.");
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async saveApplication(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    birthday: string,
    mobileNumber: string,
    country: string,
    address: string,
    gender: string,
    height: string,
    ethnicity: string,
    religion: string,
    practicing: string,
    marital_status: string,
    wantChildren: string,
    hasChildren: string,
    universityDegree: string,
    profession: string,
    howDidYouLearnAboutUs: string,
    photo: Buffer,
    city: string,
    annualIncome?: number,
    netWorth?: number,
  ) {

    const annualIncomeStr = annualIncome !== undefined ? annualIncome.toString() : null;
    const netWorthStr = netWorth !== undefined ? netWorth.toString() : null;


    const dobParts = birthday.split("/"); // Split the date string into parts
    const userBirthDate = new Date(
      `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`,
    ); // Format the date as "YYYY-MM-DD"
    const today = new Date();
    let age = today.getFullYear() - userBirthDate.getFullYear();
    const monthDifference = today.getMonth() - userBirthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < userBirthDate.getDate())
    ) {
      age--; // Reduce age if the user hasn't celebrated the birthday yet this year
    }

    const userBio = {
      userBioId: AWS.DynamoDB.Converter.input(uuidv4()),
      userId: AWS.DynamoDB.Converter.input(userId),
      email: AWS.DynamoDB.Converter.input(email),
      firstName: AWS.DynamoDB.Converter.input(firstName),
      lastName: AWS.DynamoDB.Converter.input(lastName),
      birthday: AWS.DynamoDB.Converter.input(birthday),
      age: AWS.DynamoDB.Converter.input(age.toString()),
      mobileNumber: AWS.DynamoDB.Converter.input(mobileNumber),
      country: AWS.DynamoDB.Converter.input(country),
      address: AWS.DynamoDB.Converter.input(address),
      gender: AWS.DynamoDB.Converter.input(gender),
      height: AWS.DynamoDB.Converter.input(height),
      ethnicity: AWS.DynamoDB.Converter.input(ethnicity),
      religion: AWS.DynamoDB.Converter.input(religion),
      practicing: AWS.DynamoDB.Converter.input(practicing),
      marital_status: AWS.DynamoDB.Converter.input(marital_status),
      wantChildren: AWS.DynamoDB.Converter.input(wantChildren),
      hasChildren: AWS.DynamoDB.Converter.input(hasChildren),
      annualIncome: AWS.DynamoDB.Converter.input(annualIncomeStr),
      netWorth: AWS.DynamoDB.Converter.input(netWorthStr),
      universityDegree: AWS.DynamoDB.Converter.input(universityDegree),
      profession: AWS.DynamoDB.Converter.input(profession),
      howDidYouLearnAboutUs: AWS.DynamoDB.Converter.input(howDidYouLearnAboutUs),
      approved: AWS.DynamoDB.Converter.input("false"),
      city: AWS.DynamoDB.Converter.input(city),
    };

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: "user_bios",
      Item: userBio,
    };
    try {
      // Save the user bio to DynamoDB
      await this.dbClient.putItem(params).promise();
      console.log("User bio created successfully.");

      await this.uploadPhotoToS3(userBio.userBioId, photo);
      return userBio
    } catch (error) {
      console.error("Error saving user bio:", error);
      throw error;
    }
  }

  async amend(
    userId: string,
    firstName: string,
    lastName: string,
    email: string,
    mobileNumber: string,
    country: string,
    address: string,
    gender: string,
    height: string,
    ethnicity: string,
    religion: string,
    practicing: string,
    marital_status: string,
    wantChildren: string,
    universityDegree: string,
    profession: string,
    howDidYouLearnAboutUs: string,
    birthday: string,
    photo: Buffer,
  ): Promise<void> {
    try {
      const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: "user_bios",
        Key: {
          userId: { S: userId },
        },
      };

      const result = await this.dbClient.getItem(params).promise();
      const userProfileInfo =
        result.Item as AWS.DynamoDB.DocumentClient.AttributeMap;

      userProfileInfo.userId = userId;
      userProfileInfo.firstName = firstName;
      userProfileInfo.email = email;
      userProfileInfo.lastName = lastName;
      userProfileInfo.mobileNumber = mobileNumber;
      userProfileInfo.country = country;
      userProfileInfo.address = address;
      userProfileInfo.gender = gender;
      userProfileInfo.height = height;
      userProfileInfo.ethnicity = ethnicity;
      userProfileInfo.religion = religion;
      userProfileInfo.practicing = practicing;
      userProfileInfo.marital_status = marital_status;
      userProfileInfo.wantChildren = wantChildren;
      userProfileInfo.universityDegree = universityDegree;
      userProfileInfo.profession = profession;
      userProfileInfo.howDidYouLearnAboutUs = howDidYouLearnAboutUs;
      userProfileInfo.birthday = birthday;
      userProfileInfo.photo = photo;

      const updateParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: "user_bios",
        Item: userProfileInfo,
      };

      await this.dbClient.putItem(updateParams).promise();
      console.log("User profile info updated successfully.");
    } catch (error) {
      console.error("Error approving application:", error);
      throw error;
    }
  }

  private async uploadPhotoToS3(userBioId: string, photo: Buffer) {
    // Prepare the parameters for S3 PutObject operation
    const params = {
      Bucket: "user-bio-pics", // Replace with the name of your S3 bucket
      Key: userBioId, // Use the userBioId as the key for the S3 object to associate it with the user bio
      Body: photo, // The photo data you want to upload (e.g., a Buffer or a ReadableStream)
      ContentType: "image/jpeg", // Adjust the content type based on the type of photo you are uploading
      // You can also add additional metadata or ACL settings as needed.
    };

    try {
      await this.s3Client.putObject(params).promise();
      console.log("Photo uploaded to S3 successfully.");
    } catch (error) {
      console.error("Error uploading photo to S3:", error);
      throw error;
    }
  }
}
