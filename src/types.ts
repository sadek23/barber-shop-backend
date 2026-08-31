export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

export type UserPayload = {
  id: number;
  email: string;
  role: 'customer' | 'owner' | 'admin';
};

export type Variables = {
  user: UserPayload;
};

export type Env = {
  Bindings: Bindings;
  Variables: Variables;
};
