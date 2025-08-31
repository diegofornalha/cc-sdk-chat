// note to show that there is optimistic rendering, i expanded the code block below
const blogpostMarkdown = `# control

*humans should focus on bigger problems*

## Setup

\`\`\`bash
git clone git@github.com:anysphere/control
this is extra dummy text that I am adding to show that there is optimistic rendering. 
It keeps going on, and on, and on, and on, and on, and on, and on, and on, and on, and on,
and on, and on, and on, and on, and on, and on, and on, and on, and on, and on, and on, 
\`\`\`

\`\`\`bash
./init.sh
\`\`\`

## Folder structure

**The most important folders are:**

1. \`vscode\`: this is our fork of vscode, as a submodule.
2. \`milvus\`: this is where our Rust server code lives.
3. \`schema\`: this is our Protobuf definitions for communication between the client and the server.

Each of the above folders should contain fairly comprehensive README files; please read them. If something is missing, or not working, please add it to the README!

**Some less important folders:**

1. \`release\`: this is a collection of scripts and guides for releasing various things.
2. \`infra\`: infrastructure definitions for the on-prem deployment.
3. \`third_party\`: where we keep our vendored third party dependencies.

## Miscellaneous things that may or may not be useful

##### Where to find rust-proto definitions

They are in a file called \`aiserver.v1.rs\`. It might not be clear where that file is. Run \`rg --files --no-ignore bazel-out | rg aiserver.v1.rs\` to find the file.

## Releasing

Within \`vscode/\`:

- Bump the version
- Then:

\`\`\`
git checkout build-todesktop
git merge main
git push origin build-todesktop
\`\`\`

- Wait for 14 minutes for gulp and ~30 minutes for todesktop
- Go to todesktop.com, test the build locally and hit release
`;

let currentContainer: HTMLElement | null = null; 
// Do not edit this method
function runStream() {
    currentContainer = document.getElementById('markdownContainer')!;

    // this randomly split the markdown into tokens between 2 and 20 characters long
    // simulates the behavior of an ml model thats giving you weirdly chunked tokens
    const tokens: string[] = [];
    let remainingMarkdown = blogpostMarkdown;
    while (remainingMarkdown.length > 0) {
        const tokenLength = Math.floor(Math.random() * 18) + 2;
        const token = remainingMarkdown.slice(0, tokenLength);
        tokens.push(token);
        remainingMarkdown = remainingMarkdown.slice(tokenLength);
    }

    const toCancel = setInterval(() => {
        const token = tokens.shift();
        if (token) {
            addToken(token);
        } else {
            clearInterval(toCancel);
        }
    }, 20);
}

let inCodeBlock = false;
let inInlineCode = false;
let codeBlockBuffer = "";
let inlineCodeBuffer = "";
let partialBackticks = ""; // To track incomplete backticks
let codeBlockLanguage = ""; // To store code block language if specified
let languageBuffer = ""; // Add this with other state variables at the top

let currentCodeBlockElement: HTMLPreElement | null = null; // Reference to the current <pre> element
let currentInlineCodeElement: HTMLElement | null = null; // Reference to the current <code> element

// Add these with your other state variables
let inHeading = false;
let headingLevel = 0;
let currentHeadingElement: HTMLHeadingElement | null = null;
let hashBuffer = "";

// Add these state variables at the top
let inBold = false;
let asteriskBuffer = "";
let currentBoldElement: HTMLElement | null = null;

// Add these state variables at the top with your other state variables
let inItalic = false;
let currentItalicElement: HTMLElement | null = null;

