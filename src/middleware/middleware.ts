import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret, VerifyErrors } from "jsonwebtoken";


export const authenticateAdminToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY as Secret);
    if (decoded){
      next();
    }
  } catch (error) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }
};


export const authenticateUserToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as Secret);
    if (decoded){
      next();
    }
  } catch (error) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }
};