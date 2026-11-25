"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = void 0;
const zod_1 = require("zod");
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: zod_1.z.coerce.number().default(3000),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(8),
    JWT_REFRESH_SECRET: zod_1.z.string().min(8),
    S3_ENDPOINT: zod_1.z.string().url(),
    S3_REGION: zod_1.z.string(),
    S3_BUCKET: zod_1.z.string(),
    S3_ACCESS_KEY: zod_1.z.string(),
    S3_SECRET_KEY: zod_1.z.string(),
});
const validateEnv = (config) => schema.parse(config);
exports.validateEnv = validateEnv;
//# sourceMappingURL=env.js.map