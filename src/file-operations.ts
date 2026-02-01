import {App, Notice, TFile} from 'obsidian';
import {FileNoteSettings} from './settings';

/** Result of a batch file note operation */
export interface BatchOperationResult {
	/** Number of notes successfully processed */
	success: number;
	/** Number of notes skipped (already exist or don't exist) */
	skipped: number;
	/** Number of operations that failed */
	failed: number;
}

/**
 * Builds a notice message for a batch operation result.
 * @param result - The batch operation result
 * @param action - The action verb (e.g., 'Created', 'Removed')
 * @param includeSkipped - Whether to include skipped count in the message
 * @returns Formatted message string
 */
export function formatBatchResultMessage(
	result: BatchOperationResult,
	action: string,
	includeSkipped = true
): string {
	let message = `${action} ${result.success} notes`;
	if (includeSkipped) {
		message += `, skipped ${result.skipped} existing`;
	}
	if (result.failed > 0) {
		message += `, ${result.failed} failed`;
	}
	return message;
}

/** Regex to extract path from wikilink format: [[path/to/file]] */
const WIKILINK_REGEX = /^\[\[(.+)\]\]$/;

/**
 * Handles file note CRUD operations.
 * Provides methods for creating, removing, and querying file notes.
 */
export class FileNoteOperations {
	private app: App;
	private settings: FileNoteSettings;

	/**
	 * Creates a new FileNoteOperations instance.
	 * @param app - The Obsidian app instance
	 * @param settings - The plugin settings
	 */
	constructor(app: App, settings: FileNoteSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Updates the settings reference.
	 * Call this after settings are reloaded.
	 * @param settings - The new settings object
	 */
	updateSettings(settings: FileNoteSettings) {
		this.settings = settings;
	}

	/**
	 * Finds the note file for a given source file.
	 * Uses source frontmatter lookup if enabled, otherwise uses path-based lookup.
	 * @param file - The source file to find the note for
	 * @returns The note file if found, null otherwise
	 */
	findNote(file: TFile): TFile | null {
		if (this.settings.addSourceFrontmatter) {
			return this.findNoteBySource(file.path);
		}
		const note = this.app.vault.getAbstractFileByPath(this.getNotePath(file));
		return note instanceof TFile ? note : null;
	}

	/**
	 * Finds a note in the notes folder that has the given source file in its frontmatter.
	 * Used in central folder mode to find the correct note when names may conflict.
	 * @param sourcePath - The source file path to search for
	 * @returns The note file if found, null otherwise
	 */
	private findNoteBySource(sourcePath: string): TFile | null {
		const notesFolder = this.settings.notesFolder;
		if (!notesFolder) return null;

		// Get all markdown files in the notes folder
		const allFiles = this.app.vault.getMarkdownFiles() ?? [];
		const notesInFolder = allFiles.filter(f => f.path.startsWith(notesFolder + '/'));

		// Search for a note with matching source frontmatter
		for (const note of notesInFolder) {
			const cache = this.app.metadataCache.getFileCache(note);
			const source = cache?.frontmatter?.source as unknown;
			if (typeof source === 'string') {
				// Source is stored as wikilink: "[[path/to/file.pdf]]"
				const match = source.match(WIKILINK_REGEX);
				const extractedPath = match ? match[1] : source;
				if (extractedPath === sourcePath) {
					return note;
				}
			}
		}

		return null;
	}

	/**
	 * Returns the base path for the file note corresponding to a source file.
	 * Uses the notesFolder setting to determine the location:
	 * - Empty: same folder as source file
	 * - Starts with ./: relative subfolder (e.g., ./Notes -> Folder/Notes/file.md)
	 * - Otherwise: central folder (e.g., Notes -> Notes/file.md)
	 * @param file - The source file
	 * @returns The base note path (without conflict resolution)
	 */
	getNotePath(file: TFile): string {
		const noteName = file.name.replace(/\.[^.]+$/, '.md');
		const notesFolder = this.settings.notesFolder;

		if (!notesFolder) {
			// Empty: same folder as source file (original behavior)
			return file.path.replace(/\.[^.]+$/, '.md');
		}

		if (notesFolder.startsWith('./')) {
			// Relative subfolder: ./Notes -> parentFolder/Notes/file.md
			const subfolder = notesFolder.slice(2);
			const parentFolder = file.parent?.path || '';
			return parentFolder ? `${parentFolder}/${subfolder}/${noteName}` : `${subfolder}/${noteName}`;
		}

		// Central folder: Notes -> Notes/file.md
		return `${notesFolder}/${noteName}`;
	}

	/**
	 * Returns a unique path for the file note, resolving conflicts in central folder mode.
	 * For same-folder and relative-subfolder modes, returns the base path.
	 * For central folder mode, appends (1), (2), etc. if a file with the same name already exists.
	 * @param file - The source file
	 * @returns A unique note path that doesn't conflict with existing files
	 */
	getUniqueNotePath(file: TFile): string {
		const basePath = this.getNotePath(file);
		const notesFolder = this.settings.notesFolder;

		// Only apply conflict resolution for central folder mode (not empty, not relative)
		if (!notesFolder || notesFolder.startsWith('.')) {
			return basePath;
		}

		// Check if base path is available
		if (!this.app.vault.getAbstractFileByPath(basePath)) {
			return basePath;
		}

		// Find unique path by appending (1), (2), etc.
		const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
		let counter = 1;
		let uniquePath: string;

		do {
			uniquePath = `${notesFolder}/${nameWithoutExt} (${counter}).md`;
			counter++;
		} while (this.app.vault.getAbstractFileByPath(uniquePath));

		return uniquePath;
	}

	/**
	 * Ensures the parent folder exists for the given path, creating it if necessary.
	 * @param filePath - The file path whose parent folder should exist
	 */
	async ensureFolderExists(filePath: string): Promise<void> {
		const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
		if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
			await this.app.vault.createFolder(folderPath);
		}
	}

