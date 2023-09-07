import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      admin?: { adminData: JwtPayload };
    }
  }
}
