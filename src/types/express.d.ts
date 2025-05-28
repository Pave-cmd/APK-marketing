import { Request as ExpressRequest } from 'express';
import { IUser } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

export interface AuthRequest extends ExpressRequest {
  userId?: string;
  user?: IUser;
}