	/**
	 * Generates note content from the template, replacing {{filename}} with the actual file name.
	 * Optionally adds frontmatter with source path when enabled in settings.
	 * @param file - The source file to generate content for
	 * @returns The note content with placeholders replaced
	 */
	getNoteContent(file: TFile): string {
		const templateContent = this.settings.noteTemplate.replace(/\{\{filename\}\}/g, file.name);

		// Add frontmatter with source path if enabled
		if (this.settings.addSourceFrontmatter) {
			return `---\nsource: "[[${file.path}]]"\n---\n${templateContent}`;
		}

		return templateContent;
	}

	/**
	 * Creates a file note for a single file.
	 * The note content is generated from the configured template.
	 * @param file - The source file to create a note for
	 * @param showNotice - Whether to show a notice on success/failure
	 */
	async createFileNote(file: TFile, showNotice = true) {
		// Check if note already exists
		if (this.findNote(file)) {
			if (showNotice) new Notice('File note already exists');
			return;
		}

		try {
			// Get unique path (handles conflict resolution for central folder mode)
			const mdPath = this.getUniqueNotePath(file);
			await this.ensureFolderExists(mdPath);
			const content = this.getNoteContent(file);
			await this.app.vault.create(mdPath, content);
			if (showNotice) new Notice('Created file note');
		} catch (error) {
			console.error('Failed to create file note:', error);
			new Notice(`Failed to create file note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Creates file notes for multiple files.
	 * @param files - Array of source files to create notes for
	 * @returns Count of created, skipped (already existing), and failed notes
	 */
	async createFileNotes(files: TFile[]): Promise<BatchOperationResult> {
		let success = 0;
		let skipped = 0;
		let failed = 0;

		for (const file of files) {
			if (this.findNote(file)) {
				skipped++;
				continue;
			}

			try {
				const mdPath = this.getUniqueNotePath(file);
				await this.ensureFolderExists(mdPath);
				const content = this.getNoteContent(file);
				await this.app.vault.create(mdPath, content);
				success++;
			} catch (error) {
				console.error(`Failed to create note for ${file.path}:`, error);
				failed++;
			}
		}

		return {success, skipped, failed};
	}

	/**
	 * Removes the file note for a single file.
	 * @param file - The source file whose note should be removed
	 * @param showNotice - Whether to show a notice on success/failure
	 */
	async removeFileNote(file: TFile, showNotice = true) {
		const mdFile = this.findNote(file);
		if (!mdFile) {
			if (showNotice) new Notice('File note does not exist');
			return;
		}

		try {
			await this.app.fileManager.trashFile(mdFile);
			if (showNotice) new Notice('Removed file note');
		} catch (error) {
			console.error('Failed to remove file note:', error);
			new Notice(`Failed to remove file note: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Removes file notes for multiple files.
	 * @param files - Array of source files whose notes should be removed
	 * @returns Count of removed, skipped (non-existing), and failed notes
	 */
	async removeFileNotes(files: TFile[]): Promise<BatchOperationResult> {
		let success = 0;
		let skipped = 0;
		let failed = 0;

		for (const file of files) {
			const mdFile = this.findNote(file);

			if (!mdFile) {
				skipped++;
				continue;
			}

			try {
				await this.app.fileManager.trashFile(mdFile);
				success++;
			} catch (error) {
				console.error(`Failed to remove note for ${file.path}:`, error);
				failed++;
			}
		}

		return {success, skipped, failed};
	}

	/**
	 * Returns existing file notes for the given source files.
	 * @param files - Array of source files to check for existing notes
	 * @returns Array of TFile objects for notes that exist
	 */
	getExistingNotes(files: TFile[]): TFile[] {
		return files
			.map(f => this.findNote(f))
			.filter((f): f is TFile => f !== null);
	}
}
