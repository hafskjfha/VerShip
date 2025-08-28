#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';
import { editCommand, deleteCommand } from './commands/edit.js';
import { versionCommand } from './commands/version.js';
import { changelogCommand } from './commands/changelog.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

program
  .name('vership')
  .description('버전 관리 및 릴리즈 도구')
  .version('1.0.0');

program
  .command('add')
  .description('새로운 changeset을 추가합니다')
  .option('-t, --type <type>', '변경 타입 (major|minor|patch)')
  .option('-m, --message <message>', '변경사항 설명')
  .option('--template <id>', '사용할 템플릿 ID')
  .action(addCommand);

program
  .command('status')
  .description('프로젝트의 현재 릴리즈 상태를 확인합니다')
  .option('-o, --output <format>', '출력 형식 (text|json)', 'text')
  .action(statusCommand);

program
  .command('validate')
  .description('changeset 파일들의 유효성을 검증합니다')
  .action(validateCommand);

program
  .command('edit')
  .description('기존 changeset을 편집합니다')
  .option('-i, --id <id>', 'changeset ID')
  .action(editCommand);

program
  .command('delete')
  .aliases(['rm', 'remove'])
  .description('changeset을 삭제합니다')
  .option('-i, --id <id>', 'changeset ID')
  .option('-a, --all', '모든 changeset 삭제')
  .action(deleteCommand);

program
  .command('version')
  .description('버전을 업데이트하고 changelog를 생성합니다')
  .option('--dry-run', '실제 변경 없이 미리보기만 표시')
  .option('--skip-confirm', '확인 프롬프트 건너뛰기')
  .option('--ci', 'CI 모드 (자동 확인, 에러 처리 완화)')
  .action(versionCommand);

program
  .command('changelog')
  .description('체인지로그 생성 방식을 설정합니다')
  .option('-t, --template <template>', '사용할 템플릿 (default|github|conventional|custom)')
  .option('--interactive', '대화형 설정 모드', true)
  .action(changelogCommand);

program.addCommand(publishCommand);

program.parse();