import { z } from 'zod';
declare const schema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DATABASE_URL: z.ZodString;
    JWT_ACCESS_SECRET: z.ZodString;
    JWT_REFRESH_SECRET: z.ZodString;
    S3_ENDPOINT: z.ZodString;
    S3_REGION: z.ZodString;
    S3_BUCKET: z.ZodString;
    S3_ACCESS_KEY: z.ZodString;
    S3_SECRET_KEY: z.ZodString;
}, z.core.$strip>;
export type Env = z.infer<typeof schema>;
export declare const validateEnv: (config: Record<string, unknown>) => {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    S3_ENDPOINT: string;
    S3_REGION: string;
    S3_BUCKET: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
};
export {};
