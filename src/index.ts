import { authService } from './services/auth';
import { companyService } from './services/company';

export const authServiceId = authService.id;
export const companyServiceId = companyService.id;
export { adminUrl } from './services/loadBalancer';
