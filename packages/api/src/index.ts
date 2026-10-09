export { appRouter, type AppRouter } from "./root";
export { createContext, type Context } from "./trpc";
export {
  findOrCreateOAuthUser,
  isPersonalEmailDomain,
  schoolDomainFromEmail,
  signupUser,
  signMobileToken,
  verifyCredentials,
  verifyMobileToken,
} from "./auth";
export { createMaterialFromFile } from "./routers/material";
export { isAiConfigured } from "./ai";
export { isEmailConfigured } from "./email";
