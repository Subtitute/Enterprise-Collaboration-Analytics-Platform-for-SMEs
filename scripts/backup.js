// 22/08/2026: script sao luu du lieu - bo sung sau audit ha tang: truoc day KHONG co script/quy
// trinh sao luu nao cho 5 Postgres + TimescaleDB + MongoDB + MinIO, du lieu chi "song" nho volume
// Docker (mat trang neu ai do lo tay `docker compose down -v`). Day la sao luu THU CONG (chua tu
// dong hoa theo lich/cron) - phu hop pham vi 1 do an tot nghiep, xem README.md ve gioi han da biet.
//
// Cach chay (tu thu muc goc repo, sau khi `docker compose up -d` da chay xong toan bo stack):
//   npm run backup
// Ket qua: 1 thu muc moi trong backups/<timestamp>/ (thu muc backups/ da .gitignore, KHONG commit
// vao git - xem restore.js de phuc hoi lai tu 1 thu muc do).
//
// Nguyen tac xuyen suot: KHONG tu doc `.env`/tu doan user-password - luon doc lai tu chinh bien moi
// truong ma `docker compose` DA tiem san vao container dang chay (vd `$POSTGRES_USER` ben trong
// container `postgres-iam`) - 1 nguon su that duy nhat, dung du user chay bang `.env` that hay
// bang cach nao khac (export truc tiep, --env-file khac...).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INFRA_DIR = path.join(__dirname, '..', 'infra');
const NETWORK = 'ecap-sme_internal-net';
const MC_IMAGE = 'minio/mc:latest@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727';

const POSTGRES_CONTAINERS = ['postgres-iam', 'postgres-pt', 'postgres-doc', 'postgres-crm', 'postgres-hrm', 'timescaledb'];

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'backups', timestamp);

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { cwd: INFRA_DIR, maxBuffer: 1024 * 1024 * 1024, ...options });
}

/** Doc 1 bien moi truong TU BEN TRONG 1 container dang chay (khong tu parse .env). */
function getContainerEnvVar(container, varName) {
  return run('docker', ['compose', 'exec', '-T', container, 'sh', '-c', `printf '%s' "$${varName}"`])
    .toString()
    .trim();
}

