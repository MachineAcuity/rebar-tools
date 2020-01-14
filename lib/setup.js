//

const chalk = require('chalk')
const ejs = require('ejs')
const fsWithCallbacks = require('fs')
const path = require('path')

const { ensureFileContent } = require('./ensureFileContent')
const { rdrAsync } = require('./rdrAsync')

//

const fs = fsWithCallbacks.promises

//

const mkDirOrSkip = async function(dirPath) {
  try {
    await fs.mkdir(dirPath)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

async function createGeneralPaths(rebarProject, cwd) {
  console.log(chalk.white('Creating directories'))

  await mkDirOrSkip(path.resolve(cwd, 'app-settings'))
  for (let applicationName in rebarProject.applications) {
    await mkDirOrSkip(path.resolve(cwd, 'app-settings', applicationName))
  }

  await mkDirOrSkip(path.resolve(cwd, 'cut-version'))

  await mkDirOrSkip(path.resolve(cwd, 'sandbox'))
  await mkDirOrSkip(path.resolve(cwd, 'sandbox/source'))
  await mkDirOrSkip(path.resolve(cwd, 'sandbox/run'))
  await mkDirOrSkip(path.resolve(cwd, 'sandbox/run/dataf'))
  await mkDirOrSkip(path.resolve(cwd, 'sandbox/run/dataf/artifact'))
}
module.exports.createGeneralPaths = createGeneralPaths

async function CreateContentForFile(
  rebarProject,
  sourceDir,
  destDir,
  FileName,
) {
  // Create a template from the EJS file
  const templateContents = (
    await fs.readFile(path.join(sourceDir, FileName))
  ).toString()
  const template = ejs.compile(templateContents, {})

  // Is the file executable?
  let isExecutableFile = false
  if (FileName.indexOf('[exec]') !== -1) {
    FileName = FileName.replace('[exec]', '')
    isExecutableFile = true
  }

  // If the file is executable, pass options to ensureFileContent
  const options = isExecutableFile ? { permissions: 0755 } : null

  // If the file name contains the project name, replace it
  if (FileName.indexOf('[project]') !== -1) {
    const projectName = rebarProject.name
    if (!projectName) throw new Error('Project name missing')
    FileName = FileName.replace('[project]', projectName)
  }

  // If the file name contains noop, remove it from name.
  // Noop is used to create files that affect system behavior like
  // .gitignore, which can not be stored with their proper name
  // within the project
  if (FileName.indexOf('[noop]') !== -1) {
    FileName = FileName.replace('[noop]', '')
  }

  const promises = []

  // If the file name is per application, multiple files can be created
  if (FileName.indexOf('[application]') !== -1) {
    // If the file has [isArtifact] in its name, remeber that and remove [isArtifact] from name
    const optionIsArtifact = FileName.indexOf('[isArtifact]') !== -1
    if (optionIsArtifact) {
      FileName = FileName.replace('[isArtifact]', '')
    }

    for (let applicationName in rebarProject.applications) {
      const application = rebarProject.applications[applicationName]

      // If the file has [isArtifact] in its name, and the application is not an artifact, skip
      if (optionIsArtifact && !application.isArtifact) continue

      const destinationFileName = path.join(
        destDir,
        FileName.replace('[application]', applicationName),
      )

      promises.push(
        ensureFileContent(
          destinationFileName,
          null,
          template({
            application,
            applicationName,
            project: rebarProject,
          }),
          options,
        ),
      )
    }
  } else
    promises.push(
      ensureFileContent(
        path.join(destDir, FileName),
        null,
        template({ project: rebarProject }),
        options,
      ),
    )

  await Promise.all(promises)
}

async function CreateContentForDirectory(
  rebarProject,
  cwd,
  contentDirName,
  directory,
) {
  // Determine file path in new directory tree and create directory
  const destinationDir = directory.dirpath.replace(contentDirName, cwd)
  await mkDirOrSkip(destinationDir)

  const promises = []
  for (let fileOrDir of directory.files)
    if (fileOrDir.files)
      promises.push(
        CreateContentForDirectory(rebarProject, cwd, contentDirName, fileOrDir),
      )
    else
      promises.push(
        CreateContentForFile(
          rebarProject,
          directory.dirpath,
          destinationDir,
          fileOrDir.name,
        ),
      )

  await Promise.all(promises)
}

async function createProjectContent(rebarProject, cwd) {
  console.log(chalk.white('Creating project files'))

  const contentDirName = path.join(__dirname, '../content/project')
  const contentDir = await rdrAsync(contentDirName)

  await CreateContentForDirectory(rebarProject, cwd, contentDirName, contentDir)
}

module.exports.createProjectContent = createProjectContent
