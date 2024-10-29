# DrissionPage Recorder

DrissionPage Recorder is a Chrome extension that records browser interactions and generates DrissionPage code. This tool is designed to help automate web interactions by capturing user actions and converting them into executable scripts.

## Features

- **Start/Stop Recording**: Capture user interactions on web pages.
- **Generate DrissionPage Code**: Convert recorded actions into DrissionPage scripts.
- **Copy Code**: Easily copy generated code to the clipboard.
- **Element Locating**: Highlight and inspect elements on a page.
- **Custom Tags**: Define custom tags for element selection.
- **HTML Source Comments**: Include HTML source in generated code comments.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the extension directory.

## Usage

1. Click the extension icon to open the popup.
2. Use the "Start Recording" button to begin capturing interactions.
3. Perform actions on the web page.
4. Click "Stop" to end recording.
5. View and copy the generated DrissionPage code.
6. Use the "Locate" button to highlight elements and view their details.
7. Customize element selection by updating tags.

## Code Generation

The extension generates Python code using the DrissionPage library. It includes:

- Navigation commands
- Click actions with HTML source comments
- Input actions
- Keyboard interactions

## Customization

- **Tags**: Modify the tags used for element selection in the popup.
- **Locating**: Highlight elements and view their source code.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any improvements or bug fixes.

## License

This project is licensed under the MIT License.

