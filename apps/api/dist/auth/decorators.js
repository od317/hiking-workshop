"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = exports.Public = exports.IS_PUBLIC = void 0;
const common_1 = require("@nestjs/common");
exports.IS_PUBLIC = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC, true);
exports.Public = Public;
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    return ctx.switchToHttp().getRequest().user;
});
//# sourceMappingURL=decorators.js.map