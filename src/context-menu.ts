import {Menu, MenuItem, TFile, TFolder} from 'obsidian';
import type FileNotePlugin from './main';

/**
 * Registers the context menu for files and folders.
 * @param plugin - The plugin instance to register the context menu on
 */
export function registerContextMenu(plugin: FileNotePlugin) {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			const isFile = plugin.isEligibleFile(file);
			const isFolder = file instanceof TFolder;

			if (!isFile && !isFolder) return;

			menu.addItem((item) => {
				item.setTitle('File notes commands')
					.setIcon('file-text');

				const submenu: Menu = (item as MenuItem & {setSubmenu: () => Menu}).setSubmenu();

				if (isFile) {
					buildFileContextMenu(plugin, submenu, file);
				}

				if (isFolder) {
					buildFolderContextMenu(plugin, submenu, file);
				}
			});
		})
	);
}

/**
 * Builds context menu items for a single file.
 * @param plugin - The plugin instance
 * @param submenu - The submenu to add items to
 * @param file - The file to build menu items for
 */
function buildFileContextMenu(plugin: FileNotePlugin, submenu: Menu, file: TFile) {
	submenu.addItem((sub: MenuItem) => {
		sub.setTitle('Create file note')
			.setIcon('file-plus')
			.onClick(() => plugin.createFileNote(file));
	});

	submenu.addItem((sub: MenuItem) => {
		sub.setTitle('Remove file note')
			.setIcon('file-minus')
			.onClick(() => plugin.removeFileNote(file));
	});

	// Toggle file exclusion
	const isExcluded = plugin.isFileExcluded(file.path);
	submenu.addItem((sub: MenuItem) => {
		if (isExcluded) {
			sub.setTitle('Include in note creation')
				.setIcon('plus-circle')
				.onClick(() => plugin.toggleFileExclusion(file, false));
		} else {
			sub.setTitle('Exclude from note creation')
				.setIcon('minus-circle')
				.onClick(() => plugin.toggleFileExclusion(file, true));
		}
	});
}

/**
 * Builds context menu items for a folder.
 * @param plugin - The plugin instance
 * @param submenu - The submenu to add items to
 * @param folder - The folder to build menu items for
 */
function buildFolderContextMenu(plugin: FileNotePlugin, submenu: Menu, folder: TFolder) {
	submenu.addItem((sub: MenuItem) => {
		sub.setTitle('Create file notes for folder')
			.setIcon('files')
			.onClick(() => plugin.createFileNotesInFolder(folder));
	});

	submenu.addItem((sub: MenuItem) => {
		sub.setTitle('Remove file notes for folder')
			.setIcon('trash')
			.onClick(() => plugin.removeFileNotesInFolder(folder));
	});

	// Toggle folder exclusion
	const isFolderExcluded = plugin.isFolderExcluded(folder.path);
	submenu.addItem((sub: MenuItem) => {
		if (isFolderExcluded) {
			sub.setTitle('Include folder in note creation')
				.setIcon('plus-circle')
				.onClick(() => plugin.toggleFolderExclusion(folder, false));
		} else {
			sub.setTitle('Exclude folder from note creation')
				.setIcon('minus-circle')
				.onClick(() => plugin.toggleFolderExclusion(folder, true));
		}
	});
}
