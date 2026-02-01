import {App, Notice, PluginSettingTab, Setting, ToggleComponent} from "obsidian";
import FileNotePlugin from "./main";

/**
 * Plugin settings interface.
 */
export interface FileNoteSettings {
	/** Comma-separated list of file extensions to create notes for */
	fileExtensions: string;
	/** Whether to automatically create notes when matching files are added */
	autoCreate: boolean;
	/** List of file paths excluded from note creation */
	excludedFiles: string[];
	/** List of folder paths excluded from note creation (includes subfolders) */
	excludedFolders: string[];
	/** Whether to hide source files that have a corresponding file note */
	hideFilesWithNotes: boolean;
	/** Template for note content. Use {{filename}} as placeholder for the source file name */
	noteTemplate: string;
	/** Folder path for storing notes. Empty = same folder, ./Name = relative subfolder, Name = central folder */
	notesFolder: string;
	/** Whether to add source frontmatter to notes (required for reliable remove in central folder mode with conflicts) */
	addSourceFrontmatter: boolean;
}

/** Default settings values */
export const DEFAULT_SETTINGS: FileNoteSettings = {
	fileExtensions: 'mp4',
	autoCreate: false,
	excludedFiles: [],
	excludedFolders: [],
	hideFilesWithNotes: false,
	noteTemplate: '![[{{filename}}]]',
	notesFolder: '',
	addSourceFrontmatter: false
};

/**
 * Settings tab for the File Note plugin.
 * Allows users to configure file extensions and auto-create behavior.
 */
export class FileNoteSettingTab extends PluginSettingTab {
	plugin: FileNotePlugin;

	/**
	 * Creates a new settings tab instance.
	 * @param app - The Obsidian app instance
	 * @param plugin - The plugin instance
	 */
	constructor(app: App, plugin: FileNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders the settings tab UI.
	 * Creates controls for file extensions, auto-create toggle, hide files toggle, and note template.
	 */
	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// File extensions setting
		new Setting(containerEl)
			.setName('File extensions')
			.setDesc('Enter file extensions separated by commas')
			.addText(text => text
				.setValue(this.plugin.settings.fileExtensions)
				.onChange(async (value) => {
					this.plugin.settings.fileExtensions = value;
					await this.plugin.saveSettings();
				}));

		// Notes folder setting - custom layout for input between description and examples
		const notesFolderSetting = new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Where to store file notes.');

		// Helper to check if current value is central folder mode
		// Anything starting with "." is treated as relative path (not central)
		const isCentralFolderMode = (value: string): boolean => {
			return !!(value && !value.startsWith('.'));
		};

		// Create input container for full-width input
		const inputContainer = notesFolderSetting.settingEl.createDiv({cls: 'file-note-folder-container'});
		const input = inputContainer.createEl('input', {
			cls: 'file-note-folder-input',
			attr: {type: 'text', placeholder: 'Same folder as source file'}
		});
		input.value = this.plugin.settings.notesFolder;

		// Add examples below input
		const folderExamplesEl = notesFolderSetting.settingEl.createDiv({cls: 'file-note-folder-examples'});
		folderExamplesEl.createEl('strong', {text: 'Examples:'});
		folderExamplesEl.createEl('br');
		folderExamplesEl.createEl('span', {text: 'Empty'});
		folderExamplesEl.appendText(' — same folder as source file');
		folderExamplesEl.createEl('br');
		folderExamplesEl.createEl('code', {text: './Notes'});
		folderExamplesEl.appendText(' — subfolder relative to source file');
		folderExamplesEl.createEl('br');
		folderExamplesEl.createEl('code', {text: 'Notes'});
		folderExamplesEl.appendText(' — central folder ');
		folderExamplesEl.createEl('strong', {text: '(requires source frontmatter)'});

		// Add source frontmatter toggle
		let sourceFrontmatterToggle: ToggleComponent;
		const sourceFrontmatterSetting = new Setting(containerEl)
			.setName('Add source frontmatter')
			.setDesc('Add source file path to note frontmatter. Required for central folder mode to reliably track which note belongs to which source file.')
			.addToggle(toggle => {
				sourceFrontmatterToggle = toggle;
				toggle
					.setValue(this.plugin.settings.addSourceFrontmatter)
					.onChange(async (value) => {
						this.plugin.settings.addSourceFrontmatter = value;
						await this.plugin.saveSettings();
					});
			});

		// Function to update toggle state based on folder mode
		const updateFrontmatterToggle = (folderValue: string) => {
			const isCentral = isCentralFolderMode(folderValue);
			if (isCentral) {
				// Auto-enable and disable toggle in central mode
				this.plugin.settings.addSourceFrontmatter = true;
				sourceFrontmatterToggle.setValue(true);
				sourceFrontmatterToggle.setDisabled(true);
			} else {
				// Enable toggle for other modes (user can manually toggle)
				sourceFrontmatterToggle.setDisabled(false);
			}
		};

		// Set initial toggle state
		updateFrontmatterToggle(this.plugin.settings.notesFolder);

		// Update toggle when folder value changes
		input.addEventListener('input', () => {
			const value = input.value.trim();
			this.plugin.settings.notesFolder = value;
			updateFrontmatterToggle(value);
			void this.plugin.saveSettings();
		});

		// Show notice when clicking disabled toggle (debounced to prevent duplicates)
		let lastNoticeTime = 0;
		sourceFrontmatterSetting.settingEl.addEventListener('click', () => {
			if (sourceFrontmatterToggle.disabled) {
				const now = Date.now();
				if (now - lastNoticeTime > 500) {
					lastNoticeTime = now;
					new Notice('Required for central folder mode');
				}
			}
		});

		// Auto-create toggle
		new Setting(containerEl)
			.setName('Auto-create notes')
			.setDesc('Automatically create a file note when a file with a matching extension is added')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoCreate)
				.onChange(async (value) => {
					this.plugin.settings.autoCreate = value;
					await this.plugin.saveSettings();
				}));

		// Hide files with notes toggle
		new Setting(containerEl)
			.setName('Hide files with notes')
			.setDesc('Hide source files in the file explorer when they have a corresponding file note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideFilesWithNotes)
				.onChange(async (value) => {
					this.plugin.settings.hideFilesWithNotes = value;
					await this.plugin.saveSettings();
					this.plugin.updateHiddenFiles();
				}));

		// Note template setting - custom layout for better UX
		const templateSetting = new Setting(containerEl)
			.setName('Note template')
			.setDesc('Template for the content of created notes. Use {{filename}} as a placeholder for the source file name.');

		// Create textarea container for custom positioning
		const textareaContainer = templateSetting.settingEl.createDiv({cls: 'file-note-template-container'});
		const textarea = textareaContainer.createEl('textarea', {
			cls: 'file-note-template-textarea',
			attr: {placeholder: '![[{{filename}}]]'}
		});
		textarea.value = this.plugin.settings.noteTemplate;
		textarea.addEventListener('input', () => {
			this.plugin.settings.noteTemplate = textarea.value;
			void this.plugin.saveSettings();
		});

		// Add examples below textarea
		const examplesEl = templateSetting.settingEl.createDiv({cls: 'file-note-template-examples'});
		examplesEl.appendText('Examples: ');
		examplesEl.createEl('code', {text: '![[{{filename}}]]'});
		examplesEl.appendText(' embeds the file, ');
		examplesEl.createEl('code', {text: '[[{{filename}}]]'});
		examplesEl.appendText(' links to the file, ');
		examplesEl.createEl('code', {text: '# {{filename}}'});
		examplesEl.appendText(' heading with file name');
	}
}
