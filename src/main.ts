import {Notice, Plugin, TFile, TFolder} from 'obsidian';
import {FileNoteSettings, FileNoteSettingTab, DEFAULT_SETTINGS} from "./settings";
import {ConfirmDeleteModal} from "./ui/confirm-delete-modal";
import {FileNoteOperations, formatBatchResultMessage} from "./file-operations";
import {registerCommands} from "./commands";
import {registerContextMenu} from "./context-menu";
import {HiddenFilesManager} from "./hidden-files";

/** File extensions that should never have file notes created for them */
const EXCLUDED_EXTENSIONS = new Set(['md', 'canvas', 'base']);

/**
 * File Notes Plugin
 * Creates markdown notes for unsuported files (e.g., mp4, pdf, png) with embedded links.
 * Notes are created in the same directory as the source file with the same name but .md extension.
 */
export default class FileNotePlugin extends Plugin {
	settings: FileNoteSettings;
	private fileOps: FileNoteOperations;
	private hiddenFiles: HiddenFilesManager;
	private cachedExtensions: Set<string> | null = null;
	private excludedFilesSet: Set<string> = new Set();
	private excludedFoldersSet: Set<string> = new Set();

	/**
	 * Called when the plugin is loaded.
	 * Initializes settings, registers commands, context menus, and event handlers.
	 */
	async onload() {
		await this.loadSettings();
		this.fileOps = new FileNoteOperations(this.app, this.settings);
		this.hiddenFiles = new HiddenFilesManager(this.app, this.settings);

		this.addSettingTab(new FileNoteSettingTab(this.app, this));
		registerCommands(this);
		registerContextMenu(this);

		// Handle file creation: auto-create notes and update hidden files
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				// Auto-create notes if enabled
				if (this.settings.autoCreate && this.shouldCreateNoteFor(file)) {
					void this.fileOps.createFileNote(file, false);
				}
				this.hiddenFiles.debouncedUpdate();
			})
		);

		// Update hidden files when vault changes (debounced to handle bulk operations)
		this.registerEvent(
			this.app.vault.on('delete', () => this.hiddenFiles.debouncedUpdate())
		);
		this.registerEvent(
			this.app.vault.on('rename', () => this.hiddenFiles.debouncedUpdate())
		);

		// Update hidden files when layout is ready
		this.app.workspace.onLayoutReady(() => this.hiddenFiles.update());
	}

	/**
	 * Called when the plugin is unloaded.
	 * Cleans up any pending operations.
	 */
	onunload() {
		this.hiddenFiles.cancelPendingUpdate();
	}

	/**
	 * Creates a file note for a single file.
	 * @param file - The source file to create a note for
	 */
	createFileNote(file: TFile) {
		void this.fileOps.createFileNote(file);
	}

	/**
	 * Removes the file note for a single file.
	 * @param file - The source file whose note should be removed
	 */
	removeFileNote(file: TFile) {
		void this.fileOps.removeFileNote(file);
	}

	/**
	 * Checks if a file is excluded from note creation.
	 * @param filePath - The file path to check
	 * @returns True if the file is excluded
	 */
	isFileExcluded(filePath: string): boolean {
		return this.excludedFilesSet.has(filePath);
	}

	/**
	 * Checks if a folder is excluded from note creation.
	 * @param folderPath - The folder path to check
	 * @returns True if the folder is excluded
	 */
	isFolderExcluded(folderPath: string): boolean {
		return this.excludedFoldersSet.has(folderPath);
	}

	/**
	 * Checks if a file is eligible for file note operations.
	 * Excludes markdown, canvas, and base files.
	 * @param file - The file to check
	 * @returns True if the file can have a file note created for it
	 */
	isEligibleFile(file: unknown): file is TFile {
		return file instanceof TFile && !EXCLUDED_EXTENSIONS.has(file.extension.toLowerCase());
	}

	/**
	 * Checks if a file note should be created for the given file.
	 * Validates against: eligible file type, configured extensions, excluded files, and excluded folders.
	 * @param file - The file to check
	 * @returns True if a note should be created for this file
	 */
	shouldCreateNoteFor(file: unknown): file is TFile {
		if (!this.isEligibleFile(file)) return false;
		if (!this.getExtensions().has(file.extension.toLowerCase())) return false;
		if (this.excludedFilesSet.has(file.path)) return false;
		if (this.isInExcludedFolder(file.path)) return false;
		return true;
	}

	/**
	 * Checks if a file path is within any excluded folder.
	 * @param filePath - The file path to check
	 * @returns True if the file is inside an excluded folder
	 */
	isInExcludedFolder(filePath: string): boolean {
		return this.settings.excludedFolders.some(folder =>
			filePath.startsWith(folder + '/')
		);
	}

	/**
	 * Updates visibility of source files in the file explorer.
	 * Public method for settings tab to trigger updates.
	 */
	updateHiddenFiles() {
		this.hiddenFiles.update();
	}

	/**
	 * Loads plugin settings from disk and merges with defaults.
	 * Updates all dependent components with the new settings.
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FileNoteSettings>);
		this.rebuildExclusionSets();
		this.fileOps?.updateSettings(this.settings);
		this.hiddenFiles?.updateSettings(this.settings);
	}

	/**
	 * Saves plugin settings to disk.
	 * Invalidates caches and updates all dependent components.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		this.cachedExtensions = null; // Invalidate cache when settings change
		this.rebuildExclusionSets();
		this.fileOps?.updateSettings(this.settings);
		this.hiddenFiles?.updateSettings(this.settings);
	}

	/**
	 * Rebuilds the exclusion Sets from the settings arrays for O(1) lookups.
	 */
	private rebuildExclusionSets() {
		this.excludedFilesSet = new Set(this.settings.excludedFiles);
		this.excludedFoldersSet = new Set(this.settings.excludedFolders);
	}

	/**
	 * Parses the configured file extensions from settings.
	 * Results are cached until settings change.
	 * Accepts extensions with or without leading dots (e.g., "mp4" or ".mp4").
	 * @returns Set of lowercase extensions, filtering out empty strings and 'md'
	 */
	getExtensions(): Set<string> {
		if (this.cachedExtensions === null) {
			const extensions = this.settings.fileExtensions
				.split(',')
				.map(ext => ext.trim().toLowerCase().replace(/^\./, ''))
				.filter(ext => ext.length > 0 && ext !== 'md');
			this.cachedExtensions = new Set(extensions);
		}
		return this.cachedExtensions;
	}

	/**
	 * Toggles the "Hide files with notes" setting and updates visibility.
	 */
	async toggleFilesWithNotesVisibility() {
		this.settings.hideFilesWithNotes = !this.settings.hideFilesWithNotes;
		await this.saveSettings();
		this.hiddenFiles.update();
		new Notice(`Hide files with notes: ${this.settings.hideFilesWithNotes ? 'On' : 'Off'}`);
	}

	/**
	 * Adds or removes a file from the exclusion list.
	 * @param file - The file to toggle exclusion for
	 * @param exclude - True to exclude, false to include
	 */
	async toggleFileExclusion(file: TFile, exclude: boolean) {
		if (exclude) {
			if (!this.excludedFilesSet.has(file.path)) {
				this.settings.excludedFiles.push(file.path);
			}
			new Notice(`Excluded "${file.name}" from note creation`);
		} else {
			this.settings.excludedFiles = this.settings.excludedFiles.filter(p => p !== file.path);
			new Notice(`Included "${file.name}" in note creation`);
		}
		await this.saveSettings();
	}

	/**
	 * Adds or removes a folder from the exclusion list.
	 * Files in excluded folders (and subfolders) are skipped during note creation.
	 * @param folder - The folder to toggle exclusion for
	 * @param exclude - True to exclude, false to include
	 */
	async toggleFolderExclusion(folder: TFolder, exclude: boolean) {
		if (exclude) {
			if (!this.excludedFoldersSet.has(folder.path)) {
				this.settings.excludedFolders.push(folder.path);
			}
			new Notice(`Excluded folder "${folder.name}" from note creation`);
		} else {
			this.settings.excludedFolders = this.settings.excludedFolders.filter(p => p !== folder.path);
			new Notice(`Included folder "${folder.name}" in note creation`);
		}
		await this.saveSettings();
	}

	/**
	 * Creates file notes for all matching files in the vault.
	 */
	async createAllFileNotes() {
		if (this.getExtensions().size === 0) {
			new Notice('No file extensions configured. Please add extensions in plugin settings.');
			return;
		}

		const files = this.app.vault.getFiles().filter(f => this.shouldCreateNoteFor(f));
		const result = await this.fileOps.createFileNotes(files);
		new Notice(formatBatchResultMessage(result, 'Created'));
	}

	/**
	 * Creates file notes for all matching files within a folder (recursively).
	 * @param folder - The folder to create notes in
	 */
	async createFileNotesInFolder(folder: TFolder) {
		if (this.getExtensions().size === 0) {
			new Notice('No file extensions configured. Please add extensions in plugin settings.');
			return;
		}

		const files = this.app.vault.getFiles().filter(f =>
			f.path.startsWith(folder.path + '/') && this.shouldCreateNoteFor(f)
		);
		const result = await this.fileOps.createFileNotes(files);
		new Notice(formatBatchResultMessage(result, 'Created'));
	}

	/**
	 * Shows a confirmation dialog and removes file notes if confirmed.
	 * Displays a scrollable list of files to be deleted.
	 * @param files - Array of source files whose notes should be removed
	 * @param emptyMessage - Message to show if no notes exist to remove
	 */
	confirmAndRemoveFileNotes(files: TFile[], emptyMessage: string) {
		const notesToDelete = this.fileOps.getExistingNotes(files);

		if (notesToDelete.length === 0) {
			new Notice(emptyMessage);
			return;
		}

		new ConfirmDeleteModal(this.app, notesToDelete, () => {
			void this.fileOps.removeFileNotes(files).then(result => {
				new Notice(formatBatchResultMessage(result, 'Removed', false));
			});
		}).open();
	}

	/**
	 * Removes all file notes in the vault (with confirmation dialog).
	 * Removes notes for all eligible files regardless of configured extensions.
	 */
	removeAllFileNotes() {
		const files = this.app.vault.getFiles().filter(f => this.isEligibleFile(f));
		this.confirmAndRemoveFileNotes(files, 'No file notes to remove');
	}

	/**
	 * Removes all file notes within a folder recursively (with confirmation dialog).
	 * Removes notes for all eligible files regardless of configured extensions.
	 * @param folder - The folder to remove notes from
	 */
	removeFileNotesInFolder(folder: TFolder) {
		const files = this.app.vault.getFiles().filter(f =>
			f.path.startsWith(folder.path + '/') && this.isEligibleFile(f)
		);
		this.confirmAndRemoveFileNotes(files, 'No file notes to remove in this folder');
	}
}
