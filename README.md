# Preciser - Convert Methods/Functions to Expression Body

**Preciser** is a VSCode extension that converts methods to expression bodies for refactoring purposes.

## Demo

-Here's a quick demonstration of how the extension works in action:

-Converting a block body method to an expression body.

![Method to Expression Body](https://github.com/prajneshn/preciser/blob/master/images/usage.gif?raw=true)

## Features

- Converts methods to expression bodies.
- Supports TypeScript and JavaScript.
- Handles conversion of functions with single return statements or expressions.
- Provides keyboard shortcuts for fast and easy access.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions panel (`View → Extensions`).
3. Search for `Preciser` or `TypeScript Method/Function Converter`.
4. Click **Install**.
5. Reload VSCode to activate the extension.

## Usage

### How to Convert

1. **Select a TypeScript method or function** in your file.
2. A lightbulb icon (code action) will appear next to your selection, or you can trigger code actions manually by pressing:
   - `Ctrl + .` (Windows/Linux) or `Cmd + .` (Mac).
3. Choose the **Convert to Expression Body** option from the code actions menu to convert the selected block body function to an expression body.
4. Alternatively, right-click the selected code and choose **Convert to Expression Body** from the context menu.
