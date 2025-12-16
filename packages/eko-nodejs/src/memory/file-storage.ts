import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import type { Episode, EpisodicStorageProvider } from '@eko-ai/eko';

/**
 * File-based storage provider for EpisodicMemory
 */
export class FileStorageProvider implements EpisodicStorageProvider {
    private readonly storagePath: string;
    private readonly fileName: string;

    constructor(storagePath: string, fileName: string = 'episodes.json') {
        this.storagePath = storagePath;
        this.fileName = fileName;
    }

    private getFilePath(): string {
        return join(this.storagePath, this.fileName);
    }

    async exists(): Promise<boolean> {
        try {
            await access(this.getFilePath(), constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async read(): Promise<Episode[]> {
        const filePath = this.getFilePath();

        try {
            await access(filePath, constants.F_OK);
        } catch {
            return [];
        }

        try {
            const data = await readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.warn(`Failed to read episodes from ${filePath}:`, e);
            return [];
        }
    }

    async write(episodes: Episode[]): Promise<void> {
        // Ensure directory exists
        try {
            await access(this.storagePath, constants.F_OK);
        } catch {
            await mkdir(this.storagePath, { recursive: true });
        }

        const filePath = this.getFilePath();
        await writeFile(filePath, JSON.stringify(episodes, null, 2), 'utf-8');
    }
}
