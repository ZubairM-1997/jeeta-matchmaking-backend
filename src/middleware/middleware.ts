import { Router, Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET_KEY = crypto.randomBytes(32).toString('hex');

async function generateJWT(email: string, password: string) {
	const options = {
		expiresIn: "24h",
	};

	try {
	  const payload = { email, password };
	  const token = await jwt.sign(payload, SECRET_KEY, options);
	  return { error: false, token };
	} catch (error) {
	  return { error: true };
	}
  }

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
	  return res.status(401).json({ message: 'Unauthorized' });
	}

	jwt.verify(token, SECRET_KEY, (err, user) => {
	  if (err) {
		return res.status(403).json({ message: 'Forbidden' });
	  }
	  req.user = user;
	  next();
	});
};