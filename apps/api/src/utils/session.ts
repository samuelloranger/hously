import { prisma } from "../db";
import { generateOpaqueToken, hashOpaqueToken } from "./tokens";

export const ACCESS_TOKEN_TTL_SECONDS = 7 * 86400;

export const signAccessToken = async (
  jwt: {
    sign: (value: { id: number; ver: number; exp: number }) => Promise<string>;
  },
  userId: number,
  authVersion: number,
): Promise<string> =>
  jwt.sign({
    id: userId,
    ver: authVersion,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });

export const createRefreshToken = async (userId: number): Promise<string> => {
  const token = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revoked: false,
    },
  });
  return token;
};
