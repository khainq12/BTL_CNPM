import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Bật CORS cho Frontend (React / Customer Portal / Staff Workspace)
  app.enableCors({
    origin: '*', // Khi deploy production sẽ đổi thành domain cụ thể của FE
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 2. Bật màng lọc dữ liệu đầu vào toàn cục (DTO Validation)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các field thừa không khai báo trong DTO
      forbidNonWhitelisted: true, // Báo lỗi 400 nếu client gửi field lạ
      transform: true, // Tự động ép kiểu dữ liệu (VD: string -> number)
    }),
  );

  // 3. Cấu hình Swagger API Docs tại http://localhost:3000/api-docs
  const config = new DocumentBuilder()
    .setTitle('WOMS API - Warranty Operations Management System')
    .setDescription('Tài liệu tích hợp API cho Staff Workspace & Customer Portal')
    .setVersion('1.0')
    .addBearerAuth() // Hỗ trợ nút nhập JWT Token trên giao diện Swagger
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT || 3000);
  console.log(`Server chạy tại: http://localhost:3000`);
  console.log(`Swagger Docs tại: http://localhost:3000/api-docs`);
}
bootstrap();
