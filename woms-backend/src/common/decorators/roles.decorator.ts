import { SetMetadata } from '@nestjs/common';

export enum RoleEnum {
  CUSTOMER = 'CUSTOMER',         // Khách hàng
  RECEPTIONIST = 'RECEPTIONIST', // Nhân viên tiếp nhận
  CSKH = 'CSKH',                 // Nhân viên chăm sóc khách hàng/bảo hành
  COORDINATOR = 'COORDINATOR',   // Điều phối viên
  TECHNICIAN = 'TECHNICIAN',     // Kỹ thuật viên
  WAREHOUSE = 'WAREHOUSE',       // Nhân viên kho
  QC = 'QC',                     // Nhân viên kiểm tra chất lượng
  MANAGER = 'MANAGER',           // Quản lý
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleEnum[]) => SetMetadata(ROLES_KEY, roles);