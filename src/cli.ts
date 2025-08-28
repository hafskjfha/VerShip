#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';
import { editCommand, deleteCommand } from './commands/edit.js';

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

program.parse();