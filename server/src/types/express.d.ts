export interface AuthUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
