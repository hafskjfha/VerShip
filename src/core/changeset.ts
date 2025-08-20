// src/core/changeset.ts
import fs from 'fs/promises';
import path from 'path';
import { Changeset, ChangeType } from '../types';
import { ensureDir, writeJsonFile, readJsonFile } from '../utils/fs';

const CHANGESETS_DIR = '.changesets';

export class ChangesetManager {
  private changesetsDir: string;

  constructor(cwd = process.cwd()) {
    this.changesetsDir = path.join(cwd, CHANGESETS_DIR);
  }

  async init(): Promise<void> {
    await ensureDir(this.changesetsDir);
    
    const configPath = path.join(this.changesetsDir, 'config.json');
    try {
      await fs.access(configPath);
    } catch {
      await writeJsonFile(configPath, {
        // $schema: 'https://unpkg.com/my-release-tool/schema.json', // later...
        changelog: {
          repo: '',
          template: 'default'
        }
      });
    }
  }

  async createChangeset(type: ChangeType, summary: string): Promise<string> {
    await this.init();

    const id = this.generateId();
    const changeset: Changeset = {
      id,
      type,
      summary,
      createdAt: new Date().toISOString(),
    };

    const filename = `${id}.json`;
    const filePath = path.join(this.changesetsDir, filename);
    
    await writeJsonFile(filePath, changeset);
    return id;
  }

  async getAllChangesets(): Promise<Changeset[]> {
    await this.init();
    
    try {
      const files = await fs.readdir(this.changesetsDir);
      const changesetFiles = files.filter(f => f.endsWith('.json') && f !== 'config.json');
      
      const changesets: Changeset[] = [];
      for (const file of changesetFiles) {
        const filePath = path.join(this.changesetsDir, file);
        const changeset = await readJsonFile<Changeset>(filePath);
        changesets.push(changeset);
      }
      
      return changesets.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async consumeChangesets(): Promise<Changeset[]> {
    const changesets = await this.getAllChangesets();

    // remove processed changesets
    for (const changeset of changesets) {
      const filePath = path.join(this.changesetsDir, `${changeset.id}.json`);
      await fs.unlink(filePath);
    }
    
    return changesets;
  }

  private generateId(): string {
    const adjectives = ['happy', 'funny', 'clever', 'brave', 'kind', 'swift'];
    const animals = ['cat', 'dog', 'bird', 'fish', 'lion', 'tiger'];
    const actions = ['runs', 'jumps', 'flies', 'swims', 'dances', 'sings'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    return `${adj}-${animal}-${action}`;
  }
}