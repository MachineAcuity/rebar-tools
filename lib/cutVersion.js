//

const chalk = require('chalk')
const del = require('del')
const fsWithCallbacks = require('fs')
const os = require('os')
const path = require('path')

const executeExternal = require('./executeExternal')

//

const fs = fsWithCallbacks.promises

//

function parseVersionString(versionAsString, digitsExpected) {
  const arrVersion = versionAsString.split('.')

  for (let ix = 0; ix < arrVersion.length; ix++)
    arrVersion[ix] = Number(arrVersion[ix])

  if (
    arrVersion.length != digitsExpected ||
    isNaN(arrVersion[0]) ||
    isNaN(arrVersion[1]) ||
    isNaN(arrVersion[2]) ||
    (digitsExpected == 4 && isNaN(arrVersion[3]))
  )
    throw new Error(
      'FAIL  Version should have four numeric components. Instead found: ' +
        versionAsString,
    )

  return arrVersion
}

async function getPackageJSONVersion(cwd, applicationName) {
  const packageJSONName = path.join(
    cwd,
    'cut-version/',
    applicationName,
    'package.json',
  )

  try {
    const packageJSONAsString = (
      await fs.readFile(packageJSONName, 'utf8')
    ).toString()
    const packageJSONAsObject = JSON.parse(packageJSONAsString)

    return parseVersionString(packageJSONAsObject.version, 3)
  } catch (ex) {
    console.error(
      chalk.red('FAIL  Failed to parse version in ') +
        chalk.bold.green(packageJSONName),
    )
    throw new Error(ex)
  }
}

async function bumpVersion_async(cwd, applicationName, repoPath) {
  let repositoryRevision = await getPackageJSONVersion(cwd, applicationName)

  const currentVersion = repositoryRevision.join('.')
  console.log(
    chalk.white('  Current version in package.json: ') +
      chalk.bold.green(currentVersion),
  )

  // Increment version
  repositoryRevision[2] += 1
  const newPackageJSONVersion = repositoryRevision.join('.')

  const releaseBranchName = 'revision-' + repositoryRevision.join('.')
  await executeExternal('git', ['branch', releaseBranchName], { cwd: repoPath })
  await executeExternal('git', ['checkout', releaseBranchName], {
    cwd: repoPath,
  })
  await executeExternal('git', ['push', '--all', 'origin'], { cwd: repoPath })

  await updateFile(
    './cut-version/' + applicationName + '/package.json',
    '  "version": "',
    '  "version": "' + newPackageJSONVersion + '"',
  )

  // Report the new full version with build
  console.log(
    chalk.white('  New version in package.json:     ') +
      chalk.bold.green(newPackageJSONVersion),
  )
  console.log(
    chalk.white('               Release branch:     ') +
      chalk.bold.green(releaseBranchName),
  )

  await executeExternal('git', ['push', '--all', 'origin'], { cwd: repoPath })

  return { repositoryRevision, releaseBranchName }
}

async function updateFile(fileName, searchString, newContentOfLine) {
  let fileLines = (await fs.readFile(fileName, 'utf8')).toString().split('\n')
  let index = 0

  let updated = false
  while (index < fileLines.length) {
    if (fileLines[index].indexOf(searchString) > -1) {
      if (fileLines[index] == newContentOfLine)
        console.log(
          chalk.gray(
            '[' + chalk.bold.green(fileName) + '] is already up to date',
          ),
        )
      else {
        fileLines[index] = newContentOfLine
        await fs.writeFile(fileName, fileLines.join('\n'))

        updated = true
      }
      break
    } else index++
  }

  if (!updated) {
    throw new Error('  Could not update ' + chalk.bold.green(fileName))
  }
}

