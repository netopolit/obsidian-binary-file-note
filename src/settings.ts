import {App, PluginSettingTab, Setting} from "obsidian";
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
}

/** Default settings values */
export const DEFAULT_SETTINGS: FileNoteSettings = {
	fileExtensions: 'mp4',
	autoCreate: false,
	excludedFiles: [],
	excludedFolders: [],
	hideFilesWithNotes: false,
	noteTemplate: '![[{{filename}}]]',
	notesFolder: ''
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

		// Notes folder setting
		const notesFolderSetting = new Setting(containerEl)
			.setName('Notes folder')
			.addText(text => text
				.setPlaceholder('Same folder as source file')
				.setValue(this.plugin.settings.notesFolder)
				.onChange(async (value) => {
					this.plugin.settings.notesFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		// Add description with examples below the setting
		const notesFolderDesc = notesFolderSetting.descEl;
		notesFolderDesc.appendText('Where to store file notes.');
		notesFolderDesc.createEl('br');
		notesFolderDesc.createEl('br');
		notesFolderDesc.createEl('strong', {text: 'Empty'});
		notesFolderDesc.appendText(' — same folder as source file');
		notesFolderDesc.createEl('br');
		notesFolderDesc.createEl('code', {text: './Notes'});
		notesFolderDesc.appendText(' — subfolder relative to source file');
		notesFolderDesc.createEl('br');
		notesFolderDesc.createEl('code', {text: 'Notes'});
		notesFolderDesc.appendText(' — central folder (conflicts auto-resolved)');

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
