// src/commands/add.ts
import inquirer from 'inquirer';
import { ChangeType } from '../types';
import { ChangesetManager } from '../core/changeset';
import { TemplateManager } from '../core/template.js';
import { logger } from '../utils/logger';
import chalk from 'chalk';

interface AddOptions {
  type?: ChangeType;
  message?: string;
  template?: string;
}

export async function addCommand(options: AddOptions = {}): Promise<void> {
  try {
    const changesetManager = new ChangesetManager();
    const templateManager = new TemplateManager();

    logger.info('📝 새로운 변경사항을 추가합니다...\n');

    // 템플릿 사용 여부 확인
    const templates = await templateManager.getAllTemplates();
    let useTemplate = false;
    let selectedTemplate = null;

    if (templates.length > 0 && !options.template && !options.type) {
      const { templateChoice } = await inquirer.prompt([{
        type: 'list',
        name: 'templateChoice',
        message: '템플릿을 사용하시겠습니까?',
        choices: [
          { name: '예 - 템플릿 선택', value: 'yes' },
          { name: '아니오 - 직접 입력', value: 'no' },
        ],
      }]);
      
      useTemplate = templateChoice === 'yes';
    }

    if (options.template) {
      selectedTemplate = await templateManager.getTemplate(options.template);
      if (!selectedTemplate) {
        logger.error(`템플릿을 찾을 수 없습니다: ${options.template}`);
        process.exit(1);
      }
      useTemplate = true;
    }

    if (useTemplate && !selectedTemplate) {
      const { templateId } = await inquirer.prompt([{
        type: 'list',
        name: 'templateId',
        message: '사용할 템플릿을 선택하세요:',
        choices: templates.map(t => ({
          name: `${t.name} - ${chalk.dim(t.description)}`,
          value: t.id,
        })),
      }]);

      selectedTemplate = await templateManager.getTemplate(templateId);
    }

    let type: ChangeType;
    let message: string;

    if (selectedTemplate) {
      // 템플릿 기반 입력
      type = selectedTemplate.type;
      
      if (selectedTemplate.fields && selectedTemplate.fields.length > 0) {
        console.log(`\n📋 템플릿: ${chalk.cyan(selectedTemplate.name)}`);
        console.log(`${chalk.gray(selectedTemplate.description)}\n`);

        const fieldValues: Record<string, string> = {};
        
        for (const field of selectedTemplate.fields) {
          const prompt: any = {
            name: field.name,
            message: field.label + ':',
          };

          if (field.type === 'multiline') {
            prompt.type = 'editor';
          } else if (field.type === 'select' && field.options) {
            prompt.type = 'list';
            prompt.choices = field.options;
          } else {
            prompt.type = 'input';
            if (field.placeholder) {
              prompt.default = field.placeholder;
            }
          }

          if (field.required) {
            prompt.validate = (input: string) => {
              if (!input || input.trim().length === 0) {
                return `${field.label}은(는) 필수입니다.`;
              }
              return true;
            };
          }

          const { [field.name]: value } = await inquirer.prompt([prompt]);
          fieldValues[field.name] = value;
        }

        message = templateManager.generateSummary(selectedTemplate, fieldValues);
      } else {
        message = selectedTemplate.summaryTemplate;
      }
    } else {
      // 기존 직접 입력 방식
      type = options.type || (await inquirer.prompt<{ type: ChangeType }>([
        {
          type: 'list',
          name: 'type',
          message: '변경 타입을 선택하세요:',
          choices: [
            { 
              name: `${chalk.red('major')} - 호환성을 깨는 변경 (예: API 변경)`, 
              value: 'major' 
            },
            { 
              name: `${chalk.yellow('minor')} - 새로운 기능 추가 (하위 호환)`, 
              value: 'minor' 
            },
            { 
              name: `${chalk.green('patch')} - 버그 수정 또는 작은 개선`, 
              value: 'patch' 
            },
          ],
        },
      ])).type;

      message = options.message || (await inquirer.prompt<{ message: string }>([
        {
          type: 'input',
          name: 'message',
          message: '변경사항을 간단히 설명해주세요:',
          validate: (input: string) => {
            const trimmed = input.trim();
            if (trimmed.length === 0) {
              return '변경사항 설명을 입력해주세요.';
            }
            if (trimmed.length < 5) {
              return '최소 5자 이상 입력해주세요.';
            }
            if (trimmed.length > 100) {
              return '100자 이내로 입력해주세요.';
            }
            return true;
          },
        },
      ])).message.trim();
    }

    const changeset = await changesetManager.createChangeset(type, message);

    // Success message with better formatting
    console.log();
    logger.success('✅ Changeset이 성공적으로 생성되었습니다!');
    console.log();
    console.log(`📁 파일: ${chalk.cyan(`.changesets/${changeset.id}.json`)}`);
    console.log(`🏷️  타입: ${getTypeDisplay(type)}`);
    console.log(`📝 설명: ${chalk.gray(message)}`);
    if (selectedTemplate) {
      console.log(`🎨 템플릿: ${chalk.cyan(selectedTemplate.name)}`);
    }
    console.log(`🕒 생성: ${chalk.gray(new Date(changeset.createdAt).toLocaleString('ko-KR'))}`);
    console.log();
    console.log(chalk.dim('💡 다음 단계: vership status로 현재 상태를 확인하세요.'));

  } catch (error) {
    logger.error(`Changeset 생성 실패: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function getTypeDisplay(type: ChangeType): string {
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