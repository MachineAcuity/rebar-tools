// @flow

const chalk = require('chalk')
const fs = require('fs')
const { promisify } = require('util')

const chmodAsync = promisify(fs.chmod)
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

module.exports.ensureFileContent = async function ensureFileContent(
  fileName,
  currentFileContent,
  newFileContent,
  options,
) {
  // If the current file content is not provided, try to get it
  try {
    if (currentFileContent == null)
      currentFileContent = (await readFileAsync(fileName)).toString()
  } catch (ex) {}

  if (currentFileContent !== newFileContent) {
    await writeFileAsync(fileName, newFileContent, 'utf8')
    if (options && options.permissions)
      await chmodAsync(fileName, options.permissions)

    console.log(chalk.bold.white('✍️  updated  ') + chalk.bold.green(fileName))
    return true // Indicates the file was written
  } else {
    console.log(chalk.gray('📎     same  ' + fileName))
    return false // Indicates the file was skipped
  }
}
