//

const chalk = require('chalk')
const del = require('del')
const execSync = require('child_process').execSync
const fsWithCallbacks = require('fs')
const nodegit = require('nodegit')
const os = require('os')
const path = require('path')

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

async function bumpVersion(cwd, repository) {
  let arrPackageJSONVersion = await getPackageJSONVersion(cwd, repository)

  console.log(
    chalk.white('  Current version in package.json: ') +
      chalk.bold.green(arrPackageJSONVersion.join('.')),
  )

  // Increment version
  arrPackageJSONVersion[2] += 1
  const newPackageJSONVersion = arrPackageJSONVersion.join('.')

  await updateFile(
    './cut-version/' + repository + '/package.json',
    '  "version": "',
    '  "version": "' + newPackageJSONVersion + '"',
  )

  // Report the new full version with build
  console.log(
    chalk.white('  New version in package.json:     ') +
      chalk.bold.green(newPackageJSONVersion),
  )

  return arrPackageJSONVersion
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

async function createReleaseBranch(cwd, applicationName, repositoryRevision) {
  const repository = await nodegit.Repository.open(
    './cut-version/' + applicationName,
  )
  const signature = repository.defaultSignature()

  const headRef = await repository.getReference('HEAD')
  const headCommit = await repository.getCommit(headRef.target())

  const releaseBranchName = 'revision-' + repositoryRevision.join('.')
  const releaseBranch = await repository.createBranch(
    releaseBranchName,
    headCommit,
    1,
    signature,
    'Version cut ' + repositoryRevision.join('.'),
  )

  await repository.checkoutBranch(releaseBranch)

  const indexResult = await repository.refreshIndex()

  await indexResult.addAll()
  await indexResult.write()
  const oid = await indexResult.writeTree()

  const masterCommit = await repository.getMasterCommit()
  await repository.createCommit(
    'HEAD',
    signature,
    signature,
    'Version ' + repositoryRevision.join('.'),
    oid,
    [headCommit],
  )

  // Push to origin remote
  const repoPath = path.join(cwd, 'cut-version', applicationName)
  const pushResults = execSync(
    'cd ' + repoPath + ' && git push origin ' + releaseBranchName,
  ).toString()
  console.log(chalk.gray(pushResults))
}

async function ensureRepositoryIsOnDevelop(cwd, applicationName) {
  const repoPath = path.join(cwd, 'cut-version', applicationName)

  const repository = await nodegit.Repository.open(repoPath)
  const currentBranch = await repository.getCurrentBranch()
  const currentBranchNameParts = currentBranch.name().split('/')
  const branchName = currentBranchNameParts[currentBranchNameParts.length - 1]

  if (branchName != 'develop') {
    throw new Error(
      '  Cutting new versions should be done on develop, current branch is: ' +
        branchName,
    )
  }
}

function buildVersion(cwd, applicationName) {
  const repoPath = path.join(cwd, 'cut-version', applicationName)

  console.log(chalk.white('  Running yarn.'))
  console.log(
    chalk.gray(
      execSync(
        'cd ' + repoPath + ' && yarn && yarn setup-local-cut-version',
      ).toString(),
    ),
  )

  console.log(chalk.white('  Running build relay .... '))
  console.log(
    chalk.gray(
      execSync(
        'cd ' +
          repoPath +
          ' && rm -rf deployment && mkdir deployment && npm run build-relay',
      ).toString(),
    ),
  )

  console.log(chalk.white('  Running build server .... '))
  console.log(
    chalk.gray(
      execSync('cd ' + repoPath + ' && npm run build-server').toString(),
    ),
  )

  console.log(chalk.white('  Running build webpack .... '))
  console.log(
    chalk.white(
      execSync('cd ' + repoPath + ' && npm run build-webpack ').toString(),
    ),
  )
}

// async function cloneRepositoryUsingNodeGit( applicationName, repositoryUrl ) {
//
//   const repositoryPath = path.join( process.cwd(), './cut-version/', applicationName )
//
//   // Remove any existing files
//   await delAsync( [repositoryPath] )
//
//   // Set callbacks for clone
//   const callbacks = {}
//
//   // OS X? Special callback for libgit2
//   if( os.type() === 'Darwin' ) {
//
//     // This is a required callback for OS X machines. There is a known issue
//     // with libgit2 being able to verify certificates from GitHub.
//     callbacks.certificateCheck = () => 1
//   }
//
//   callbacks.credentials = async( repoUrl, username ) => {
//
//     console.log( file++ )
//     console.log( username)
//     try {
//
//       const nodegitCred = await nodegit.Cred.sshKeyFromAgent(
//         username,
//         path.join( process.env.HOME, '.ssh/github_rsa.pub' ),
//         path.join( process.env.HOME, '.ssh/github_rsa' ),
//         ''
//       )
//       return nodegitCred
//
//     } catch( err ) {
//       console.error( err )
//     }
//   }
//
//   // Clone
//   await nodegit.Clone( repositoryUrl, repositoryPath, {
//     fetchOpts: { callbacks }
//   } )
// }

async function cloneRepository(cwd, applicationName, repositoryUrl) {
  const repositoryParentPath = path.join(cwd, './cut-version/')
  const repositoryPath = path.join(repositoryParentPath, applicationName)

  // Remove any existing files
  await del([repositoryPath])

  // Clone
  console.log(chalk.white('  Cloning repository'))
  const buildResults = execSync(
    'cd ' +
      repositoryParentPath +
      ' && git clone ' +
      repositoryUrl +
      ' ' +
      repositoryPath +
      ' && cd ' +
      repositoryPath +
      ' && git checkout develop && git pull origin develop',
  ).toString()
  console.log(chalk.gray(buildResults))
}

module.exports.cutVersion = async (cwd, applicationName, repositoryUrl) => {
  // Get develop branch from github
  await cloneRepository(cwd, applicationName, repositoryUrl)

  // Verify that repo is on develop. If any poart of cloning failed, this will fail also
  await ensureRepositoryIsOnDevelop(cwd, applicationName)

  // Determine the version number and update
  const repositoryRevision = await bumpVersion(cwd, applicationName)

  // Build version
  buildVersion(cwd, applicationName)

  // Create release branch
  await createReleaseBranch(cwd, applicationName, repositoryRevision)

  // Print instructions
  const repositoryRevisionString = repositoryRevision.join('.')
  const branchName = 'revision-' + repositoryRevisionString
  console.log(
    chalk.gray('  Branch [') +
      chalk.bold.green(branchName) +
      chalk.gray('] has been created. Next steps:'),
  )
  console.log(chalk.gray('  To test with sandbox:\n'))
  console.log(
    chalk.bold.blueBright(
      '  ./update-' + applicationName + ' ' + repositoryRevisionString,
    ),
  )
  console.log('\n')
  console.log(chalk.gray('  To release after testing:\n'))
  console.log(
    chalk.bold.blueBright(
      '  ./publish-' + applicationName + ' ' + repositoryRevisionString,
    ),
  )
}
