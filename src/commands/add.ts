// src/commands/add.ts
import inquirer from 'inquirer';
import { ChangeType } from '../types';
import { ChangesetManager } from '../core/changeset';
import { logger } from '../utils/logger';

interface AddOptions {
  type?: ChangeType;
  message?: string;
}

export async function addCommand(options: AddOptions = {}): Promise<void> {
  try {
    const changesetManager = new ChangesetManager();

    // If type is not provided, ask the user
    let type = options.type;
    if (!type) {
      const typeAnswer = await inquirer.prompt<{ type: ChangeType }>([
        {
          type: 'list',
          name: 'type',
          message: 'Please select the type of change:',
          choices: [
            { name: 'patch - ex) bug fix', value: 'patch' },
            { name: 'minor - ex) add new feature', value: 'minor' },
            { name: 'major - ex) breaking change', value: 'major' },
          ],
        },
      ]);
      type = typeAnswer.type;
    }

    // if message is not provided, ask the user
    let message = options.message;
    if (!message) {
      const messageAnswer = await inquirer.prompt<{ message: string }>([
        {
          type: 'input',
          name: 'message',
          message: 'Please describe the changes:',
          validate: (input: string) => {
            if (input.trim().length === 0) {
              return 'Please enter a description of the changes.';
            }
            return true;
          },
        },
      ]);
      message = messageAnswer.message;
    }

    const id = await changesetManager.createChangeset(type, message);

    logger.success(`Changeset created successfully: ${id}`);
    logger.info(`Type: ${type}`);
    logger.info(`Description: ${message}`);

  } catch (error) {
    logger.error(`Failed to create changeset: ${error}`);
    process.exit(1);
  }
}