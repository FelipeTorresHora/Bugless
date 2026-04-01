import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

function parseCookieHeader(rawCookie: string | undefined): Record<string, string> {
  if (!rawCookie) return {};

  return rawCookie.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    const value = rest.join("=");
    acc[rawKey] = decodeURIComponent(value || "");
    return acc;
  }, {});
}

export function cookieMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.cookies = parseCookieHeader(req.headers.cookie);
  next();
}

export default cookieMiddleware;
