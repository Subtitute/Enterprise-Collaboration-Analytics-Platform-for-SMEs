// 22/08/2026: script phuc hoi du lieu tu 1 ban sao luu do backup.js tao ra (xem chu thich dau
// file do de biet boi canh/gioi han). GHI DE du lieu hien tai cua tung nguon - CHI dung khi thuc su
// muon phuc hoi ve dung trang thai luc sao luu (vd sau su co mat du lieu, hoac phuc hoi ve may khac).
//
// Cach chay (tu thu muc goc repo, stack phai dang chay - `docker compose up -d`):
//   npm run restore -- <ten-thu-muc-trong-backups/>
// Vi du:  npm run restore -- 2026-08-22T06-30-00-000Z
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INFRA_DIR = path.join(__dirname, '..', 'infra');
const NETWORK = 'ecap-sme_internal-net';
const MC_IMAGE = 'minio/mc:latest@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727';

// 26/10/2026: them 3 CSDL bi bo sot tu khi co ml-service (24/09), messaging-service (28/09), inventory-service (16/10).
const POSTGRES_CONTAINERS = [
  'postgres-iam',
  'postgres-pt',
  'postgres-doc',
  'postgres-crm',
  'postgres-hrm',
  'postgres-ml',
  'postgres-messaging',
  'postgres-inventory',
  'timescaledb',
];

const backupName = process.argv[2];
if (!backupName) {
  console.error('Thieu tham so: ten thu muc backup can phuc hoi (trong backups/).');
  console.error('Cach dung: npm run restore -- <ten-thu-muc>');
  process.exit(1);
}
const backupDir = path.join(__dirname, '..', 'backups', backupName);
if (!fs.existsSync(backupDir)) {
  console.error(`Khong tim thay thu muc: ${backupDir}`);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { cwd: INFRA_DIR, maxBuffer: 1024 * 1024 * 1024, ...options });
}

function getContainerEnvVar(container, varName) {
  return run('docker', ['compose', 'exec', '-T', container, 'sh', '-c', `printf '%s' "$${varName}"`])
    .toString()
    .trim();
}