function backupPostgres(container) {
  console.log(`\n=== Postgres: ${container} ===`);
  const output = run('docker', ['compose', 'exec', '-T', container, 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"']);
  const file = path.join(backupDir, `${container}.sql`);
  fs.writeFileSync(file, output);
  console.log(`  -> ${path.relative(process.cwd(), file)} (${(output.length / 1024).toFixed(1)} KB)`);
}

function backupMongo() {
  console.log('\n=== MongoDB ===');
  const mongoDir = path.join(backupDir, 'mongo');
  fs.mkdirSync(mongoDir, { recursive: true });
  // --archive (khong co duong dan) = ghi ra STDOUT thay vi 1 file rieng ben trong container - tranh
  // phai biet duong dan tam/copy file ra ngoai container bang lenh rieng.
  const output = run('docker', [
    'compose',
    'exec',
    '-T',
    'mongodb',
    'sh',
    '-c',
    'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive',
  ]);
  const file = path.join(mongoDir, 'mongodb.archive');
  fs.writeFileSync(file, output);
  console.log(`  -> ${path.relative(process.cwd(), file)} (${(output.length / 1024).toFixed(1)} KB)`);
}

function backupMinio() {
  console.log('\n=== MinIO ===');
  const minioDir = path.join(backupDir, 'minio');
  fs.mkdirSync(minioDir, { recursive: true });

  const rootUser = getContainerEnvVar('minio', 'MINIO_ROOT_USER');
  const rootPassword = getContainerEnvVar('minio', 'MINIO_ROOT_PASSWORD');
  // 22/08/2026: 2 bucket rieng (document-service + hrm-service) - moi bucket gio nam TRONG 1
  // try/catch cua rieng no. Truoc day ca 2 ten bucket duoc doc (qua getContainerEnvVar, tuc goi
  // `docker compose exec`) TRUOC khi vao vong lap mirror: 1 trong 2 container (document-service/
  // hrm-service) dung/loi se nem loi dong bo va lam hong CA HAI bucket - ke ca bucket cua container
  // van khoe - pha vo nguyen tac cach ly loi tung nguon ma vong lap `steps` o main() da chu y lam.
  const sources = [
    { service: 'document-service', label: 'document-service' },
    { service: 'hrm-service', label: 'hrm-service' },
  ];

  const failedBuckets = [];
  for (const { service, label } of sources) {
    try {
      const bucket = getContainerEnvVar(service, 'MINIO_BUCKET');
      console.log(`  mirroring bucket "${bucket}" (${label})...`);
      // Container mc TAM THOI (--rm), noi vao CUNG mang Docker voi minio (khong qua cong host de
      // tranh phu thuoc port da doi 9010/9011 - xem README.md) va mount thang thu muc sao luu cuc bo.
      // --entrypoint /bin/sh: image minio/mc dat san ENTRYPOINT la "mc" (khong phai shell) - mirror
      // dung cach infra/docker-compose.yml (service minio-init) da override entrypoint de chay duoc
      // nhieu lenh `mc` noi tiep nhau trong 1 lan goi container.
      // 22/08/2026: rootUser/rootPassword/bucket truyen qua BIEN MOI TRUONG (-e ..., moi gia tri 1
      // phan tu argv rieng - execFileSync KHONG di qua shell nen an toan voi moi ky tu), THAY VI noi
      // truc tiep vao chuoi lenh `sh -c` nhu truoc: gia tri chua ky tu " ` $ ; se pha vo dau nhay va
      // CHEN LENH TUY Y vao container mc (dang giu quyen admin MinIO song, mount ca /backup).
      execFileSync(
        'docker',
        [
          'run',
          '--rm',
          '--network',
          NETWORK,
          '-v',
          `${minioDir}:/backup`,
          '-e',
          `MC_USER=${rootUser}`,
          '-e',
          `MC_PASSWORD=${rootPassword}`,
          '-e',
          `MC_BUCKET=${bucket}`,
          '--entrypoint',
          '/bin/sh',
          MC_IMAGE,
          '-c',
          'mc alias set local http://minio:9000 "$MC_USER" "$MC_PASSWORD" >/dev/null && mc mirror --quiet "local/$MC_BUCKET" "/backup/$MC_BUCKET"',
        ],
        { stdio: 'inherit' },
      );
    } catch (err) {
      failedBuckets.push(label);
      console.error(`  LOI khi sao luu bucket cua ${label}: ${err.message}`);
    }
  }

  console.log(`  -> ${path.relative(process.cwd(), minioDir)}/`);
  if (failedBuckets.length > 0) {
    throw new Error(`bucket loi: ${failedBuckets.join(', ')} (bucket con lai van da sao luu binh thuong)`);
  }
}

function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Sao luu vao: ${path.relative(process.cwd(), backupDir)}/\n`);

  const steps = [
    ...POSTGRES_CONTAINERS.map((c) => ({ name: c, run: () => backupPostgres(c) })),
    { name: 'mongodb', run: backupMongo },
    { name: 'minio', run: backupMinio },
  ];

  const failed = [];
  for (const step of steps) {
    try {
      step.run();
    } catch (err) {
      failed.push(step.name);
      console.error(`  LOI khi sao luu ${step.name}: ${err.message}`);
    }
  }

  console.log('\n=== Tong ket ===');
  console.log(`Thanh cong: ${steps.length - failed.length}/${steps.length}`);
  if (failed.length > 0) {
    console.log(`That bai: ${failed.join(', ')}`);
    console.log('(Cac phan da sao luu thanh cong van giu nguyen trong thu muc tren - khong bi xoa vi 1 phan khac loi.)');
    process.exitCode = 1;
  } else {
    console.log(`Toan bo 8 nguon du lieu da sao luu xong vao ${path.relative(process.cwd(), backupDir)}/`);
    console.log(`Phuc hoi bang: npm run restore -- ${timestamp}`);
  }
}

main();
