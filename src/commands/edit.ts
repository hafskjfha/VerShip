import { Command } from 'commander';
import { ChangesetManager } from '../core/changeset.js';
import { logger } from '../utils/logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

interface EditOptions {
  id?: string;
}

interface DeleteOptions {
  id?: string;
  all?: boolean;
}

export async function editCommand(options: EditOptions = {}): Promise<void> {
  try {
    const manager = new ChangesetManager();
    const changesets = await manager.getAllChangesets();
    
    if (changesets.length === 0) {
      console.log('📝 편집할 changeset이 없습니다.');
      return;
    }
    
    let targetId = options.id;
    
    // ID가 제공되지 않았으면 선택하도록 함
    if (!targetId) {
      const { selectedId } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedId',
        message: '편집할 changeset을 선택하세요:',
        choices: changesets.map(cs => ({
          name: `${getTypeDisplay(cs.type)} ${cs.summary} (${chalk.dim(cs.id)})`,
          value: cs.id,
        })),
      }]);
      targetId = selectedId;
    }
    
    const changeset = changesets.find(cs => cs.id === targetId);
    if (!changeset) {
      logger.error(`Changeset을 찾을 수 없습니다: ${targetId}`);
      return;
    }
    
    console.log(`\n📝 Changeset 편집: ${chalk.cyan(changeset.id)}\n`);
    
    // 새로운 값들 입력받기
    const { newType, newSummary } = await inquirer.prompt([
      {
        type: 'list',
        name: 'newType',
        message: '새로운 변경 타입:',
        default: changeset.type,
        choices: [
          { name: `${chalk.red('major')} - 호환성을 깨는 변경`, value: 'major' },
          { name: `${chalk.yellow('minor')} - 새로운 기능 추가`, value: 'minor' },
          { name: `${chalk.green('patch')} - 버그 수정`, value: 'patch' },
        ],
      },
      {
        type: 'input',
        name: 'newSummary',
        message: '새로운 설명:',
        default: changeset.summary,
        validate: (input: string) => {
          const trimmed = input.trim();
          if (trimmed.length === 0) return '설명을 입력해주세요.';
          if (trimmed.length < 5) return '최소 5자 이상 입력해주세요.';
          if (trimmed.length > 200) return '200자 이내로 입력해주세요.';
          return true;
        },
      },
    ]);
    
    // 확인
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '변경사항을 저장하시겠습니까?',
      default: true,
    }]);
    
    if (!confirm) {
      console.log('❌ 편집이 취소되었습니다.');
      return;
    }
    
    // 파일 업데이트
    const updatedChangeset = {
      ...changeset,
      type: newType,
      summary: newSummary.trim(),
    };
    
    const filePath = path.join(process.cwd(), '.changesets', `${changeset.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(updatedChangeset, null, 2));
    
    console.log(`\n✅ Changeset이 성공적으로 업데이트되었습니다!`);
    console.log(`🏷️  타입: ${getTypeDisplay(changeset.type)} → ${getTypeDisplay(newType)}`);
    console.log(`📝 설명: ${chalk.gray(changeset.summary)} → ${chalk.gray(newSummary)}`);
    
  } catch (error) {
    logger.error(`편집 중 오류가 발생했습니다: ${error}`);
    process.exit(1);
  }
}

export async function deleteCommand(options: DeleteOptions = {}): Promise<void> {
  try {
    const manager = new ChangesetManager();
    const changesets = await manager.getAllChangesets();
    
    if (changesets.length === 0) {
      console.log('📝 삭제할 changeset이 없습니다.');
      return;
    }
    
    if (options.all) {
      // 모든 changeset 삭제
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `${chalk.red.bold('경고!')} 모든 changeset (${changesets.length}개)을 삭제하시겠습니까?`,
        default: false,
      }]);
      
      if (!confirm) {
        console.log('❌ 삭제가 취소되었습니다.');
        return;
      }
      
      for (const changeset of changesets) {
        const filePath = path.join(process.cwd(), '.changesets', `${changeset.id}.json`);
        await fs.unlink(filePath);
      }
      
      console.log(`✅ ${chalk.green(changesets.length)}개의 changeset이 삭제되었습니다.`);
      return;
    }
    
    let targetId = options.id;
    
    // ID가 제공되지 않았으면 선택하도록 함
    if (!targetId) {
      const { selectedId } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedId',
        message: '삭제할 changeset을 선택하세요:',
        choices: changesets.map(cs => ({
          name: `${getTypeDisplay(cs.type)} ${cs.summary} (${chalk.dim(cs.id)})`,
          value: cs.id,
        })),
      }]);
      targetId = selectedId;
    }
    
    const changeset = changesets.find(cs => cs.id === targetId);
    if (!changeset) {
      logger.error(`Changeset을 찾을 수 없습니다: ${targetId}`);
      return;
    }
    
    // 확인
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `'${changeset.summary}' (${changeset.id})을 삭제하시겠습니까?`,
      default: false,
    }]);
    
    if (!confirm) {
      console.log('❌ 삭제가 취소되었습니다.');
      return;
    }
    
    // 파일 삭제
    const filePath = path.join(process.cwd(), '.changesets', `${changeset.id}.json`);
    await fs.unlink(filePath);
    
    console.log(`✅ Changeset '${chalk.cyan(changeset.id)}'이 삭제되었습니다.`);
    
  } catch (error) {
    logger.error(`삭제 중 오류가 발생했습니다: ${error}`);
    process.exit(1);
  }
}

function getTypeDisplay(type: string): string {
  switch (type) {
    case 'major':
      return chalk.red.bold('major');
    case 'minor':
      return chalk.yellow.bold('minor');
    case 'patch':
      return chalk.green.bold('patch');
    default:
      return type;
  }
}
