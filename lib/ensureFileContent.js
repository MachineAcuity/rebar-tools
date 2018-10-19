// @flow

const chalk = require('chalk')
const fsWithCallbacks = require('fs')

//

const fs = fsWithCallbacks.promises

//

module.exports.ensureFileContent = async function ensureFileContent(
  fileName,
  currentFileContent,
  newFileContent,
  options,
) {
  // If the current file content is not provided, try to get it
  try {
    if (currentFileContent == null)
      currentFileContent = (await fs.readFile(fileName)).toString()
  } catch (ex) {}

  if (currentFileContent !== newFileContent) {
    await fs.writeFile(fileName, newFileContent, 'utf8')
    if (options && options.permissions)
      await fs.chmod(fileName, options.permissions)

    console.log(chalk.bold.white('✍️  updated  ') + chalk.bold.green(fileName))
    return true // Indicates the file was written
  } else {
    console.log(chalk.gray('📎     same  ' + fileName))
    return false // Indicates the file was skipped
  }
}
