//

const chalk = require('chalk')
const ejs = require('ejs')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const { ensureFileContent } = require('./ensureFileContent')
const { rdrAsync } = require('./rdrAsync')

const readFileAsync = promisify(fs.readFile)

const mkdirSync = function(dirPath) {
  try {
    fs.mkdirSync(dirPath)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

function createGeneralPaths(cwd) {
  console.log(chalk.white('Creating directories'))

  mkdirSync(path.resolve(cwd, 'cut-version'))
  mkdirSync(path.resolve(cwd, 'ansible'))
  mkdirSync(path.resolve(cwd, 'gantry'))
  mkdirSync(path.resolve(cwd, 'gantry/source'))
  mkdirSync(path.resolve(cwd, 'gantry/run'))
  mkdirSync(path.resolve(cwd, 'gantry/run/global_files'))
}
module.exports.createGeneralPaths = createGeneralPaths

async function CreateContentForFile(
  rebarProject,
  sourceDir,
  destDir,
  FileName,
) {
  // Create a template from the EJS file
  const templateContents = (await readFileAsync(
    path.join(sourceDir, FileName),
  )).toString()
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
  mkdirSync(destinationDir)

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

async function createAnsibleContent(rebarProject) {
  console.log(chalk.white('Creating Ansible files'))

  const contentDirName = path.join(__dirname, '../content/ansible')
  const contentDir = await rdrAsync(contentDirName)

  await CreateContentForDirectory(
    rebarProject,
    '/etc/pansible',
    contentDirName,
    contentDir,
  )
}
module.exports.createAnsibleContent = createAnsibleContent

async function createProjectContent(rebarProject, cwd) {
  console.log(chalk.white('Creating project files'))

  const contentDirName = path.join(__dirname, '../content/project')
  const contentDir = await rdrAsync(contentDirName)

  await CreateContentForDirectory(rebarProject, cwd, contentDirName, contentDir)
}
module.exports.createProjectContent = createProjectContent

async function createNGINXServersContent(rebarProject) {
  console.log(chalk.white('Creating NGINX files'))

  const contentDirName = path.join(__dirname, '../content/nginx')
  const contentDir = await rdrAsync(contentDirName)

  await CreateContentForDirectory(
    rebarProject,
    '/usr/local/etc/nginx/servers',
    contentDirName,
    contentDir,
  )
}
module.exports.createNGINXServersContent = createNGINXServersContent