function addToken(token: string) {
    if (!currentContainer) return;

    let i = 0;
    while (i < token.length) {
        const char = token[i];

        // Handle backticks first
        if (char === '`') {
            partialBackticks += '`';
            i++;
            continue;
        }

        // Process accumulated backticks
        if (partialBackticks.length > 0) {
            if (partialBackticks === '```') {
                // Handle code block
                inCodeBlock = !inCodeBlock;
                partialBackticks = '';

                if (inCodeBlock) {
                    // Create a wrapper div for the code block and language label
                    const codeWrapper = document.createElement('div');
                    codeWrapper.style.backgroundColor = '#1e1e1e';
                    codeWrapper.style.borderRadius = '4px';
                    codeWrapper.style.marginBottom = '1em';

                    // Create language label div
                    const languageLabel = document.createElement('div');
                    languageLabel.style.padding = '4px 8px';
                    languageLabel.style.color = '#ffffff';
                    languageLabel.style.fontSize = '12px';
                    
                    // Create the pre element inside the wrapper
                    currentCodeBlockElement = document.createElement('pre');
                    currentCodeBlockElement.style.backgroundColor = '#1e1e1e';
                    currentCodeBlockElement.style.margin = '0';
                    currentCodeBlockElement.style.padding = '12px';
                    currentCodeBlockElement.style.color = '#ffffff';

                    // Check if the next character is a newline - if so, use "plain text"
                    if (i < token.length && token[i] === '\n') {
                        codeBlockLanguage = 'plain text';
                        languageLabel.textContent = '# plain text';
                        i++; // Skip the newline
                    }

                    codeWrapper.appendChild(languageLabel);
                    codeWrapper.appendChild(currentCodeBlockElement);
                    currentContainer.appendChild(codeWrapper);
                    languageBuffer = '';
                } else {
                    // End of code block
                    currentCodeBlockElement = null;
                    codeBlockBuffer = '';
                    codeBlockLanguage = '';
                    languageBuffer = '';
                }
            } else if (partialBackticks === '`') {
                // Handle inline code
                inInlineCode = !inInlineCode;
                partialBackticks = '';

                if (inInlineCode) {
                    // Beginning of inline code
                    currentInlineCodeElement = document.createElement('code');
                    currentInlineCodeElement.style.backgroundColor = '#eef'; // Light blue for visibility
                    currentContainer.appendChild(currentInlineCodeElement);
                } else {
                    // End of inline code
                    currentInlineCodeElement = null;
                    inlineCodeBuffer = '';
                }
            } else {
                i++;
                continue;
            }
            continue;
        }

        // If we're in a code block or inline code, handle that first
        if (inCodeBlock) {
            if (currentCodeBlockElement) {
                // console.log("inCodeBlock", char);
                // if (char === '\n') {
                //     console.log("newline");
                // }

                if (codeBlockLanguage === '') {
                    // console.log("languageBuffer", languageBuffer);
                    // Buffer characters until we hit a newline
                    // console.log("char", char);
                    if (char === '\n') {
                        // console.log("entering the codeblock");
                        // console.log("languageBuffer", languageBuffer);
                        codeBlockLanguage = languageBuffer.trim();
                        // Update the language label text when we detect the language
                        const wrapper = currentCodeBlockElement.parentElement;
                        if (wrapper) {
                            const label = wrapper.firstChild as HTMLElement;
                            // If no language was specified, use "plain text"
                            label.textContent = codeBlockLanguage ? `# ${codeBlockLanguage}` : '# plain text';
                        }
                        languageBuffer = '';
                        i++; // Skip the newline character
                        continue; // Don't add the newline to the content
                    } else {
                        languageBuffer += char;
                        i++;
                        continue;
                    }
                }
                // Append character to the current <pre> element
                currentCodeBlockElement.innerText += char;
            } else {
                // This shouldn't happen, but handle gracefully
                codeBlockBuffer += char;
            }
            i++;
            continue;
        } else if (inInlineCode) {
            if (currentInlineCodeElement) {
                // Append character to the current <code> element
                currentInlineCodeElement.innerText += char;
            } else {
                // This shouldn't happen, but handle gracefully
                inlineCodeBuffer += char;
            }
            i++;
            continue;
        }

        // Handle asterisks for bold and italic text
        if (char === '*') {
            asteriskBuffer += '*';
            if (asteriskBuffer === '**') {
                // Toggle bold state
                inBold = !inBold;
                if (inBold) {
                    currentBoldElement = document.createElement('strong');
                    currentBoldElement.style.fontWeight = 'bold';
                    currentContainer.appendChild(currentBoldElement);
                } else {
                    currentBoldElement = null;
                }
                asteriskBuffer = ""; // Reset buffer
            }
            i++;
            continue;
        } else {
            // If we have a single asterisk in buffer, it's for italics
            if (asteriskBuffer === '*') {
                inItalic = !inItalic;
                if (inItalic) {
                    currentItalicElement = document.createElement('em');
                    currentItalicElement.style.fontStyle = 'italic';
                    currentContainer.appendChild(currentItalicElement);
                } else {
                    currentItalicElement = null;
                }
                asteriskBuffer = "";
            }
            // If we see a non-asterisk but have a partial buffer,
            // output the buffered asterisks as normal text
            if (asteriskBuffer.length > 0) {
                if (currentBoldElement) {
                    currentBoldElement.innerText += asteriskBuffer;
                } else if (currentItalicElement) {
                    currentItalicElement.innerText += asteriskBuffer;
                } else {
                    const span = document.createElement('span');
                    span.innerText = asteriskBuffer;
                    currentContainer.appendChild(span);
                }
                asteriskBuffer = "";
            }
        }

        // Handle heading detection
        if (char === '#') {
            if (!inHeading || hashBuffer === "") {
                inHeading = true;
                hashBuffer += '#';
            } else if (inHeading) {
                hashBuffer += '#';
            }
            i++;
            continue;
        }

        // If we're in heading mode and see a space, create the heading
        if (inHeading && char === ' ') {
            headingLevel = hashBuffer.length;
            const heading = document.createElement(`h${headingLevel}`) as HTMLHeadingElement;
            
            // Style based on heading level
            switch(headingLevel) {
                case 1:
                    heading.style.fontSize = '2em';
                    break;
                case 2:
                    heading.style.fontSize = '1.5em';
                    break;
                case 3:
                    heading.style.fontSize = '1.17em';
                    break;
                case 4:
                    heading.style.fontSize = '1em';
                    break;
                case 5:
                    heading.style.fontSize = '0.83em';
                    break;
                case 6:
                    heading.style.fontSize = '0.67em';
                    break;
            }
            
            heading.style.fontWeight = 'bold';
            heading.style.margin = '0.0em 0 0.0em 0';
            currentContainer.appendChild(heading);
            currentHeadingElement = heading;
            inHeading = false;
            hashBuffer = "";
            i++;
            continue;
        }

        // Reset heading state at newline
        if (char === '\n') {
            inHeading = false;
            headingLevel = 0;
            hashBuffer = ""; // Clear the buffer
            currentHeadingElement = null;
        }

        // Update your content output logic to handle italics:
        if (currentBoldElement) {
            // Preserve spaces in bold content
            if (char === ' ') {
                currentBoldElement.innerHTML += '&nbsp;';
            } else {
                currentBoldElement.innerText += char;
            }
        } else if (currentItalicElement) {
            // Preserve spaces in italic content
            if (char === ' ') {
                currentItalicElement.innerHTML += '&nbsp;';
            } else {
                currentItalicElement.innerText += char;
            }
        } else if (currentHeadingElement) {
            // Preserve spaces in heading content
            if (char === ' ') {
                currentHeadingElement.innerHTML += '&nbsp;';
            } else {
                currentHeadingElement.innerText += char;
            }
        } else if (!inCodeBlock && !inInlineCode) {
            const span = document.createElement('span');
            span.innerText = char;
            currentContainer.appendChild(span);
        }

        i++;
    }
}