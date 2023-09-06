import crypto from 'crypto';

export const generateResetToken = () => {
	const tokenLength = 32; // Length of the reset token
	return crypto.randomBytes(tokenLength).toString('hex');
  };

  // Create a reset link with the reset token
export const getResetLink = (resetToken: string) => {
	const resetLink = `https://jetta-matchmaking.com/reset-password?token=${resetToken}`;
	return resetLink;
};