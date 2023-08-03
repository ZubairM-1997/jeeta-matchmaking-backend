declare namespace Express {
	export interface Request {
	  admin?: { adminData: any }; // Replace 'adminData' with the actual property name used in the token
	}
  }
