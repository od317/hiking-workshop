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
    ACCESS_TTL_SECONDS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    REFRESH_TTL_DAYS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
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
    ACCESS_TTL_SECONDS: number;
    REFRESH_TTL_DAYS: number;
    S3_ENDPOINT: string;
    S3_REGION: string;
    S3_BUCKET: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
};
export {};
