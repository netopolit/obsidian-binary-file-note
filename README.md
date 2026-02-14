# File Notes

A plugin for [Obsidian](https://obsidian.md) that creates markdown notes for non-native file formats (mp4, pdf, png, and other binary files), allowing you to add metadata, tags, and backlinks to any file type.

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22file-notes%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)

## About

Obsidian excels at managing markdown files, but working with binary files like videos, PDFs, and images can be limiting—you can't add tags, aliases, or backlinks to them directly.

**File Notes** solves this by creating a companion markdown note for each binary file. For example, a note for `video.mp4` creates `video.md` containing an embedded link:

```markdown
![[video.mp4]]
```

This allows you to:
- Add **tags**, **aliases**, and **frontmatter** to any file type
- Create **backlinks** to binary files
- Write **annotations** and **descriptions** alongside your media
- Keep your file explorer **clean** by optionally hiding source files

## Features

### Basic Operations

| Operation | How to |
|-----------|--------|
| Create file note | Right-click file → **File Notes commands** → **Create file note** |
| Remove file note | Right-click file → **File Notes commands** → **Remove file note** |
| Exclude file | Right-click file → **File Notes commands** → **Exclude from note creation** |
| Exclude folder | Right-click folder → **File Notes commands** → **Exclude folder from note creation** |

### Batch Operations

- **Create notes for all files**: Creates notes for all matching files in your vault
- **Create file notes for folder**: Right-click a folder to create notes for all matching files (including subfolders)
- **Remove file notes for folder**: Right-click a folder to remove all file notes (with confirmation)
- **Remove notes from all files**: Removes all file notes from your vault (with confirmation)

### Auto-Create Notes

Enable automatic note creation in settings. When you add a file with a matching extension, a file note is automatically created.

### Hide Source Files

Keep your file explorer clean by hiding source files that have corresponding notes. Only the markdown notes will be visible, while the original files remain accessible through embedded links.

Toggle this feature via:
- **Settings** → **Hide files with notes**
- Command palette: **Toggle files with notes visibility**

### Notes Folder

Control where file notes are stored with flexible folder options:

| Setting | Behavior | Example |
|---------|----------|---------|
| *(empty)* | Same folder as source file | `Videos/clip.mp4` → `Videos/clip.md` |
| `./Notes` | Subfolder relative to source | `Videos/clip.mp4` → `Videos/Notes/clip.md` |
| `Notes` | Central folder for all notes | `Videos/clip.mp4` → `Notes/clip.md` |

**Central folder mode** automatically resolves name conflicts by appending numbers: `report.md`, `report (1).md`, `report (2).md`, etc.

Folders are created automatically when the first note is saved.

**Source frontmatter**: In central folder mode, notes include frontmatter to track which source file they belong to:

```yaml
---
source: "[[Videos/clip.mp4]]"
---
```

This is automatically enabled for central folder mode (required for reliable remove when files have the same name). For other modes, you can optionally enable it via "Add source frontmatter" in settings.

### Customizable Note Template

Configure the content of created notes using a template with the `{{filename}}` placeholder.

**Examples:**
| Template | Result |
|----------|--------|
| `![[{{filename}}]]` | Embeds the file (default) |
| `[[{{filename}}]]` | Links to the file |
| `# {{filename}}` | Heading with file name |

## Commands

Open command palette with `Ctrl/Cmd + P`:

| Command | Description |
|---------|-------------|
| Create notes for all files | Creates file notes for all matching files in the vault |
| Remove notes from all files | Removes all file notes (with confirmation) |
| Toggle files with notes visibility | Shows/hides source files that have notes |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| File extensions | Comma-separated list of extensions (e.g., `mp4, pdf, png`) | `mp4` |
| Notes folder | Where to store notes: empty for same folder, `./Name` for relative subfolder, `Name` for central folder | *(empty)* |
| Add source frontmatter | Add source file path to note frontmatter (auto-enabled for central folder mode) | Off |
| Auto-create notes | Automatically create notes when matching files are added | Off |
| Hide files with notes | Hide source files in the file explorer | Off |
| Note template | Template content using `{{filename}}` placeholder | `![[{{filename}}]]` |

## Installation

### From Community Plugins

1. Open **Settings** → **Community plugins**
2. Disable **Restricted mode**
3. Select **Browse** and search for "File Notes"
4. Select **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/netopolit/file-notes/releases)
2. Create folder: `<vault>/.obsidian/plugins/file-notes/`
3. Copy downloaded files into the folder
4. Reload Obsidian
5. Enable in **Settings** → **Community plugins**

## Use Cases

- **Video annotations**: Add timestamps, summaries, and tags to video files
- **PDF management**: Organize research papers with metadata and cross-references
- **Image galleries**: Add descriptions and tags to photos
- **Audio notes**: Annotate podcast episodes or audio recordings
- **Asset management**: Track design files, 3D models, or other binary assets

## Development

```bash
# Clone the repository
git clone https://github.com/netopolit/file-notes.git

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

## Support

If you encounter issues or have feature requests, please open an issue on the [GitHub repository](https://github.com/netopolit/file-notes/issues).

## License

[MIT License](LICENSE)
