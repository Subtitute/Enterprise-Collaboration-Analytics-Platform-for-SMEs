import {
  BadRequestException,
  Body,
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
import { AuthContext, ERROR_CODES, PERMISSIONS } from '@app/common-dto';
import { toScopeCaller } from '../user-directory/user-directory';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { photoMimeTypeFileFilter } from './allowed-photo-mime-types';
import { parseOptionalCoordinate } from './coordinate.util';
import { parseOptionalFaceMatchScore } from './face-match-score.util';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

/** Cham cong (check-in/out kem anh) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // 13/08/2026: `latitude`/`longitude` (Doc/ECAP_Mobile.md muc 13) - CO Y KHONG bat buoc, xem
  // coordinate.util.ts va Attendance entity cho ly do day du (co "on-site" chi de Manager doi
  // chieu, khong phai co che chan cham cong).
  @Post('check-in')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECKIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES }, fileFilter: photoMimeTypeFileFilter }))
  checkIn(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() photo: Express.Multer.File,
    @Body('latitude') latitudeRaw?: string,
    @Body('longitude') longitudeRaw?: string,
    @Body('faceMatchScore') faceMatchScoreRaw?: string,
  ) {
    if (!photo) throw new BadRequestException({ message: 'Thiếu ảnh chấm công', errorCode: ERROR_CODES.MISSING_CHECKIN_PHOTO });
    const latitude = parseOptionalCoordinate(latitudeRaw, 'latitude', -90, 90);
    const longitude = parseOptionalCoordinate(longitudeRaw, 'longitude', -180, 180);
    const faceMatchScore = parseOptionalFaceMatchScore(faceMatchScoreRaw);
    return this.attendanceService.checkIn(organizationId, userId, photo, latitude, longitude, faceMatchScore);
  }

  @Post('check-out')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECKIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES }, fileFilter: photoMimeTypeFileFilter }))
  checkOut(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() photo: Express.Multer.File,
    @Body('latitude') latitudeRaw?: string,
    @Body('longitude') longitudeRaw?: string,
    @Body('faceMatchScore') faceMatchScoreRaw?: string,
  ) {
    if (!photo) throw new BadRequestException({ message: 'Thiếu ảnh chấm công', errorCode: ERROR_CODES.MISSING_CHECKIN_PHOTO });
    const latitude = parseOptionalCoordinate(latitudeRaw, 'latitude', -90, 90);
    const longitude = parseOptionalCoordinate(longitudeRaw, 'longitude', -180, 180);
    const faceMatchScore = parseOptionalFaceMatchScore(faceMatchScoreRaw);
    return this.attendanceService.checkOut(organizationId, userId, photo, latitude, longitude, faceMatchScore);
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

  // 26/10/2026: `caller` - Manager chi xem cham cong cua phong ban minh (xem AttendanceService.findAll()).
  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: AttendanceQueryDto, @CurrentUser() caller: AuthContext) {
    return this.attendanceService.findAll(organizationId, query, toScopeCaller(caller));
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
    // 26/10/2026: phong ban cua nguoi xem - Manager chi xem anh cua thanh vien phong ban minh.
    @CurrentUser('departmentId') requesterDepartmentId: string | null,
    @Query('kind') kind?: string,
  ) {
    if (kind !== 'checkin' && kind !== 'checkout') {
      throw new BadRequestException({ message: 'kind phải là "checkin" hoặc "checkout"', errorCode: ERROR_CODES.INVALID_PHOTO_KIND });
    }
    return this.attendanceService.getPhotoUrl(organizationId, id, kind, requesterUserId, requesterPermissions, requesterDepartmentId ?? null);
  }
}
