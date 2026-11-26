import type { WomsApi } from './contract';
import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';

/**
 * Có VITE_API_BASE_URL thì gọi backend thật, không thì dùng dữ liệu giả.
 * Ví dụ: tạo file .env.local với dòng VITE_API_BASE_URL=http://localhost:3000/api
 */
const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const api: WomsApi = base ? createHttpApi(base) : createMockApi();
