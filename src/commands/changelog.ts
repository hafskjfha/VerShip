import inquirer from 'inquirer';
import chalk from 'chalk';
import { ChangelogConfigManager, ChangelogTemplateInfo } from '../core/changelog-config.js';
import { ChangelogConfig } from '../core/changelog.js';
import { logger } from '../utils/logger.js';

interface ChangelogSetupOptions {
  template?: string;
  interactive?: boolean;
}

export async function changelogCommand(options: ChangelogSetupOptions = {}): Promise<void> {
  try {
    const configManager = new ChangelogConfigManager();
    
    console.log('📋 체인지로그 설정\n');
    
    if (options.template) {
      // 템플릿만 설정
      await setTemplate(configManager, options.template);
    } else {
      // 대화형 설정
      await interactiveSetup(configManager);
    }
    
  } catch (error) {
    logger.error(`체인지로그 설정 실패: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function interactiveSetup(configManager: ChangelogConfigManager): Promise<void> {
  console.log('📋 체인지로그 생성 방식을 설정합니다.\n');
  
  // 현재 설정 로드
  const currentConfig = await configManager.loadConfig();
  const templates = configManager.getAvailableTemplates();
  
  // 1. 템플릿 선택
  const { selectedTemplate } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedTemplate',
    message: '사용할 템플릿을 선택하세요:',
    choices: templates.map(template => ({
      name: `${template.name} - ${chalk.dim(template.description)}`,
      value: template.id,
    })),
    default: currentConfig.template,
  }]);
  
  // 선택된 템플릿 미리보기
  const selectedTemplateInfo = templates.find(t => t.id === selectedTemplate);
  if (selectedTemplateInfo) {
    console.log(`\n📋 미리보기: ${chalk.cyan(selectedTemplateInfo.name)}`);
    console.log(chalk.dim('─'.repeat(50)));
    console.log(selectedTemplateInfo.preview);
    console.log(chalk.dim('─'.repeat(50)));
  }
  
  let config: ChangelogConfig = {
    ...currentConfig,
    template: selectedTemplate as any,
  };
  
  // 2. 고급 옵션 (GitHub/GitLab 스타일인 경우)
  if (selectedTemplate === 'github' || selectedTemplate === 'conventional') {
    const { advancedOptions } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'advancedOptions',
      message: '추가 옵션을 선택하세요:',
      choices: [
        {
          name: 'PR/MR 링크 포함',
          value: 'includePR',
          checked: currentConfig.includePR,
        },
        {
          name: '작성자 정보 포함',
          value: 'includeAuthor',
          checked: currentConfig.includeAuthor,
        },
        {
          name: 'commit 링크 포함',
          value: 'includeCommitLinks',
          checked: currentConfig.includeCommitLinks,
        },
      ],
    }]);
    
    config.includePR = advancedOptions.includes('includePR');
    config.includeAuthor = advancedOptions.includes('includeAuthor');
    config.includeCommitLinks = advancedOptions.includes('includeCommitLinks');
  }
  
  // 3. 커스텀 템플릿인 경우
  if (selectedTemplate === 'custom') {
    const { useCustomTemplate } = await inquirer.prompt([{
      type: 'list',
      name: 'useCustomTemplate',
      message: '커스텀 템플릿을 어떻게 설정하시겠습니까?',
      choices: [
        { name: '샘플 템플릿 생성 후 수정', value: 'sample' },
        { name: '기존 템플릿 파일 경로 입력', value: 'existing' },
      ],
    }]);
    
    if (useCustomTemplate === 'sample') {
      const templatePath = await configManager.createSampleCustomTemplate();
      config.customTemplatePath = templatePath;
      console.log(`\n✅ 샘플 템플릿이 생성되었습니다: ${chalk.cyan(templatePath)}`);
      console.log(`💡 파일을 편집하여 원하는 형태로 커스터마이징하세요.`);
    } else {
      const { templatePath } = await inquirer.prompt([{
        type: 'input',
        name: 'templatePath',
        message: '템플릿 파일 경로를 입력하세요:',
        default: currentConfig.customTemplatePath || '.changesets/changelog-template.hbs',
        validate: (input: string) => {
          if (!input.trim()) return '경로를 입력해주세요.';
          if (!input.endsWith('.hbs')) return 'Handlebars 템플릿 파일(.hbs)이어야 합니다.';
          return true;
        },
      }]);
      config.customTemplatePath = templatePath;
    }
  }
  
  // 4. 카테고리 커스터마이징
  const { customizeCategories } = await inquirer.prompt([{
    type: 'confirm',
    name: 'customizeCategories',
    message: '카테고리 이름을 커스터마이징하시겠습니까?',
    default: false,
  }]);
  
  if (customizeCategories) {
    const categoryAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'major',
        message: 'Breaking Changes 카테고리 이름:',
        default: config.categories?.major || '💥 Breaking Changes',
      },
      {
        type: 'input',
        name: 'minor',
        message: 'Features 카테고리 이름:',
        default: config.categories?.minor || '🚀 Features',
      },
      {
        type: 'input',
        name: 'patch',
        message: 'Bug Fixes 카테고리 이름:',
        default: config.categories?.patch || '🐛 Bug Fixes',
      },
    ]);
    
    config.categories = {
      major: categoryAnswers.major,
      minor: categoryAnswers.minor,
      patch: categoryAnswers.patch,
    };
  }
  
  // 5. 설정 저장
  await configManager.saveConfig(config);
  
  console.log('\n✅ 체인지로그 설정이 완료되었습니다!');
  console.log('\n📋 설정 요약:');
  console.log(`  템플릿: ${chalk.cyan(selectedTemplateInfo?.name || selectedTemplate)}`);
  if (config.includePR) console.log(`  PR 링크: ${chalk.green('포함')}`);
  if (config.includeAuthor) console.log(`  작성자: ${chalk.green('포함')}`);
  if (config.includeCommitLinks) console.log(`  커밋 링크: ${chalk.green('포함')}`);
  if (config.customTemplatePath) {
    console.log(`  커스텀 템플릿: ${chalk.cyan(config.customTemplatePath)}`);
  }
  
  console.log(`\n💡 이제 ${chalk.cyan('vership version')} 명령어를 실행하면 설정된 형식으로 체인지로그가 생성됩니다.`);
}

async function setTemplate(configManager: ChangelogConfigManager, templateId: string): Promise<void> {
  const templates = configManager.getAvailableTemplates();
  const template = templates.find(t => t.id === templateId);
  
  if (!template) {
    const availableIds = templates.map(t => t.id).join(', ');
    throw new Error(`알 수 없는 템플릿: ${templateId}. 사용 가능한 템플릿: ${availableIds}`);
  }
  
  await configManager.updateConfig({ template: templateId as any });
  
  console.log(`✅ 체인지로그 템플릿이 ${chalk.cyan(template.name)}(으)로 설정되었습니다.`);
}
