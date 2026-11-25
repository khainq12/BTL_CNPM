import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Khởi tạo đủ 8 vai trò theo C23 & PARAM-12
  const rolesData = [
    { roleName: 'CUSTOMER', description: 'Khách hàng' },
    { roleName: 'RECEPTIONIST', description: 'Nhân viên tiếp nhận' },
    { roleName: 'CSKH', description: 'Nhân viên chăm sóc khách hàng/bảo hành' },
    { roleName: 'COORDINATOR', description: 'Điều phối viên' },
    { roleName: 'TECHNICIAN', description: 'Kỹ thuật viên' },
    { roleName: 'WAREHOUSE', description: 'Nhân viên kho' },
    { roleName: 'QC', description: 'Nhân viên kiểm tra chất lượng' },
    { roleName: 'MANAGER', description: 'Quản lý trung tâm' },
  ];

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { roleName: r.roleName },
      update: {},
      create: r,
    });
  }

  // 2. Khởi tạo các tham số nghiệp vụ cốt lõi (Mục 5.5)
  const params = [
    { paramCode: 'PARAM-03', paramName: 'Ngưỡng báo giá cần phê duyệt', paramValue: '2000000', unit: 'VND' },
    { paramCode: 'PARAM-08', paramName: 'Thời hạn xử lý sửa chữa thông thường', paramValue: '3', unit: 'WORK_DAYS' },
    { paramCode: 'PARAM-09', paramName: 'Ngưỡng cảnh báo sắp quá hạn', paramValue: '4', unit: 'WORK_HOURS' },
    { paramCode: 'PARAM-10', paramName: 'Số lần sửa lại tối đa trước khi chuyển quản lý', paramValue: '2', unit: 'TIMES' },
  ];

  for (const p of params) {
    await prisma.systemParameter.upsert({
      where: { paramCode: p.paramCode },
      update: {},
      create: p,
    });
  }

  // 3. Tạo tài khoản test (Mật khẩu chung: 123456)
  const passwordHash = await bcrypt.hash('123456', 10);
  const managerRole = await prisma.role.findUnique({ where: { roleName: 'MANAGER' } });
  const recepRole = await prisma.role.findUnique({ where: { roleName: 'RECEPTIONIST' } });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@woms.vn' },
    update: {},
    create: {
      fullName: 'Quản Lý Trung Tâm',
      email: 'manager@woms.vn',
      phone: '0900000001',
      passwordHash,
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: 'tiepnhan@woms.vn' },
    update: {},
    create: {
      fullName: 'Nhân Viên Tiếp Nhận',
      email: 'tiepnhan@woms.vn',
      phone: '0900000002',
      passwordHash,
    },
  });

  if (managerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: manager.userId, roleId: managerRole.roleId } },
      update: {},
      create: { userId: manager.userId, roleId: managerRole.roleId },
    });
  }

  if (recepRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: receptionist.userId, roleId: recepRole.roleId } },
      update: {},
      create: { userId: receptionist.userId, roleId: recepRole.roleId },
    });
  }

  console.log('Seed dữ liệu 8 Roles, Parameters và User mẫu thành công!');

  // 4. Bổ sung tài khoản cho các vai trò còn lại (Mật khẩu chung: 123456)
  const extraAccounts = [
    { email: 'cskh@woms.vn', fullName: 'Nhân Viên CSKH', phone: '0900000003', role: 'CSKH' },
    { email: 'dieuphoi@woms.vn', fullName: 'Điều Phối Viên', phone: '0900000004', role: 'COORDINATOR' },
    { email: 'kythuat@woms.vn', fullName: 'Kỹ Thuật Viên Trưởng', phone: '0900000005', role: 'TECHNICIAN' },
    { email: 'kho@woms.vn', fullName: 'Nhân Viên Kho', phone: '0900000006', role: 'WAREHOUSE' },
    { email: 'qc@woms.vn', fullName: 'Nhân Viên QC', phone: '0900000007', role: 'QC' },
  ];

  for (const acc of extraAccounts) {
    const roleRecord = await prisma.role.findUnique({ where: { roleName: acc.role } });
    const createdUser = await prisma.user.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        fullName: acc.fullName,
        email: acc.email,
        phone: acc.phone,
        passwordHash,
      },
    });
    if (roleRecord) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: createdUser.userId, roleId: roleRecord.roleId } },
        update: {},
        create: { userId: createdUser.userId, roleId: roleRecord.roleId },
      });
    }
  }

  // 5. Tạo linh kiện mẫu trong kho
  const sampleParts = [
    { sku: 'LCD-XPS15-OLED', partName: 'Màn hình OLED Dell XPS 15 9530', unit: 'Cụm', stockQty: 8, minStock: 3, unitPrice: 2200000 },
    { sku: 'BAT-DELL-86WH', partName: 'Pin Dell 6-Cell 86Wh Zin', unit: 'Viên', stockQty: 15, minStock: 5, unitPrice: 1450000 },
    { sku: 'FAN-CPU-XPS', partName: 'Quạt tản nhiệt CPU Dell XPS', unit: 'Cái', stockQty: 4, minStock: 4, unitPrice: 450000 },
  ];

  for (const part of sampleParts) {
    await prisma.part.upsert({
      where: { sku: part.sku },
      update: {},
      create: part,
    });
  }
}




main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());