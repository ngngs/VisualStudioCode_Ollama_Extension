const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// package.json 읽기
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// VSIX 파일명 생성
const vsixFileName = `${packageJson.name}-${packageJson.version}.vsix`;

// 아카이브 생성
const output = fs.createWriteStream(vsixFileName);
const archive = archiver('zip', {
  zlib: { level: 9 } // 최대 압축
});

output.on('close', () => {
  console.log(`✅ VSIX 파일이 생성되었습니다: ${vsixFileName}`);
  console.log(`📦 파일 크기: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// 포함할 파일들
const filesToInclude = [
  'package.json',
  'README.md',
  'LICENSE',
  'out/**/*',
  '.vscodeignore'
];

// 파일 추가
filesToInclude.forEach(pattern => {
  if (pattern.includes('**')) {
    // 디렉토리 패턴
    const dir = pattern.split('/')[0];
    if (fs.existsSync(dir)) {
      archive.directory(dir, dir);
    }
  } else {
    // 단일 파일
    if (fs.existsSync(pattern)) {
      archive.file(pattern, { name: pattern });
    }
  }
});

// .vscodeignore 파일이 없으면 생성
if (!fs.existsSync('.vscodeignore')) {
  const vscodeignore = `node_modules/
.vscode-test/
*.vsix
.git/
.gitignore
.cursor/
*.log
`;
  fs.writeFileSync('.vscodeignore', vscodeignore);
  archive.file('.vscodeignore', { name: '.vscodeignore' });
}

archive.finalize(); 