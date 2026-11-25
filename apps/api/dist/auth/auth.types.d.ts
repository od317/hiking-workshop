import type { Request } from 'express';
export interface AuthUser {
    id: string;
    username: string;
}
export interface AuthedRequest extends Request {
    user?: AuthUser;
}
