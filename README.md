# Jetta Matchmaking backend

This is an Express.js backend written in Typescript, utilising AWS (S3 and DynamoDB) for a full stack project

## Getting started

1) Clone this repository
2) install the dependancies by using 'npm install'
3) create a .env file in the root of this project with the following

AWS_ACCESS_KEY_ID=

AWS_SECRET_ACCESS_KEY=

JWT_SECRET_KEY=

ADMIN_SECRET_KEY=

GOOGLE_CLIENT_ID=

You will have to create a JWT secret key for ADMIN_SECRET_KEY and JWT_SECRET_KEY

You will need to create an AWS account to get AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

You will need to create a Google Cloud account to get the ID for GOOGLE_CLIENT_ID

4) After you have done that, type 'npm run dev' to run the development server

On AWS, you need need to create 3 DynamoDB tables, one named "users", the second being "user_bio_info" and the last one named "admins".

on AWS, you will also need to create an S3 bucket named "user_bio_pics"

All this infrastructure should be set up in the "eu-north-1" region on AWS

There are 6 Admin endpoints

1) GET /api/admin/:userId
2) GET /api/admin/getAllUsers
3) POST /api/admin/search
4) POST /api/admin/createAdmin
5) POST /api/admin/loginAdmin
6) PUT /api/admin/:userId/approveApplication

There are 6 User endpoints
1) POST /api/user/sign_up
2) POST /api/user/sign_in
3) POST /api/user/google/sign_up
4) POST /api/user/google/sign_in
5) POST /api/user/:userId/createApplication
6) PUT /api/user/:userId/amendApplication