async function createReleaseBranch_async(
  cwd,
  applicationName,
  repositoryRevision,
  repoPath,
  releaseBranchName,
) {
  await executeExternal('git', ['add', '--all'], { cwd: repoPath })
  await executeExternal(
    'git',
    [
      'commit',
      '-m',
      '"Build performed by rebar tools ' + repositoryRevision.join('.') + '"',
    ],
    { cwd: repoPath },
  )

  await executeExternal('git', ['push', '--all', 'origin'], { cwd: repoPath })

  await executeExternal('git', ['checkout', 'master'], { cwd: repoPath })
  await executeExternal('git', ['pull', 'origin', 'master'], { cwd: repoPath })
  await executeExternal(
    'git',
    [
      'merge',
      '-X',
      'theirs',
      '-m',
      '"Merge version to branch ' +
        releaseBranchName +
        '  with no fast forward by rebar tools ' +
        repositoryRevision.join('.') +
        '"',
      '--no-ff',
      releaseBranchName,
    ],
    { cwd: repoPath },
  )
  await executeExternal('git', ['push', '--all', 'origin'], { cwd: repoPath })

  await executeExternal(
    'git',
    [
      'tag',
      '-a',
      'tag-' + releaseBranchName,
      '-m',
      '"Tag for release of ' +
        releaseBranchName +
        ' version ' +
        repositoryRevision.join('.') +
        '"',
    ],
    { cwd: repoPath },
  )
  await executeExternal('git', ['push', '--tags'], { cwd: repoPath })

  await executeExternal('git', ['checkout', 'develop'], { cwd: repoPath })
  await executeExternal('git', ['pull', 'origin', 'develop'], { cwd: repoPath })
  await executeExternal(
    'git',
    [
      'merge',
      '-X',
      'theirs',
      '-m',
      '"Merge version to master with no fast forward by rebar tools ' +
        repositoryRevision.join('.') +
        '"',
      '--no-ff',
      'master',
    ],
    { cwd: repoPath },
  )
  await executeExternal('git', ['push', '--all', 'origin'], { cwd: repoPath })
}

async function buildVersion_async(cwd, applicationName, repoPath) {
  await executeExternal('rm', ['-rf', 'deployment'], { cwd: repoPath })
  await executeExternal('mkdir', ['deployment'], { cwd: repoPath })

  await executeExternal('yarn', ['build-relay'], { cwd: repoPath })

  await executeExternal('yarn', ['build-server'], { cwd: repoPath })

  await executeExternal('yarn', ['build-webpack'], { cwd: repoPath })
}

async function cloneRepository_async(cwd, applicationName, repositoryUrl) {
  const repoParentPath = path.join(cwd, './cut-version/')
  const repoPath = path.join(repoParentPath, applicationName)

  // Remove any existing files
  await del([repoPath])

  // Clone
  await executeExternal(
    'git',
    ['clone', '--branch', 'develop', repositoryUrl, repoPath],
    {
      cwd: repoParentPath,
    },
  )

  // Install modules and set up environment
  await executeExternal('yarn', [], { cwd: repoPath })
  await executeExternal('yarn', ['setup-local-cut-version'], { cwd: repoPath })

  return { repoPath }
}

module.exports.cutVersion = async (cwd, applicationName, repositoryUrl) => {
  // Get develop branch from github
  const { repoPath } = await cloneRepository_async(
    cwd,
    applicationName,
    repositoryUrl,
  )

  // Determine the version number and update
  const { repositoryRevision, releaseBranchName } = await bumpVersion_async(
    cwd,
    applicationName,
    repoPath,
  )

  // Build version
  await buildVersion_async(cwd, applicationName, repoPath)

  // Create release branch
  await createReleaseBranch_async(
    cwd,
    applicationName,
    repositoryRevision,
    repoPath,
    releaseBranchName,
  )

  // Print instructions
  const repositoryRevisionString = repositoryRevision.join('.')
  console.log(
    chalk.gray('  Version [') +
      chalk.bold.green(repositoryRevisionString) +
      chalk.gray('] has been created. To test with sandbox:\n'),
  )
  console.log(
    chalk.bold.blueBright(
      '  ./update-' + applicationName + ' ' + repositoryRevisionString,
    ),
  )
}