function restorePostgres(container) {
  const file = path.join(backupDir, `${container}.sql`);
  if (!fs.existsSync(file)) {
    console.log(`  (bo qua ${container} - khong co ${container}.sql trong ban sao luu nay)`);
    return;
  }
  console.log(`\n=== Postgres: ${container} ===`);
  const sql = fs.readFileSync(file);
  // pg_dump plain-text (khong --clean) - restore de len CSDL rong nhat quan thoi diem sao luu; neu
  // CSDL dich da co du lieu, cau lenh CREATE trong file .sql se bao loi "already exists" cho tung
  // bang (khong lam sap script, chi bao loi tren dau ra - phu hop truong hop phuc hoi vao CSDL rong
  // moi tao, la kich ban thuong gap nhat: may moi/volume moi sau su co mat du lieu).
  run('docker', ['compose', 'exec', '-T', container, 'sh', '-c', 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'], {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log(`  <- ${path.relative(process.cwd(), file)}`);
}

function restoreMongo() {
  const file = path.join(backupDir, 'mongo', 'mongodb.archive');
  if (!fs.existsSync(file)) {
    console.log('  (bo qua MongoDB - khong co mongo/mongodb.archive trong ban sao luu nay)');
    return;
  }
  console.log('\n=== MongoDB ===');
  const archive = fs.readFileSync(file);
  // --drop: xoa tung collection truoc khi ghi lai (thay vi chi INSERT chong len, co the tao trung
  // _id/du thua neu CSDL dich da co du lieu) - dam bao ket qua sau restore GIONG HET luc sao luu.
  run(
    'docker',
    ['compose', 'exec', '-T', 'mongodb', 'sh', '-c', 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --drop'],
    { input: archive, stdio: ['pipe', 'inherit', 'inherit'] },
  );
  console.log(`  <- ${path.relative(process.cwd(), file)}`);
}

function restoreMinio() {
  const minioDir = path.join(backupDir, 'minio');
  if (!fs.existsSync(minioDir)) {
    console.log('  (bo qua MinIO - khong co thu muc minio/ trong ban sao luu nay)');
    return;
  }
  console.log('\n=== MinIO ===');
  // rootUser/rootPassword doc 1 lan duy nhat (khac backupMinio): CA HAI deu la thong tin dang nhap
  // vao CHINH container `minio`, moi bucket duoi day deu can no de mirror - khong phai 2 nguon doc
  // lap nhu document-service/hrm-service ben backupMinio, nen khong co lo hong cach ly loi o day
  // (minio down thi khong bucket nao phuc hoi duoc du co tach rieng cach doc hay khong).
  const rootUser = getContainerEnvVar('minio', 'MINIO_ROOT_USER');
  const rootPassword = getContainerEnvVar('minio', 'MINIO_ROOT_PASSWORD');

  // 22/08/2026: moi bucket 1 try/catch rieng - 1 bucket loi (vd du lieu backup cua rieng no bi hong)
  // khong duoc chan cac bucket con lai (cung nguyen tac cach ly loi nhu backupMinio/vong lap `steps`).
  const failedBuckets = [];
  for (const bucket of fs.readdirSync(minioDir)) {
    try {
      console.log(`  restoring bucket "${bucket}"...`);
      // --entrypoint /bin/sh: xem chu thich cung dong trong backup.js.
      // 22/08/2026: rootUser/rootPassword/bucket truyen qua BIEN MOI TRUONG (-e ..., moi gia tri 1
      // phan tu argv rieng, khong qua shell) THAY VI noi truc tiep vao chuoi lenh `sh -c` nhu truoc -
      // gia tri chua ky tu " ` $ ; se pha vo dau nhay va CHEN LENH TUY Y (xem backupMinio).
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
          // --overwrite: mc mirror TU CHOI ghi de file dich neu da ton tai VOI CUNG mtime/kich thuoc
          // (bao ve chong ghi de nham mac dinh) - o day ta MUON ghi de that su (dung y nghia "restore",
          // ke ca khi file dich da ton tai tu truoc do vi cung 1 lan sao luu/chua bi mat du lieu that su).
          'mc alias set local http://minio:9000 "$MC_USER" "$MC_PASSWORD" >/dev/null && mc mb -p "local/$MC_BUCKET" >/dev/null 2>&1; mc mirror --quiet --overwrite "/backup/$MC_BUCKET" "local/$MC_BUCKET"',
        ],
        { stdio: 'inherit' },
      );
    } catch (err) {
      failedBuckets.push(bucket);
      console.error(`  LOI khi phuc hoi bucket "${bucket}": ${err.message}`);
    }
  }

  console.log(`  <- ${path.relative(process.cwd(), minioDir)}/`);
  if (failedBuckets.length > 0) {
    throw new Error(`bucket loi: ${failedBuckets.join(', ')} (bucket con lai van da phuc hoi binh thuong)`);
  }
}

function main() {
  console.log(`Phuc hoi tu: ${path.relative(process.cwd(), backupDir)}/`);
  console.log('CANH BAO: se GHI DE du lieu hien tai cua tung nguon co mat trong ban sao luu nay.\n');

  const steps = [...POSTGRES_CONTAINERS.map((c) => ({ name: c, run: () => restorePostgres(c) })), { name: 'mongodb', run: restoreMongo }, { name: 'minio', run: restoreMinio }];

  const failed = [];
  for (const step of steps) {
    try {
      step.run();
    } catch (err) {
      failed.push(step.name);
      console.error(`  LOI khi phuc hoi ${step.name}: ${err.message}`);
    }
  }

  console.log('\n=== Tong ket ===');
  console.log(`Thanh cong: ${steps.length - failed.length}/${steps.length}`);
  if (failed.length > 0) {
    console.log(`That bai: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
