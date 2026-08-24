import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

/**
 * 22/08/2026: unit test cho withTimeout() moi bo sung trong putObject() (fix audit "SDK minio
 * khong dat timeout tren bat ky HTTP call nao, nen 1 lan MinIO 'treo' mang khien request
 * checkIn()/checkOut() cua nguoi dung 'treo' theo VO THOI HAN"). Sao chep tu
 * apps/document-service/src/minio/minio.service.spec.ts (file mau tham chieu) - gan truc tiep
 * field private `client`/`bucket` de kiem tra hanh vi timeout ma khong can Minio.Client that.
 */
function createService(clientMock: { putObject: jest.Mock }): MinioService {
  const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
  const service = new MinioService(configServiceMock);
  (service as unknown as { client: unknown }).client = clientMock;
  (service as unknown as { bucket: string }).bucket = 'hrm-attendance';
  return service;
}

describe('MinioService - timeout tren putObject() (HRM Service)', () => {
  afterEach(() => jest.useRealTimers());

  it('putObject() thanh cong khi client.putObject() resolve binh thuong', async () => {
    const service = createService({ putObject: jest.fn().mockResolvedValue(undefined) });

    await expect(service.putObject('photo.jpg', Buffer.from('data'), 4, 'image/jpeg')).resolves.toBeUndefined();
  });

  it('putObject() nem loi timeout sau 15s khi MinIO "treo" (khong resolve/reject) - khong treo request checkIn/checkOut vo han', async () => {
    jest.useFakeTimers();
    const service = createService({ putObject: jest.fn(() => new Promise<never>(() => undefined)) });

    const pending = service.putObject('photo.jpg', Buffer.from('data'), 4, 'image/jpeg');
    const assertion = expect(pending).rejects.toThrow('vuot qua');
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  // 22/08/2026: khac voi test "treo" o tren (timer thang), day la nhanh client.putObject() TU CHOI
  // NGAY (loi that, khong phai timeout) - phu 1 nhanh khac cua withTimeout() (promise.then nhanh
  // reject) chua duoc test o tren.
  it('putObject() nem lai NGUYEN VAN loi that khi client.putObject() bi tu choi ngay (khong phai timeout)', async () => {
    const service = createService({ putObject: jest.fn().mockRejectedValue(new Error('MinIO tu choi: het dung luong')) });

    await expect(service.putObject('photo.jpg', Buffer.from('data'), 4, 'image/jpeg')).rejects.toThrow(
      'MinIO tu choi: het dung luong',
    );
  });

  it('presignedGetObject() uy quyen cho publicUrlClient voi expirySeconds mac dinh (900s)', async () => {
    const presignedGetObject = jest.fn().mockResolvedValue('https://minio/signed-url');
    const service = createService({ putObject: jest.fn() });
    (service as unknown as { publicUrlClient: unknown }).publicUrlClient = { presignedGetObject };

    const url = await service.presignedGetObject('photo.jpg');

    expect(url).toBe('https://minio/signed-url');
    expect(presignedGetObject).toHaveBeenCalledWith('hrm-attendance', 'photo.jpg', 900);
  });
});
