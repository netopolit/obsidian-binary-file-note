import {App, TFile, debounce} from 'obsidian';
import {FileNoteSettings} from './settings';
import {FileExplorerView} from './types';
import {FileNoteOperations} from './file-operations';

/** Delay in ms before updating hidden files after vault changes (debounce) */
const HIDDEN_FILES_UPDATE_DELAY_MS = 100;

/**
 * Manages visibility of source files in the file explorer.
 * Hides files that have corresponding file notes when the setting is enabled.
 */
export class HiddenFilesManager {
	private app: App;
	private settings: FileNoteSettings;
	private fileOps: FileNoteOperations;
	private hasHiddenFiles = false;

	/** Debounced version of update to prevent excessive updates during bulk operations */
	readonly debouncedUpdate = debounce(
		() => this.update(),
		HIDDEN_FILES_UPDATE_DELAY_MS,
		true
	);

	/**
	 * Creates a new HiddenFilesManager instance.
	 * @param app - The Obsidian app instance
	 * @param settings - The plugin settings
	 * @param fileOps - The file operations instance for path calculations
	 */
	constructor(app: App, settings: FileNoteSettings, fileOps: FileNoteOperations) {
		this.app = app;
		this.settings = settings;
		this.fileOps = fileOps;
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
	 * Updates visibility of source files in the file explorer.
	 * Hides any non-md file that has a corresponding .md note when setting is enabled.
	 */
	update() {
		// Early return if setting is off and no files need unhiding
		if (!this.settings.hideFilesWithNotes && !this.hasHiddenFiles) {
			return;
		}

		// Find file explorer leaf
		const fileExplorer = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!fileExplorer) return;

		const fileExplorerView = fileExplorer.view as unknown as FileExplorerView;
		if (!fileExplorerView.fileItems) return;

		let hiddenCount = 0;

		// Process each item in the file explorer
		for (const [path, item] of Object.entries(fileExplorerView.fileItems)) {
			// Skip if this is already an md file or has no extension
			if (path.endsWith('.md') || !path.includes('.')) {
				continue;
			}

			// Get the file object to use fileOps.getNotePath()
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				continue;
			}

			// Check if a corresponding note exists at the calculated path
			const notePath = this.fileOps.getNotePath(file);
			const noteExists = this.app.vault.getAbstractFileByPath(notePath);

			// Hide the source file if setting is enabled and note exists
			if (this.settings.hideFilesWithNotes && noteExists) {
				item.el.addClass('file-note-hidden');
				hiddenCount++;
			} else {
				item.el.removeClass('file-note-hidden');
			}
		}

		this.hasHiddenFiles = hiddenCount > 0;
	}

	/**
	 * Cancels any pending debounced update calls.
	 * Call this on plugin unload.
	 */
	cancelPendingUpdate() {
		this.debouncedUpdate.cancel();
	}
}
