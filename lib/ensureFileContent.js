// @flow

const fs = require('fs')
const { promisify } = require('util')

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

module.exports.ensureFileContent = async function ensureFileContent(
  fileName,
  currentFileContent,
  newFileContent,
) {
  // If the current file content is not provided, try to get it
  try {
    if (currentFileContent == null)
      currentFileContent = (await readFileAsync(fileName)).toString()
  } catch (ex) {}

  if (currentFileContent !== newFileContent) {
    console.log('✍️  written:  ' + fileName)
    await writeFileAsync(fileName, newFileContent, 'utf8')
  } else {
    console.log('📎  skipped:  ' + fileName)
  }
}
