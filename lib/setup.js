//

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
  mkdirSync(path.resolve(cwd, 'cut-version'))
  mkdirSync(path.resolve(cwd, 'ansible'))
  mkdirSync(path.resolve(cwd, 'gantry'))
  mkdirSync(path.resolve(cwd, 'gantry/source'))
  mkdirSync(path.resolve(cwd, 'gantry/run'))
}
module.exports.createGeneralPaths = createGeneralPaths

async function CreateProjectContentForFile(
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

  const promises = []

  // If the file name is per application, multiple files can be created
  if (FileName.indexOf('[application]') !== -1)
    for (let application in rebarProject.applications) {
      const destinationFileName = path.join(
        destDir,
        FileName.replace('[application]', application),
      )
      promises.push(
        ensureFileContent(
          destinationFileName,
          null,
          template({
            rebarProject,
            application: rebarProject.applications[application],
          }),
          options,
        ),
      )
    }
  else
    promises.push(
      ensureFileContent(
        path.join(destDir, FileName),
        null,
        template({ rebarProject }),
        options,
      ),
    )

  await Promise.all(promises)
}

async function CreateProjectContentForDirectory(
  rebarProject,
  cwd,
  projectSourceDirName,
  directory,
) {
  // Determine file path in new directory tree and create directory
  const destinationDir = directory.dirpath.replace(projectSourceDirName, cwd)
  mkdirSync(destinationDir)

  const promises = []
  for (let fileOrDir of directory.files)
    if (fileOrDir.files)
      promises.push(
        CreateProjectContentForDirectory(
          rebarProject,
          cwd,
          projectSourceDirName,
          fileOrDir,
        ),
      )
    else
      promises.push(
        CreateProjectContentForFile(
          rebarProject,
          directory.dirpath,
          destinationDir,
          fileOrDir.name,
        ),
      )

  await Promise.all(promises)
}

async function createProjectContent(rebarProject, cwd) {
  const projectSourceDirName = path.join(__dirname, '../project-content')
  const projectSourceDir = await rdrAsync(projectSourceDirName)

  await CreateProjectContentForDirectory(
    rebarProject,
    cwd,
    projectSourceDirName,
    projectSourceDir,
  )
}
module.exports.createProjectContent = createProjectContent
