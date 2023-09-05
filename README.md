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

There are 5 Admin endpoints

GET /api/admin/:userId
GET /api/admin/getAllUsers
POST /api/admin/search
POST /api/admin/createAdmin
POST /api/admin/loginAdmin
PUT /api/admin/:userId/approveApplication

There are 6 User endpoints
POST /api/user/sign_up
POST /api/user/sign_in
POST /api/user/google/sign_up
POST /api/user/google/sign_in
POST /api/user/:userId/createApplication
PUT /api/user/:userId/amendApplication