import { Command } from 'commander';
import { ChangesetManager } from '../core/changeset.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export async function validateCommand(): Promise<void> {
  try {
    const manager = new ChangesetManager();
    const changesets = await manager.getAllChangesets();
    
    console.log('🔍 Changeset 파일들을 검증하는 중...\n');
    
    if (changesets.length === 0) {
      console.log('📝 검증할 changeset이 없습니다.');
      return;
    }
    
    let validCount = 0;
    let errorCount = 0;
    
    for (const changeset of changesets) {
      try {
        // 추가 검증 로직
        await validateChangesetContent(changeset);
        console.log(`✅ ${chalk.green(changeset.id)}: 유효함`);
        validCount++;
      } catch (error) {
        console.log(`❌ ${chalk.red(changeset.id)}: ${error instanceof Error ? error.message : error}`);
        errorCount++;
      }
    }
    
    console.log();
    console.log(`📊 검증 결과:`);
    console.log(`  ✅ 유효한 파일: ${chalk.green(validCount)}개`);
    console.log(`  ❌ 오류 파일: ${chalk.red(errorCount)}개`);
    
    if (errorCount > 0) {
      logger.error('일부 changeset 파일에 오류가 있습니다.');
      process.exit(1);
    } else {
      logger.success('모든 changeset 파일이 유효합니다!');
    }
    
  } catch (error) {
    logger.error(`검증 중 오류가 발생했습니다: ${error}`);
    process.exit(1);
  }
}

async function validateChangesetContent(changeset: any): Promise<void> {
  // 기본 구조 검증은 ChangesetManager에서 이미 처리됨
  
  // 추가 비즈니스 로직 검증
  
  // ID 형식 검증 (adjective-animal-action 패턴)
  const idPattern = /^[a-z]+-[a-z]+-[a-z]+$/;
  if (!idPattern.test(changeset.id)) {
    throw new Error('ID가 올바른 형식이 아닙니다 (adjective-animal-action)');
  }
  
  // 날짜가 미래가 아닌지 확인
  const createdDate = new Date(changeset.createdAt);
  const now = new Date();
  if (createdDate > now) {
    throw new Error('생성 날짜가 미래입니다');
  }
  
  // summary 내용 검증
  if (changeset.summary.toLowerCase().includes('todo') || 
      changeset.summary.toLowerCase().includes('fixme')) {
    throw new Error('summary에 TODO나 FIXME가 포함되어 있습니다');
  }
  
  // 중복 내용 검증 (매우 유사한 summary)
  // 이 부분은 모든 changeset을 비교해야 하므로 별도 구현 필요
}
