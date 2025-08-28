import fs from 'fs/promises';
import path from 'path';
import { ChangeType } from '../types/index.js';

export interface ChangesetTemplate {
  id: string;
  name: string;
  description: string;
  type: ChangeType;
  summaryTemplate: string;
  fields?: TemplateField[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'multiline';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export class TemplateManager {
  private templateDir: string;
  
  constructor(cwd = process.cwd()) {
    this.templateDir = path.join(cwd, '.changesets', 'templates');
  }
  
  /**
   * 기본 템플릿들을 초기화합니다
   */
  async initDefaultTemplates(): Promise<void> {
    await fs.mkdir(this.templateDir, { recursive: true });
    
    const defaultTemplates: ChangesetTemplate[] = [
      {
        id: 'feature',
        name: '새로운 기능',
        description: '새로운 기능을 추가했을 때 사용',
        type: 'minor',
        summaryTemplate: '새로운 기능: {{feature}}',
        fields: [
          {
            name: 'feature',
            label: '추가된 기능',
            type: 'text',
            required: true,
            placeholder: '예: 사용자 로그인 기능',
          },
        ],
      },
      {
        id: 'bugfix',
        name: '버그 수정',
        description: '버그를 수정했을 때 사용',
        type: 'patch',
        summaryTemplate: '버그 수정: {{issue}}',
        fields: [
          {
            name: 'issue',
            label: '수정된 문제',
            type: 'text',
            required: true,
            placeholder: '예: 로그인 시 발생하는 오류',
          },
        ],
      },
      {
        id: 'breaking',
        name: '호환성 변경',
        description: '호환성을 깨는 변경사항',
        type: 'major',
        summaryTemplate: 'BREAKING: {{change}}',
        fields: [
          {
            name: 'change',
            label: '변경사항',
            type: 'text',
            required: true,
            placeholder: '예: API 인터페이스 변경',
          },
          {
            name: 'migration',
            label: '마이그레이션 방법',
            type: 'multiline',
            placeholder: '기존 코드를 새 버전으로 업그레이드하는 방법을 설명하세요',
          },
        ],
      },
      {
        id: 'docs',
        name: '문서 업데이트',
        description: '문서만 변경했을 때 사용',
        type: 'patch',
        summaryTemplate: '문서: {{docs}}',
        fields: [
          {
            name: 'docs',
            label: '문서 변경사항',
            type: 'text',
            required: true,
            placeholder: '예: README 업데이트',
          },
        ],
      },
      {
        id: 'performance',
        name: '성능 개선',
        description: '성능을 개선했을 때 사용',
        type: 'minor',
        summaryTemplate: '성능 개선: {{improvement}}',
        fields: [
          {
            name: 'improvement',
            label: '개선사항',
            type: 'text',
            required: true,
            placeholder: '예: 로딩 속도 50% 향상',
          },
        ],
      },
    ];
    
    for (const template of defaultTemplates) {
      const templatePath = path.join(this.templateDir, `${template.id}.json`);
      try {
        await fs.access(templatePath);
        // 이미 존재하면 건너뛰기
      } catch {
        await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
      }
    }
  }
  
  /**
   * 모든 템플릿을 가져옵니다
   */
  async getAllTemplates(): Promise<ChangesetTemplate[]> {
    try {
      await this.initDefaultTemplates();
      
      const files = await fs.readdir(this.templateDir);
      const templateFiles = files.filter(f => f.endsWith('.json'));
      
      const templates: ChangesetTemplate[] = [];
      for (const file of templateFiles) {
        try {
          const templatePath = path.join(this.templateDir, file);
          const content = await fs.readFile(templatePath, 'utf-8');
          const template = JSON.parse(content) as ChangesetTemplate;
          templates.push(template);
        } catch (error) {
          console.warn(`템플릿 파일을 읽는 중 오류 발생: ${file}`);
        }
      }
      
      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
  
  /**
   * 특정 템플릿을 가져옵니다
   */
  async getTemplate(id: string): Promise<ChangesetTemplate | null> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }
  
  /**
   * 템플릿을 저장합니다
   */
  async saveTemplate(template: ChangesetTemplate): Promise<void> {
    await fs.mkdir(this.templateDir, { recursive: true });
    const templatePath = path.join(this.templateDir, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
  }
  
  /**
   * 템플릿을 삭제합니다
   */
  async deleteTemplate(id: string): Promise<boolean> {
    try {
      const templatePath = path.join(this.templateDir, `${id}.json`);
      await fs.unlink(templatePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 템플릿에서 summary를 생성합니다
   */
  generateSummary(template: ChangesetTemplate, fieldValues: Record<string, string>): string {
    let summary = template.summaryTemplate;
    
    // {{field}} 형태의 플레이스홀더를 실제 값으로 교체
    for (const [key, value] of Object.entries(fieldValues)) {
      const placeholder = `{{${key}}}`;
      summary = summary.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return summary;
  }
}
