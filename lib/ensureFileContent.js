// @flow

const fs = require('fs')
const { promisify } = require('util')

const readFileAsync = promisify( fs.readFile )
const writeFileAsync = promisify( fs.writeFile )

module.exports.default = async function ensureFileContent(
  fileName: string,
  currentFileContent: ?string,
  newFileContent: string
) {
  // If the current file content is not provided, get it
  if ( currentFileContent == null )
    currentFileContent = ( await readFileAsync( fileName ) ).toString()

  if ( currentFileContent !== newFileContent ) {
    console.log( '✍️  written:  ' + fileName )
    await writeFileAsync( fileName, newFileContent, 'utf8' )
  } else {
    console.log( '📎  skipped:  ' + fileName )
  }
}
