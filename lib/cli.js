#! /usr/bin/env node

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const yargs = require('yargs')
const yargsPromiseHandler = require('yargs-promise-handler')

const { cutVersion } = require('./cutVersion')
const {
  createGeneralPaths,
  createNGINXServersContent,
  createProjectContent,
} = require('./setup')

const readFileAsync = promisify(fs.readFile)

// memorize current directory in case it ever changes
const cwd = process.cwd()

// Global failure description, quick, dirty and efficient way to produce meaningful error messages
let failureDescription = ''

async function loadRebarProject() {
  failureDescription = 'Could not find rebar-project.json'
  const rebarProjectAsBuffer = await readFileAsync('rebar-project.json')

  failureDescription = 'File rebar-project.json is not in JSON format'
  const rebarProject = JSON.parse(rebarProjectAsBuffer)

  return rebarProject
}

async function commandCut(rebarProject, argv) {
  try {
    const rebarProject = await loadRebarProject()

    failureDescription =
      'Cound not find definition for application ' + argv.application
    const applicationDefinition = rebarProject.applications[argv.application]
    const { applicationName, repositoryUrl } = applicationDefinition

    failureDescription = 'Could not cut version'
    await cutVersion(
      cwd,
      applicationName,
      'git@github.com:codefoundries/UniversalRelayBoilerplate.git',
    )
  } catch (ex) {
    console.log('💔  ' + failureDescription + '\n' + ex)
  }
}

async function commandSetup(argv) {
  try {
    const rebarProject = await loadRebarProject()

    failureDescription = 'Could not create directories'
    createGeneralPaths(cwd)

    failureDescription = 'Could not generate project content'
    await createProjectContent(rebarProject, cwd)

    failureDescription = 'Could not generate NGINX servers conent'
    await createNGINXServersContent(rebarProject, cwd)
  } catch (ex) {
    console.log('💔  ' + failureDescription + '\n' + ex)
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
        yargs => {
          // yargs.option('port', {
          //   describe: 'port to bind on',
          //   default: 5000
          // })
        },
        yargsPromiseHandler(argv => commandSetup(argv)),
      )
      .demand(1)
      .help().argv
  } catch (ex) {
    console.log('💔  ' + failureDescription + '\n' + ex)
  }
}

main()
