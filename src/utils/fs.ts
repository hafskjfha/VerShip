// src/utils/fs.ts
import fs from 'fs/promises';
import { glob } from 'glob';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

export async function findFiles(pattern: string, cwd = process.cwd()): Promise<string[]> {
  return glob(pattern, { cwd });
}