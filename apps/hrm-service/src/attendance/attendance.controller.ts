import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { photoMimeTypeFileFilter } from './allowed-photo-mime-types';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

/** Cham cong (check-in/out kem anh) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECKIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES }, fileFilter: photoMimeTypeFileFilter }))
  checkIn(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) throw new BadRequestException('Thiếu ảnh chấm công');
    return this.attendanceService.checkIn(organizationId, userId, photo);
  }

  @Post('check-out')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECKIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES }, fileFilter: photoMimeTypeFileFilter }))
  checkOut(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) throw new BadRequestException('Thiếu ảnh chấm công');
    return this.attendanceService.checkOut(organizationId, userId, photo);
  }

  /** Lich su cham cong cua chinh nguoi goi - khong yeu cau permission dac biet, mirror trang Ho so ca nhan. */
  @Get('me')
  findMine(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findMine(organizationId, userId, query);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAll(organizationId, query);
  }

  /**
   * Kiem tra chinh chu/quyen ATTENDANCE_VIEW thuc hien BEN TRONG service - khong gan
   * @RequirePermissions o day, mirror endpoint binh luan cua TasksController (khong nam trong
   * nhom quyen co dinh, tu kiem tra ngu canh cu the).
   */
  @Get(':id/photo')
  getPhotoUrl(
    @CurrentUser('userId') requesterUserId: string,
    @CurrentUser('permissions') requesterPermissions: string[],
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query('kind') kind?: string,
  ) {
    if (kind !== 'checkin' && kind !== 'checkout') {
      throw new BadRequestException('kind phải là "checkin" hoặc "checkout"');
    }
    return this.attendanceService.getPhotoUrl(organizationId, id, kind, requesterUserId, requesterPermissions);
  }
}
