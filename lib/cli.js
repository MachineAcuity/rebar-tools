#! /usr/bin/env node

const chalk = require('chalk')
const fsWithCallbacks = require('fs')
const path = require('path')
const process = require('process')
const yargs = require('yargs')
const yargsPromiseHandler = require('yargs-promise-handler')

const { cutVersion } = require('./cutVersion')
const { createGeneralPaths, createProjectContent } = require('./setup')

//

const fs = fsWithCallbacks.promises

//

// memorize current directory in case it ever changes
let cwd = 'project directory has not been set'

// Global failure description, quick, dirty and efficient way to produce meaningful error messages
let failureDescription = ''

async function loadRebarProject() {
  let rebarProjectAsBuffer = null

  for (let lastCwd = '!'; process.cwd() !== lastCwd; process.chdir('..')) {
    lastCwd = process.cwd()

    try {
      rebarProjectAsBuffer = await fs.readFile('rebar-project.json')
      break
    } catch (err) {
      // Ignore error - assuming file not found
    }
  }

  if (rebarProjectAsBuffer == null)
    throw new Error('Could not find rebar-project.json')

  failureDescription = 'File rebar-project.json is not in JSON format'
  const rebarProject = JSON.parse(rebarProjectAsBuffer)

  // Execute the rest of the code from tools
  process.chdir('tools')
  cwd = process.cwd()

  return rebarProject
}

async function commandCut(argv) {
  try {
    const rebarProject = await loadRebarProject()

    failureDescription =
      'Cound not find definition for application ' + argv.application
    const applicationDefinition = rebarProject.applications[argv.application]
    const { repositoryUrl } = applicationDefinition

    failureDescription = 'Could not cut version'
    await cutVersion(cwd, argv.application, applicationDefinition.repositoryUrl)
  } catch (ex) {
    console.error(chalk.red.bold('FAIL  ' + failureDescription))
    console.error(chalk.yellow(ex))
  }
}

async function commandSetup(argv) {
  try {
    const rebarProject = await loadRebarProject()

    failureDescription = 'Could not create directories'
    await createGeneralPaths(cwd)

    failureDescription = 'Could not generate project files'
    await createProjectContent(rebarProject, cwd)

    // failureDescription = 'Could not generate Ansible scripts'
    // await createAnsibleContent(rebarProject)
  } catch (ex) {
    console.error(chalk.red.bold('FAIL  ' + failureDescription))
    console.error(chalk.yellow(ex))
  }
}

async function main() {
  let failureDescription = ''
  try {
    failureDescription = 'Parsing command line'

    yargs
      .command(
        'cut <application>',
        'Cut a version of an application',
        yargs => {
          // yargs.option('port', {
          //   describe: 'port to bind on',
          //   default: 5000
          // })
        },
        yargsPromiseHandler(argv => commandCut(argv)),
      )
      .command(
        'setup',
        'Sets up the directories and scripts needed',
        yargs => {},
        yargsPromiseHandler(argv => commandSetup(argv)),
      )
      .demand(1)
      .help().argv
  } catch (ex) {
    console.error(chalk.red.bold('FAIL  ' + failureDescription))
    console.error(chalk.yellow(ex))
  }
}

main()
